from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import PurchaseOrderStatus, UserRole
from app.models.purchasing import PurchaseOrder
from app.models.user import User
from app.schemas.purchasing import GoodsReceipt, PurchaseOrderCreate, PurchaseOrderOut
from app.services import purchasing_service

router = APIRouter(prefix="/purchase-orders", tags=["purchasing"])

_MANAGER_OR_WAREHOUSE = require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)


@router.get("", response_model=list[PurchaseOrderOut])
async def list_purchase_orders(
    status_filter: PurchaseOrderStatus | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_MANAGER_OR_WAREHOUSE),
) -> list[PurchaseOrder]:
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .order_by(PurchaseOrder.id.desc())
    )
    if status_filter is not None:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    return list(await db.scalars(stmt))


@router.get("/{po_id}", response_model=PurchaseOrderOut)
async def get_purchase_order(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_MANAGER_OR_WAREHOUSE),
) -> PurchaseOrder:
    po = await db.scalar(
        select(PurchaseOrder)
        .where(PurchaseOrder.id == po_id)
        .options(selectinload(PurchaseOrder.lines))
    )
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    return po


@router.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_MANAGER_OR_WAREHOUSE),
) -> PurchaseOrder:
    return await purchasing_service.create_purchase_order(db, user, data)


@router.post("/{po_id}/receive", response_model=PurchaseOrderOut)
async def receive_goods(
    po_id: int,
    data: GoodsReceipt,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_MANAGER_OR_WAREHOUSE),
) -> PurchaseOrder:
    return await purchasing_service.receive_goods(db, user, po_id, data)
