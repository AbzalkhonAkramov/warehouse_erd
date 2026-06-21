from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.enums import SalesOrderStatus, UserRole
from app.models.sales import SalesOrder
from app.models.user import User
from app.schemas.sales import SalesOrderCreate, SalesOrderOut, SalesOrderReject
from app.services import sales_service

router = APIRouter(prefix="/sales-orders", tags=["sales-orders"])


@router.get("", response_model=list[SalesOrderOut])
async def list_orders(
    status_filter: SalesOrderStatus | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SalesOrder]:
    stmt = (
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines))
        .order_by(SalesOrder.id.desc())
    )
    if user.role == UserRole.AGENT:
        stmt = stmt.where(SalesOrder.agent_id == user.id)
    if status_filter is not None:
        stmt = stmt.where(SalesOrder.status == status_filter)
    return list(await db.scalars(stmt))


@router.post("", response_model=SalesOrderOut, status_code=201)
async def create_order(
    data: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    agent: User = Depends(get_current_user),
) -> SalesOrder:
    return await sales_service.create_order(db, agent, data)


@router.post("/{order_id}/approve", response_model=SalesOrderOut)
async def approve_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER)),
) -> SalesOrder:
    return await sales_service.approve_order(db, manager, order_id)


@router.post("/{order_id}/reject", response_model=SalesOrderOut)
async def reject_order(
    order_id: int,
    body: SalesOrderReject,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER)),
) -> SalesOrder:
    return await sales_service.reject_order(db, manager, order_id, body.reason)


@router.post("/{order_id}/pick", response_model=SalesOrderOut)
async def mark_picking(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.WAREHOUSE, UserRole.MANAGER)),
) -> SalesOrder:
    return await sales_service.advance_status(db, user, order_id, SalesOrderStatus.PICKING)


@router.post("/{order_id}/deliver", response_model=SalesOrderOut)
async def mark_delivered(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.WAREHOUSE, UserRole.MANAGER)),
) -> SalesOrder:
    return await sales_service.advance_status(db, user, order_id, SalesOrderStatus.DELIVERED)


@router.post("/{order_id}/cancel", response_model=SalesOrderOut)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.MANAGER)),
) -> SalesOrder:
    return await sales_service.cancel_order(db, user, order_id)
