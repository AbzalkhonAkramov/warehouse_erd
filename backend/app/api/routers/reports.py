import calendar
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.agent import AgentTarget
from app.models.catalog import Product
from app.models.enums import SalesOrderStatus, UserRole
from app.models.inventory import Stock, StockMovement
from app.models.sales import Customer, SalesOrder, SalesOrderLine
from app.models.user import User
from app.schemas.agent import CommissionRow

# Orders that should not count towards sales/commission figures (only shipped/
# delivered orders are real, stock-deducting sales).
_EXCLUDED = (
    SalesOrderStatus.NEW,
    SalesOrderStatus.REFUND,
    SalesOrderStatus.CANCELLED,
    SalesOrderStatus.REJECTED,
    SalesOrderStatus.DRAFT,
    SalesOrderStatus.PENDING,
)

router = APIRouter(prefix="/reports", tags=["reports"])


class AgentSalesRow(BaseModel):
    agent_id: int
    agent_name: str
    orders: int
    total: Decimal


class DashboardOut(BaseModel):
    pending_orders: int
    stock_value: Decimal
    total_debt: Decimal
    low_stock_items: int


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> DashboardOut:
    pending = await db.scalar(
        select(func.count())
        .select_from(SalesOrder)
        .where(SalesOrder.status == SalesOrderStatus.NEW)
    )
    stock_value = await db.scalar(
        select(func.coalesce(func.sum(Stock.quantity * Product.cost_price), 0)).join(
            Product, Product.id == Stock.product_id
        )
    )
    total_debt = await db.scalar(select(func.coalesce(func.sum(Customer.debt), 0)))
    low_stock = await db.scalar(
        select(func.count())
        .select_from(Stock)
        .join(Product, Product.id == Stock.product_id)
        .where(Stock.quantity <= Product.min_stock)
    )
    return DashboardOut(
        pending_orders=pending or 0,
        stock_value=Decimal(stock_value or 0),
        total_debt=Decimal(total_debt or 0),
        low_stock_items=low_stock or 0,
    )


@router.get("/sales-by-agent", response_model=list[AgentSalesRow])
async def sales_by_agent(
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> list[AgentSalesRow]:
    stmt = (
        select(
            User.id,
            User.full_name,
            func.count(SalesOrder.id),
            func.coalesce(func.sum(SalesOrder.total), 0),
        )
        .join(SalesOrder, SalesOrder.agent_id == User.id)
        .where(SalesOrder.status.notin_(_EXCLUDED))
        .group_by(User.id, User.full_name)
        .order_by(func.sum(SalesOrder.total).desc())
    )
    if date_from:
        stmt = stmt.where(SalesOrder.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        stmt = stmt.where(SalesOrder.created_at <= datetime.combine(date_to, datetime.max.time()))
    rows = await db.execute(stmt)
    return [
        AgentSalesRow(agent_id=aid, agent_name=name, orders=cnt, total=Decimal(total))
        for aid, name, cnt, total in rows.all()
    ]


@router.get("/debt-aging")
async def debt_aging(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> list[dict]:
    """Customers with outstanding debt, highest first."""
    rows = await db.scalars(
        select(Customer).where(Customer.debt > 0).order_by(Customer.debt.desc())
    )
    return [
        {
            "customer_id": c.id,
            "name": c.name,
            "debt": float(c.debt),
            "credit_limit": float(c.credit_limit),
            "over_limit": float(c.debt) > float(c.credit_limit) if c.credit_limit else False,
        }
        for c in rows
    ]


@router.get("/commissions", response_model=list[CommissionRow])
async def commissions(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> list[CommissionRow]:
    """Per-agent commission for a month: sales × commission_rate, vs. their target."""
    start = datetime(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end = datetime(year, month, last_day, 23, 59, 59)

    sales_rows = await db.execute(
        select(SalesOrder.agent_id, func.coalesce(func.sum(SalesOrder.total), 0))
        .where(
            SalesOrder.status.notin_(_EXCLUDED),
            SalesOrder.created_at >= start,
            SalesOrder.created_at <= end,
        )
        .group_by(SalesOrder.agent_id)
    )
    sales_by_agent = {aid: Decimal(total) for aid, total in sales_rows.all()}

    targets = await db.execute(
        select(AgentTarget.agent_id, AgentTarget.target_amount).where(
            AgentTarget.year == year, AgentTarget.month == month
        )
    )
    target_by_agent = {aid: Decimal(amt) for aid, amt in targets.all()}

    agents = await db.scalars(select(User).where(User.role == UserRole.AGENT))
    out: list[CommissionRow] = []
    for agent in agents:
        sales = sales_by_agent.get(agent.id, Decimal("0"))
        rate = Decimal(agent.commission_rate)
        commission = (sales * rate / Decimal("100")).quantize(Decimal("0.01"))
        target = target_by_agent.get(agent.id)
        achievement = float(sales / target * 100) if target and target > 0 else None
        out.append(
            CommissionRow(
                agent_id=agent.id,
                agent_name=agent.full_name,
                commission_rate=rate,
                sales_total=sales,
                commission=commission,
                target=target,
                achievement_pct=round(achievement, 1) if achievement is not None else None,
            )
        )
    out.sort(key=lambda r: r.sales_total, reverse=True)
    return out


@router.get("/product-sales")
async def product_sales(
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> list[dict]:
    """Units sold and revenue per product."""
    stmt = (
        select(
            Product.id,
            Product.name,
            Product.sku,
            func.coalesce(func.sum(SalesOrderLine.quantity), 0),
            func.coalesce(func.sum(SalesOrderLine.line_total), 0),
        )
        .join(SalesOrderLine, SalesOrderLine.product_id == Product.id)
        .join(SalesOrder, SalesOrder.id == SalesOrderLine.sales_order_id)
        .where(SalesOrder.status.notin_(_EXCLUDED))
        .group_by(Product.id, Product.name, Product.sku)
        .order_by(func.sum(SalesOrderLine.line_total).desc())
    )
    if date_from:
        stmt = stmt.where(SalesOrder.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        stmt = stmt.where(SalesOrder.created_at <= datetime.combine(date_to, datetime.max.time()))
    rows = await db.execute(stmt)
    return [
        {"product_id": pid, "name": name, "sku": sku, "units": float(units), "revenue": float(rev)}
        for pid, name, sku, units, rev in rows.all()
    ]


@router.get("/stock-ledger")
async def stock_ledger(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> list[dict]:
    """Chronological stock movements for one product (audit trail)."""
    rows = await db.scalars(
        select(StockMovement)
        .where(StockMovement.product_id == product_id)
        .order_by(StockMovement.id)
    )
    return [
        {
            "id": m.id,
            "type": m.type.value,
            "quantity": float(m.quantity),
            "unit_cost": float(m.unit_cost),
            "reference": m.reference,
            "created_at": m.created_at.isoformat(),
        }
        for m in rows
    ]
