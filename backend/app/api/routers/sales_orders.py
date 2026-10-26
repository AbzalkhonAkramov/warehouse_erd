from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.refcodes import format_ref
from app.models.catalog import Product
from app.models.enums import SalesOrderStatus, UserRole
from app.models.photo import PhotoReport, PhotoReportImage
from app.models.sales import Customer, OrderStatusHistory, RefundEntry, SalesOrder
from app.models.setting import CompanySettings
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
from app.services import receipt_xlsx, sales_service

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

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


# Human-readable order reference: a 3-letter alphabetic code + 3-digit number
# (AAA001, AAA002, …). Forks keep the parent code plus ".<n>" (AAA001.1).
def _fmt_order_no(oid: int, fork_map: dict[int, str]) -> str:
    ref = fork_map.get(oid)
    if ref:
        root_str, i = ref.split(".", 1)
        return f"{format_ref(int(root_str), 3)}.{i}"
    return format_ref(oid, 3)


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
        select(SalesOrder, owner.full_name, creator.full_name, Customer.name, Customer.address)
        .outerjoin(owner, owner.id == SalesOrder.agent_id)
        .outerjoin(creator, creator.id == SalesOrder.created_by_id)
        .outerjoin(Customer, Customer.id == SalesOrder.customer_id)
        .options(selectinload(SalesOrder.lines))
        .where(SalesOrder.archived.is_(archived))
        .order_by(SalesOrder.id.desc())
    )
    # Agents only ever see their own orders; deliverers only see orders assigned
    # to them; managers/admins see everyone's.
    if user.role == UserRole.AGENT:
        stmt = stmt.where(SalesOrder.agent_id == user.id)
    elif user.role == UserRole.DELIVERER:
        stmt = stmt.where(SalesOrder.deliverer_id == user.id)
    if status_filter is not None:
        stmt = stmt.where(SalesOrder.status == status_filter)

    fork_no = _order_nos(await _parent_chain(db))

    out: list[SalesOrderOut] = []
    for order, owner_name, creator_name, cust_name, cust_addr in (await db.execute(stmt)).all():
        row = SalesOrderOut.model_validate(order)
        row.agent_name = owner_name
        row.created_by_name = creator_name
        row.customer_name = cust_name
        row.customer_address = cust_addr
        row.order_no = _fmt_order_no(order.id, fork_no)
        out.append(row)

    # Fill product names on every line so clients show names, not "#id".
    prod_ids = {ln.product_id for row in out for ln in row.lines}
    if prod_ids:
        names = dict(
            (await db.execute(
                select(Product.id, Product.name).where(Product.id.in_(prod_ids))
            )).all()
        )
        for row in out:
            for ln in row.lines:
                ln.product_name = names.get(ln.product_id)
    return out


async def _receipt_dicts(db: AsyncSession, orders: list[SalesOrder]) -> tuple[list[dict], str, str]:
    """Build the plain dicts the Excel receipt generator expects, for the given orders."""
    fork_no = _order_nos(await _parent_chain(db))
    s = await db.scalar(select(CompanySettings).limit(1))
    company_name = s.company_name if s else "ERP"
    lang = s.excel_lang if s else "ru"

    pids = {ln.product_id for o in orders for ln in o.lines}
    pnames = (
        dict((await db.execute(select(Product.id, Product.name).where(Product.id.in_(pids)))).all())
        if pids else {}
    )
    cids = {o.customer_id for o in orders}
    custs = {c.id: c for c in await db.scalars(select(Customer).where(Customer.id.in_(cids)))}
    aids = {o.agent_id for o in orders}
    anames = dict(
        (await db.execute(select(User.id, User.full_name).where(User.id.in_(aids)))).all()
    )

    dicts: list[dict] = []
    for o in orders:
        cust = custs.get(o.customer_id)
        dicts.append({
            "order_no": _fmt_order_no(o.id, fork_no),
            "date": o.created_at.strftime("%d.%m.%Y"),
            "status": o.status.value,
            "customer_name": cust.name if cust else f"#{o.customer_id}",
            "city": cust.city if cust else None,
            "address": cust.address if cust else None,
            "phone": cust.phone if cust else None,
            "agent_name": anames.get(o.agent_id, f"#{o.agent_id}"),
            "deliverer": o.deliverer,
            "lines": [
                {
                    "name": pnames.get(ln.product_id, f"#{ln.product_id}"),
                    "quantity": float(ln.quantity),
                    "unit_price": float(ln.unit_price),
                    "line_total": float(ln.line_total),
                }
                for ln in o.lines
            ],
            "total_qty": float(sum(ln.quantity for ln in o.lines)),
            "subtotal": float(o.subtotal),
            "total": float(o.total),
        })
    return dicts, company_name, lang


async def _orders_for_receipt(db: AsyncSession, ids: list[int], user: User) -> list[SalesOrder]:
    rows = list(
        await db.scalars(
            select(SalesOrder)
            .where(SalesOrder.id.in_(ids))
            .options(selectinload(SalesOrder.lines))
        )
    )
    # Agents only get their own orders; deliverers only their assigned ones.
    if user.role == UserRole.AGENT:
        rows = [o for o in rows if o.agent_id == user.id]
    elif user.role == UserRole.DELIVERER:
        rows = [o for o in rows if o.deliverer_id == user.id]
    by_id = {o.id: o for o in rows}
    return [by_id[i] for i in ids if i in by_id]  # preserve requested order


@router.get("/receipts.xlsx")
async def bulk_receipts_xlsx(
    ids: str = Query(..., description="Comma-separated order ids"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """One .xlsx with a receipt per order (2 copies side by side, landscape), each on
    its own printable page — so a whole selection prints in one go."""
    try:
        id_list = [int(x) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid order ids") from None
    orders = await _orders_for_receipt(db, id_list, user)
    if not orders:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No matching orders")
    dicts, name, lang = await _receipt_dicts(db, orders)
    content = receipt_xlsx.build_receipts_xlsx(dicts, name, lang)
    return Response(
        content=content,
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="receipts.xlsx"'},
    )


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
        row.order_no = _fmt_order_no(entry.sales_order_id, order_nos)
        if entry.related_order_id is not None:
            row.related_order_no = _fmt_order_no(entry.related_order_id, order_nos)
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
    if user.role == UserRole.DELIVERER and order.deliverer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your delivery")

    fork_no = _order_nos(await _parent_chain(db))

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

    customer = await db.get(Customer, order.customer_id)

    out = SalesOrderOut.model_validate(order)
    out.agent_name = owner_name
    out.created_by_name = creator_name
    out.customer_name = customer.name if customer else None
    out.customer_address = customer.address if customer else None
    out.order_no = _fmt_order_no(order.id, fork_no)
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


class BulkMoveRequest(BaseModel):
    ids: list[int]
    status: SalesOrderStatus


class BulkMoveResult(BaseModel):
    moved: int
    failed: dict[int, str] = {}


@router.post("/bulk-move", response_model=BulkMoveResult)
async def bulk_move(
    data: BulkMoveRequest,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER)),
) -> BulkMoveResult:
    """Move several whole orders to a status in one go (checkbox selection)."""
    moved = 0
    failed: dict[int, str] = {}
    for oid in data.ids:
        try:
            await sales_service.move_order(db, manager, oid, StatusMoveRequest(status=data.status))
            moved += 1
        except HTTPException as exc:
            failed[oid] = str(exc.detail)
    return BulkMoveResult(moved=moved, failed=failed)


@router.get("/{order_id}/receipt.xlsx")
async def receipt_xlsx_single(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """A single order's receipt as .xlsx (2 copies side by side, landscape)."""
    orders = await _orders_for_receipt(db, [order_id], user)
    if not orders:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    dicts, name, lang = await _receipt_dicts(db, orders)
    content = receipt_xlsx.build_receipts_xlsx(dicts, name, lang)
    return Response(
        content=content,
        media_type=_XLSX_MIME,
        headers={
            "Content-Disposition": f'attachment; filename="receipt-{dicts[0]["order_no"]}.xlsx"'
        },
    )


async def _set_archived(db: AsyncSession, order_id: int, value: bool) -> SalesOrder:
    order = await db.scalar(
        select(SalesOrder)
        .where(SalesOrder.id == order_id)
        .options(selectinload(SalesOrder.lines))
    )
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    order.archived = value
    await db.flush()
    return order


@router.post("/{order_id}/archive", response_model=SalesOrderOut)
async def archive_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> SalesOrder:
    """Manually move an order to the archive. Archiving is a manual action — orders
    are no longer archived automatically."""
    return await _set_archived(db, order_id, True)


@router.post("/{order_id}/unarchive", response_model=SalesOrderOut)
async def unarchive_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> SalesOrder:
    """Return an order from the archive to the active list."""
    return await _set_archived(db, order_id, False)
