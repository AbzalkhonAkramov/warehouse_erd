from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.catalog import Product, Warehouse
from app.models.enums import StockMovementType, UserRole
from app.models.inventory import Stock, StockMovement
from app.models.user import User

router = APIRouter(prefix="/inventory", tags=["inventory"])


class StockOut(BaseModel):
    product_id: int
    product_name: str
    sku: str
    warehouse_id: int
    quantity: Decimal
    min_stock: Decimal
    low: bool


class StockAdjustIn(BaseModel):
    product_id: int
    warehouse_id: int | None = None
    quantity: Decimal = Field(description="Signed delta: +receipt, -adjustment out")
    type: StockMovementType = StockMovementType.ADJUSTMENT
    unit_cost: Decimal = Decimal("0")
    note: str | None = None


async def _default_warehouse_id(db: AsyncSession) -> int:
    wh = await db.scalar(select(Warehouse).where(Warehouse.is_default).limit(1))
    if wh is None:
        wh = await db.scalar(select(Warehouse).order_by(Warehouse.id).limit(1))
    if wh is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No warehouse configured")
    return wh.id


@router.get("/stock", response_model=list[StockOut])
async def list_stock(
    low_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[StockOut]:
    rows = await db.execute(
        select(Stock, Product).join(Product, Product.id == Stock.product_id)
    )
    out: list[StockOut] = []
    for stock, product in rows.all():
        low = Decimal(stock.quantity) <= Decimal(product.min_stock)
        if low_only and not low:
            continue
        out.append(
            StockOut(
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                warehouse_id=stock.warehouse_id,
                quantity=Decimal(stock.quantity),
                min_stock=Decimal(product.min_stock),
                low=low,
            )
        )
    return out


@router.post("/adjust", status_code=status.HTTP_201_CREATED)
async def adjust_stock(
    data: StockAdjustIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.WAREHOUSE, UserRole.MANAGER)),
) -> dict:
    """Manually receive stock or correct a count. Records a StockMovement."""
    warehouse_id = data.warehouse_id or await _default_warehouse_id(db)
    stock = await db.scalar(
        select(Stock).where(
            Stock.product_id == data.product_id, Stock.warehouse_id == warehouse_id
        )
    )
    if stock is None:
        stock = Stock(product_id=data.product_id, warehouse_id=warehouse_id, quantity=Decimal("0"))
        db.add(stock)
    new_qty = Decimal(stock.quantity) + Decimal(data.quantity)
    if new_qty < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Stock cannot go negative")
    stock.quantity = new_qty
    db.add(
        StockMovement(
            product_id=data.product_id,
            warehouse_id=warehouse_id,
            type=data.type,
            quantity=data.quantity,
            unit_cost=data.unit_cost,
            note=data.note,
            created_by_id=user.id,
        )
    )
    await db.flush()
    return {"product_id": data.product_id, "quantity": float(stock.quantity)}
