from decimal import Decimal, InvalidOperation
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from openpyxl import Workbook, load_workbook
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.refcodes import format_ref
from app.core.xlsx_i18n import excel_lang, headers as _xh
from app.models.catalog import Product, Supplier
from app.models.enums import PurchaseOrderStatus, UserRole
from app.models.inventory import Stock
from app.models.purchasing import PurchaseOrder
from app.models.user import User
from app.schemas.imports import BulkImportResult
from app.schemas.purchasing import (
    GoodsReceipt,
    PurchaseOrderCreate,
    PurchaseOrderLineCreate,
    PurchaseOrderOut,
)
from app.services import purchasing_service

router = APIRouter(prefix="/purchase-orders", tags=["purchasing"])

_MANAGER_OR_WAREHOUSE = require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)
_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def _enrich(db: AsyncSession, pos: list[PurchaseOrder]) -> list[PurchaseOrderOut]:
    """Attach product and supplier names for display."""
    prod_ids = {ln.product_id for po in pos for ln in po.lines}
    sup_ids = {po.supplier_id for po in pos if po.supplier_id is not None}
    pnames = dict(
        (await db.execute(select(Product.id, Product.name).where(Product.id.in_(prod_ids)))).all()
    ) if prod_ids else {}
    snames = dict(
        (await db.execute(select(Supplier.id, Supplier.name).where(Supplier.id.in_(sup_ids)))).all()
    ) if sup_ids else {}
    out: list[PurchaseOrderOut] = []
    for po in pos:
        item = PurchaseOrderOut.model_validate(po)
        item.ref = format_ref(po.id, 2)
        item.supplier_name = snames.get(po.supplier_id) if po.supplier_id else None
        for line in item.lines:
            line.product_name = pnames.get(line.product_id)
        out.append(item)
    return out


@router.get("", response_model=list[PurchaseOrderOut])
async def list_purchase_orders(
    status_filter: PurchaseOrderStatus | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_MANAGER_OR_WAREHOUSE),
) -> list[PurchaseOrderOut]:
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .order_by(PurchaseOrder.id.desc())
    )
    if status_filter is not None:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    return await _enrich(db, list(await db.scalars(stmt)))


@router.get("/template")
async def incoming_template(
    category_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_MANAGER_OR_WAREHOUSE),
) -> Response:
    """A goods-receipt sheet listing products (optionally filtered by category) with
    blank Quantity + Unit cost columns. Declared before /{po_id}."""
    lang = await excel_lang(db)
    stmt = select(Product).where(Product.is_active.is_(True)).order_by(Product.name)
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    products = list(await db.scalars(stmt))
    qty_map = {
        pid: q
        for pid, q in (
            await db.execute(
                select(Stock.product_id, func.coalesce(func.sum(Stock.quantity), 0)).group_by(
                    Stock.product_id
                )
            )
        ).all()
    }
    wb = Workbook()
    ws = wb.active
    ws.title = "Incoming"
    ws.append(_xh(["Product ID", "Name", "In stock", "Quantity", "Unit cost"], lang))
    for p in products:
        # Prefill current cost as a hint; blank Quantity = not received.
        ws.append([p.id, p.name, float(qty_map.get(p.id, 0)), None, float(p.cost_price or 0)])
    buf = BytesIO()
    wb.save(buf)
    return Response(
        content=buf.getvalue(),
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="incoming-template.xlsx"'},
    )


@router.post("/import", response_model=BulkImportResult)
async def incoming_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_MANAGER_OR_WAREHOUSE),
) -> BulkImportResult:
    """Bulk goods receipt: reads Product ID + Quantity + Unit cost, creates one
    receipt and posts it to stock. Rows with a blank/zero Quantity are skipped."""
    try:
        wb = load_workbook(BytesIO(await file.read()), data_only=True)
    except Exception:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Could not read the Excel file (.xlsx expected)"
        ) from None
    ws = wb.worksheets[0]
    valid_ids = set(await db.scalars(select(Product.id)))

    lines: list[PurchaseOrderLineCreate] = []
    skipped = 0
    errors: list[str] = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        cell = lambda i: row[i] if row and len(row) > i else None  # noqa: E731
        pid_raw, qty_raw, cost_raw = cell(0), cell(3), cell(4)
        if qty_raw in (None, "", 0):
            if pid_raw not in (None, ""):
                skipped += 1
            continue
        try:
            pid = int(pid_raw)
            qty = Decimal(str(qty_raw))
        except (TypeError, ValueError, InvalidOperation):
            errors.append(f"Row {idx}: invalid id/quantity")
            continue
        if pid not in valid_ids:
            errors.append(f"Row {idx}: product #{pid} not found")
            continue
        if qty <= 0:
            skipped += 1
            continue
        try:
            cost = Decimal(str(cost_raw)) if cost_raw not in (None, "") else Decimal("0")
        except (InvalidOperation, ValueError):
            cost = Decimal("0")
        lines.append(PurchaseOrderLineCreate(product_id=pid, quantity=qty, unit_cost=cost))

    if not lines:
        return BulkImportResult(created=0, skipped=skipped, errors=errors[:50])

    po = await purchasing_service.create_purchase_order(
        db, user, PurchaseOrderCreate(supplier_id=None, lines=lines)
    )
    await purchasing_service.receive_goods(db, user, po.id, GoodsReceipt(lines=[]))
    return BulkImportResult(created=len(lines), skipped=skipped, errors=errors[:50])


@router.get("/{po_id}", response_model=PurchaseOrderOut)
async def get_purchase_order(
    po_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_MANAGER_OR_WAREHOUSE),
) -> PurchaseOrderOut:
    po = await db.scalar(
        select(PurchaseOrder)
        .where(PurchaseOrder.id == po_id)
        .options(selectinload(PurchaseOrder.lines))
    )
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    return (await _enrich(db, [po]))[0]


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
