"""Product returns initiated by an agent from a market, approved by a manager.

An agent submits a return against one of their market's orders (PENDING). A manager
approves it — which applies the refund through the normal sales flow (cuts debt,
restock or hold as refunded goods) — or rejects it.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.catalog import Product
from app.models.enums import ReturnRequestStatus, UserRole
from app.models.sales import Customer, ReturnRequest, ReturnRequestLine, SalesOrder
from app.models.user import User
from app.schemas.returns import (
    ReturnApprove,
    ReturnRequestCreate,
    ReturnRequestOut,
)
from app.schemas.sales import RefundLineIn, StatusMoveRequest
from app.models.enums import SalesOrderStatus
from app.services import sales_service

router = APIRouter(prefix="/returns", tags=["returns"])


async def _to_out(db: AsyncSession, r: ReturnRequest) -> ReturnRequestOut:
    customer = await db.get(Customer, r.customer_id)
    agent = await db.get(User, r.agent_id) if r.agent_id else None
    names = dict(
        (
            await db.execute(
                select(Product.id, Product.name).where(
                    Product.id.in_([ln.product_id for ln in r.lines])
                )
            )
        ).all()
    )
    out = ReturnRequestOut.model_validate(r)
    out.customer_name = customer.name if customer else None
    out.agent_name = agent.full_name if agent else None
    out.order_no = str(r.sales_order_id)
    for ln in out.lines:
        ln.product_name = names.get(ln.product_id)
    return out


@router.post("", response_model=ReturnRequestOut, status_code=201)
async def create_return(
    data: ReturnRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReturnRequestOut:
    """Agent submits a product return against one of their orders."""
    order = await db.get(SalesOrder, data.sales_order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if user.role == UserRole.AGENT and order.agent_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your order")

    req = ReturnRequest(
        customer_id=order.customer_id,
        sales_order_id=order.id,
        agent_id=user.id,
        status=ReturnRequestStatus.PENDING,
        note=data.note,
    )
    req.lines = [
        ReturnRequestLine(product_id=ln.product_id, quantity=ln.quantity)
        for ln in data.lines
    ]
    db.add(req)
    await db.flush()
    await db.refresh(req, attribute_names=["lines"])
    return await _to_out(db, req)


@router.get("", response_model=list[ReturnRequestOut])
async def list_returns(
    status_filter: ReturnRequestStatus | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReturnRequestOut]:
    """Agents see their own return requests; managers/admins see all."""
    stmt = (
        select(ReturnRequest)
        .options(selectinload(ReturnRequest.lines))
        .order_by(ReturnRequest.id.desc())
    )
    if user.role == UserRole.AGENT:
        stmt = stmt.where(ReturnRequest.agent_id == user.id)
    if status_filter is not None:
        stmt = stmt.where(ReturnRequest.status == status_filter)
    rows = list(await db.scalars(stmt))
    return [await _to_out(db, r) for r in rows]


@router.post("/{return_id}/approve", response_model=ReturnRequestOut)
async def approve_return(
    return_id: int,
    data: ReturnApprove,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER)),
) -> ReturnRequestOut:
    """Approve a return: applies the refund on the order (cut debt + restock/hold)."""
    req = await db.scalar(
        select(ReturnRequest)
        .where(ReturnRequest.id == return_id)
        .options(selectinload(ReturnRequest.lines))
    )
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Return request not found")
    if req.status != ReturnRequestStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "Return is not pending")

    # Reuse the standard refund flow (partial move → refund with restock choice).
    await sales_service.move_order(
        db,
        manager,
        req.sales_order_id,
        StatusMoveRequest(
            status=SalesOrderStatus.REFUND,
            lines=[RefundLineIn(product_id=ln.product_id, quantity=ln.quantity) for ln in req.lines],
            restock=data.restock,
            note=req.note,
        ),
    )
    req.status = ReturnRequestStatus.APPROVED
    req.reviewed_by_id = manager.id
    req.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    return await _to_out(db, req)


@router.post("/{return_id}/reject", response_model=ReturnRequestOut)
async def reject_return(
    return_id: int,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER)),
) -> ReturnRequestOut:
    req = await db.scalar(
        select(ReturnRequest)
        .where(ReturnRequest.id == return_id)
        .options(selectinload(ReturnRequest.lines))
    )
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Return request not found")
    if req.status != ReturnRequestStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "Return is not pending")
    req.status = ReturnRequestStatus.REJECTED
    req.reviewed_by_id = manager.id
    req.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    return await _to_out(db, req)
