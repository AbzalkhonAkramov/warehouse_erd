from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.catalog import Product
from app.models.enums import SalesOrderStatus, UserRole
from app.models.sales import Customer, OrderStatusHistory, RefundEntry, SalesOrder
from app.models.user import User
from app.schemas.sales import (
    OrderStatusHistoryOut,
    RefundEntryOut,
    SalesOrderCreate,
    SalesOrderOut,
    SalesOrderUpdate,
    StatusMoveRequest,
)
from app.services import sales_service

router = APIRouter(prefix="/sales-orders", tags=["sales-orders"])


@router.get("", response_model=list[SalesOrderOut])
async def list_orders(
    status_filter: SalesOrderStatus | None = None,
    archived: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SalesOrderOut]:
    owner = aliased(User)
    creator = aliased(User)
    stmt = (
        select(SalesOrder, owner.full_name, creator.full_name)
        .outerjoin(owner, owner.id == SalesOrder.agent_id)
        .outerjoin(creator, creator.id == SalesOrder.created_by_id)
        .options(selectinload(SalesOrder.lines))
        .where(SalesOrder.archived.is_(archived))
        .order_by(SalesOrder.id.desc())
    )
    # Agents only ever see their own orders; managers/admins see everyone's, with
    # the owner and creator name attached.
    if user.role == UserRole.AGENT:
        stmt = stmt.where(SalesOrder.agent_id == user.id)
    if status_filter is not None:
        stmt = stmt.where(SalesOrder.status == status_filter)

    out: list[SalesOrderOut] = []
    for order, owner_name, creator_name in (await db.execute(stmt)).all():
        row = SalesOrderOut.model_validate(order)
        row.agent_name = owner_name
        row.created_by_name = creator_name
        out.append(row)
    return out


@router.get("/refunds", response_model=list[RefundEntryOut])
async def list_refunds(
    customer_id: int | None = None,
    agent_id: int | None = None,
    product_id: int | None = None,
    restocked: bool | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> list[RefundEntryOut]:
    stmt = (
        select(RefundEntry, Product.name, Customer.name, User.full_name)
        .join(Product, Product.id == RefundEntry.product_id)
        .join(Customer, Customer.id == RefundEntry.customer_id)
        .outerjoin(User, User.id == RefundEntry.agent_id)
        .order_by(RefundEntry.id.desc())
    )
    if customer_id is not None:
        stmt = stmt.where(RefundEntry.customer_id == customer_id)
    if agent_id is not None:
        stmt = stmt.where(RefundEntry.agent_id == agent_id)
    if product_id is not None:
        stmt = stmt.where(RefundEntry.product_id == product_id)
    if restocked is not None:
        stmt = stmt.where(RefundEntry.restocked.is_(restocked))
    if date_from is not None:
        stmt = stmt.where(RefundEntry.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to is not None:
        stmt = stmt.where(RefundEntry.created_at <= datetime.combine(date_to, datetime.max.time()))

    out: list[RefundEntryOut] = []
    for entry, product_name, customer_name, agent_name in (await db.execute(stmt)).all():
        row = RefundEntryOut.model_validate(entry)
        row.product_name = product_name
        row.customer_name = customer_name
        row.agent_name = agent_name
        out.append(row)
    return out


@router.get("/status-history", response_model=list[OrderStatusHistoryOut])
async def status_history(
    order_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> list[OrderStatusHistoryOut]:
    stmt = (
        select(OrderStatusHistory, User.full_name)
        .outerjoin(User, User.id == OrderStatusHistory.changed_by_id)
        .order_by(OrderStatusHistory.id.desc())
    )
    if order_id is not None:
        stmt = stmt.where(OrderStatusHistory.sales_order_id == order_id)

    out: list[OrderStatusHistoryOut] = []
    for entry, name in (await db.execute(stmt)).all():
        row = OrderStatusHistoryOut.model_validate(entry)
        row.changed_by_name = name
        out.append(row)
    return out


@router.post("", response_model=SalesOrderOut, status_code=201)
async def create_order(
    data: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    creator: User = Depends(get_current_user),
) -> SalesOrder:
    return await sales_service.create_order(db, creator, data)


@router.patch("/{order_id}", response_model=SalesOrderOut)
async def update_order(
    order_id: int,
    data: SalesOrderUpdate,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER)),
) -> SalesOrder:
    """Manager/admin only: set the deliverer (while New) or the note."""
    return await sales_service.update_order(db, manager, order_id, data)


@router.post("/{order_id}/move", response_model=SalesOrderOut)
async def move_order(
    order_id: int,
    data: StatusMoveRequest,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER)),
) -> SalesOrder:
    """Move an order to a status. No lines = whole order; with lines a partial amount
    moves and the order forks (the rest keeps its old status)."""
    return await sales_service.move_order(db, manager, order_id, data)
