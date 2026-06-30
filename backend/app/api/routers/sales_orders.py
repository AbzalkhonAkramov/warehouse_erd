from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.catalog import Product
from app.models.enums import SalesOrderStatus, UserRole
from app.models.finance import Invoice
from app.models.photo import PhotoReport, PhotoReportImage
from app.models.sales import Customer, OrderStatusHistory, RefundEntry, SalesOrder
from app.models.user import User
from app.schemas.sales import (
    OrderPhotoOut,
    OrderStatusHistoryOut,
    RefundEntryOut,
    SalesOrderCreate,
    SalesOrderOut,
    SalesOrderUpdate,
    StatusMoveRequest,
)
from app.services import sales_service

router = APIRouter(prefix="/sales-orders", tags=["sales-orders"])


async def _parent_chain(db: AsyncSession) -> dict[int, int | None]:
    rows = (await db.execute(select(SalesOrder.id, SalesOrder.parent_order_id))).all()
    return {r.id: r.parent_order_id for r in rows}


def _root_of(parent_of: dict[int, int | None], oid: int) -> int:
    cur, seen = oid, set()
    while parent_of.get(cur) is not None and cur not in seen:
        seen.add(cur)
        cur = parent_of[cur]
    return cur


def _order_nos(parent_of: dict[int, int | None]) -> dict[int, str]:
    """Map each forked order to '<root>.<n>' — root-based at any nesting depth, so a
    fork of a fork still counts under the first-created order, never the fork's id."""
    descendants: dict[int, list[int]] = defaultdict(list)
    for oid in parent_of:
        root = _root_of(parent_of, oid)
        if root != oid:
            descendants[root].append(oid)
    out: dict[int, str] = {}
    for root, kids in descendants.items():
        for i, kid in enumerate(sorted(kids), start=1):
            out[kid] = f"{root}.{i}"
    return out


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

    fork_no = _order_nos(await _parent_chain(db))

    out: list[SalesOrderOut] = []
    for order, owner_name, creator_name in (await db.execute(stmt)).all():
        row = SalesOrderOut.model_validate(order)
        row.agent_name = owner_name
        row.created_by_name = creator_name
        row.order_no = fork_no.get(order.id, str(order.id))
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
    tree: bool = False,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> list[OrderStatusHistoryOut]:
    """Status-move history. With ``tree=true`` and an order_id, returns the whole
    order tree (the root and all its forks), each row tagged with its order number."""
    parent_of = await _parent_chain(db)
    order_nos = _order_nos(parent_of)

    stmt = (
        select(OrderStatusHistory, User.full_name)
        .outerjoin(User, User.id == OrderStatusHistory.changed_by_id)
        .order_by(OrderStatusHistory.id.desc())
    )
    if order_id is not None:
        if tree:
            root = _root_of(parent_of, order_id)
            ids = [oid for oid in parent_of if _root_of(parent_of, oid) == root]
            stmt = stmt.where(OrderStatusHistory.sales_order_id.in_(ids))
        else:
            stmt = stmt.where(OrderStatusHistory.sales_order_id == order_id)

    out: list[OrderStatusHistoryOut] = []
    for entry, name in (await db.execute(stmt)).all():
        row = OrderStatusHistoryOut.model_validate(entry)
        row.changed_by_name = name
        row.order_no = order_nos.get(entry.sales_order_id, str(entry.sales_order_id))
        if entry.related_order_id is not None:
            row.related_order_no = order_nos.get(
                entry.related_order_id, str(entry.related_order_id)
            )
        out.append(row)
    return out


@router.get("/{order_id}", response_model=SalesOrderOut)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SalesOrderOut:
    owner = aliased(User)
    creator = aliased(User)
    row = (
        await db.execute(
            select(SalesOrder, owner.full_name, creator.full_name)
            .outerjoin(owner, owner.id == SalesOrder.agent_id)
            .outerjoin(creator, creator.id == SalesOrder.created_by_id)
            .options(selectinload(SalesOrder.lines))
            .where(SalesOrder.id == order_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    order, owner_name, creator_name = row
    if user.role == UserRole.AGENT and order.agent_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your order")

    fork_no = _order_nos(await _parent_chain(db))
    invoice = await db.scalar(select(Invoice.number).where(Invoice.sales_order_id == order.id))

    # Before/after photos pinned to this order, plus the agent's "important" flag.
    photo_rows = (
        await db.execute(
            select(PhotoReportImage.stage, PhotoReportImage.telegram_link)
            .join(PhotoReport, PhotoReportImage.report_id == PhotoReport.id)
            .where(PhotoReport.sales_order_id == order.id)
            .order_by(PhotoReportImage.stage, PhotoReportImage.id)
        )
    ).all()
    agent_important = await db.scalar(
        select(User.photo_required).where(User.id == order.agent_id)
    )

    out = SalesOrderOut.model_validate(order)
    out.agent_name = owner_name
    out.created_by_name = creator_name
    out.order_no = fork_no.get(order.id, str(order.id))
    out.invoice_number = invoice
    out.agent_photo_required = bool(agent_important)
    out.photos = [OrderPhotoOut(stage=s.value, link=link) for s, link in photo_rows]
    # Complete only when both stages actually reached Telegram (have a link).
    have = {s for s, link in photo_rows if link}
    out.photo_complete = len(have) >= 2  # both BEFORE and AFTER present

    names = dict(
        (
            await db.execute(
                select(Product.id, Product.name).where(
                    Product.id.in_([ln.product_id for ln in order.lines])
                )
            )
        ).all()
    )
    for ln in out.lines:
        ln.product_name = names.get(ln.product_id)
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
