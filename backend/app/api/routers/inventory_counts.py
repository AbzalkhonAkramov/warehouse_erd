"""Stocktaking (инвентаризация): a manager starts a count, which snapshots the
system quantity of every active product, enters the physically counted amount
next to it, and completes the count — applying the differences to stock as
ADJUSTMENT movements. Past counts are kept as history.
"""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.catalog import Product
from app.models.enums import StockCountStatus, StockMovementType, UserRole
from app.models.inventory import Stock, StockCount, StockCountLine, StockMovement
from app.models.user import User

router = APIRouter(prefix="/inventory/counts", tags=["inventory"])

_MANAGE = require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)

# Statuses that may still be edited / completed / cancelled.
_EDITABLE = (StockCountStatus.OPEN, StockCountStatus.DRAFT)


# --- Schemas ---------------------------------------------------------------

class CountLineOut(BaseModel):
    product_id: int
    product_name: str
    sku: str
    unit: str
    image_path: str | None = None
    system_qty: Decimal
    counted_qty: Decimal | None = None
    difference: Decimal | None = None
    # After completion: True = difference applied to stock, False = excluded
    # (exception) or report-only; null while the count is still open/draft.
    applied: bool | None = None


class CountDetailOut(BaseModel):
    id: int
    status: StockCountStatus
    note: str | None = None
    apply_stock: bool = True
    created_at: datetime
    completed_at: datetime | None = None
    created_by_name: str | None = None
    completed_by_name: str | None = None
    lines: list[CountLineOut]


class CountSummaryOut(BaseModel):
    id: int
    status: StockCountStatus
    note: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    created_by_name: str | None = None
    total_products: int
    counted: int
    discrepancies: int


class CountLineIn(BaseModel):
    product_id: int
    counted_qty: Decimal | None = None


class CountLinesIn(BaseModel):
    lines: list[CountLineIn]


class CountCompleteIn(BaseModel):
    # True = correct stock by the counted amounts; False = record the count as a
    # report only, leaving stock untouched.
    apply: bool = True
    # SKUs excluded from the correction (exceptions); their stock is left as-is
    # and they are listed separately. Only meaningful when apply is True.
    exclude_product_ids: list[int] = []
    # Optional final set of counted quantities to save before applying.
    lines: list[CountLineIn] | None = None


class CountCreateIn(BaseModel):
    note: str | None = None
    draft: bool = False


# --- Helpers ---------------------------------------------------------------

async def _default_warehouse_id(db: AsyncSession) -> int:
    from app.models.catalog import Warehouse

    wh = await db.scalar(select(Warehouse).where(Warehouse.is_default).limit(1))
    if wh is None:
        wh = await db.scalar(select(Warehouse).order_by(Warehouse.id).limit(1))
    if wh is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No warehouse configured")
    return wh.id


async def _name_map(db: AsyncSession, ids: set[int]) -> dict[int, str]:
    if not ids:
        return {}
    rows = (
        await db.execute(select(User.id, User.full_name).where(User.id.in_(ids)))
    ).all()
    return {uid: name for uid, name in rows}


async def _detail(db: AsyncSession, count: StockCount) -> CountDetailOut:
    products = {
        p.id: p
        for p in await db.scalars(
            select(Product).where(
                Product.id.in_([ln.product_id for ln in count.lines])
            )
        )
    }
    names = await _name_map(
        db, {i for i in (count.created_by_id, count.completed_by_id) if i}
    )
    lines: list[CountLineOut] = []
    for ln in sorted(count.lines, key=lambda x: products.get(x.product_id).name if products.get(x.product_id) else ""):
        p = products.get(ln.product_id)
        counted = None if ln.counted_qty is None else Decimal(ln.counted_qty)
        diff = None if counted is None else counted - Decimal(ln.system_qty)
        lines.append(
            CountLineOut(
                product_id=ln.product_id,
                product_name=p.name if p else f"#{ln.product_id}",
                sku=p.sku if p else "",
                unit=p.unit if p else "",
                image_path=p.image_path if p else None,
                system_qty=Decimal(ln.system_qty),
                counted_qty=counted,
                difference=diff,
                applied=ln.applied,
            )
        )
    return CountDetailOut(
        id=count.id,
        status=count.status,
        note=count.note,
        apply_stock=count.apply_stock,
        created_at=count.created_at,
        completed_at=count.completed_at,
        created_by_name=names.get(count.created_by_id),
        completed_by_name=names.get(count.completed_by_id),
        lines=lines,
    )


async def _load(db: AsyncSession, count_id: int) -> StockCount:
    count = await db.scalar(
        select(StockCount)
        .where(StockCount.id == count_id)
        .options(selectinload(StockCount.lines))
    )
    if count is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stock count not found")
    return count


# --- Endpoints -------------------------------------------------------------

@router.get("", response_model=list[CountSummaryOut])
async def list_counts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CountSummaryOut]:
    counts = list(
        await db.scalars(
            select(StockCount)
            .options(selectinload(StockCount.lines))
            .order_by(StockCount.id.desc())
        )
    )
    names = await _name_map(db, {c.created_by_id for c in counts if c.created_by_id})
    out: list[CountSummaryOut] = []
    for c in counts:
        counted = [ln for ln in c.lines if ln.counted_qty is not None]
        disc = sum(
            1 for ln in counted if Decimal(ln.counted_qty) != Decimal(ln.system_qty)
        )
        out.append(
            CountSummaryOut(
                id=c.id,
                status=c.status,
                note=c.note,
                created_at=c.created_at,
                completed_at=c.completed_at,
                created_by_name=names.get(c.created_by_id),
                total_products=len(c.lines),
                counted=len(counted),
                discrepancies=disc,
            )
        )
    return out


@router.post("", response_model=CountDetailOut, status_code=status.HTTP_201_CREATED)
async def start_count(
    data: CountCreateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_MANAGE),
) -> CountDetailOut:
    """Start a new stocktake: snapshot the current quantity of every active
    product. The manager then enters the counted amounts."""
    warehouse_id = await _default_warehouse_id(db)
    products = list(
        await db.scalars(
            select(Product).where(Product.is_active.is_(True)).order_by(Product.name)
        )
    )
    qty_map = {
        pid: q
        for pid, q in (
            await db.execute(
                select(Stock.product_id, Stock.quantity).where(
                    Stock.warehouse_id == warehouse_id
                )
            )
        ).all()
    }
    count = StockCount(
        warehouse_id=warehouse_id,
        status=StockCountStatus.DRAFT if data.draft else StockCountStatus.OPEN,
        note=data.note,
        created_by_id=user.id,
    )
    count.lines = [
        StockCountLine(
            product_id=p.id,
            system_qty=Decimal(qty_map.get(p.id, 0)),
            counted_qty=None,
        )
        for p in products
    ]
    db.add(count)
    await db.flush()
    await db.refresh(count, attribute_names=["lines"])
    return await _detail(db, count)


@router.get("/{count_id}", response_model=CountDetailOut)
async def get_count(
    count_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CountDetailOut:
    return await _detail(db, await _load(db, count_id))


@router.put("/{count_id}/lines", response_model=CountDetailOut)
async def save_lines(
    count_id: int,
    data: CountLinesIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_MANAGE),
) -> CountDetailOut:
    """Save the counted quantities on an open/draft count (without applying)."""
    count = await _load(db, count_id)
    if count.status not in _EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Count is not editable")
    by_product = {ln.product_id: ln for ln in count.lines}
    for item in data.lines:
        ln = by_product.get(item.product_id)
        if ln is None:
            continue
        if item.counted_qty is not None and item.counted_qty < 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Counted quantity cannot be negative"
            )
        ln.counted_qty = item.counted_qty
    await db.flush()
    await db.refresh(count, attribute_names=["lines"])
    return await _detail(db, count)


@router.post("/{count_id}/complete", response_model=CountDetailOut)
async def complete_count(
    count_id: int,
    data: CountCompleteIn | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_MANAGE),
) -> CountDetailOut:
    """Complete a count. When ``apply`` is True (default), every counted product
    has its stock set to the counted amount and an ADJUSTMENT movement recorded
    for the difference — except SKUs listed in ``exclude_product_ids``, which are
    kept as exceptions (stock untouched) and flagged separately. When ``apply``
    is False the count is recorded as a report only and no stock is changed."""
    count = await _load(db, count_id)
    if count.status not in _EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Count is not editable")

    data = data or CountCompleteIn()

    # Accept a final set of counted quantities on completion (optional).
    if data.lines is not None:
        by_product = {ln.product_id: ln for ln in count.lines}
        for item in data.lines:
            ln = by_product.get(item.product_id)
            if ln is None:
                continue
            if item.counted_qty is not None and item.counted_qty < 0:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Counted quantity cannot be negative"
                )
            ln.counted_qty = item.counted_qty

    count.apply_stock = data.apply
    excluded = set(data.exclude_product_ids)

    for ln in count.lines:
        if ln.counted_qty is None:
            ln.applied = None  # product not counted — leave its stock untouched
            continue
        # Report-only completion, or this SKU is an exception: record but don't
        # touch stock.
        if not data.apply or ln.product_id in excluded:
            ln.applied = False
            continue
        counted = Decimal(ln.counted_qty)
        stock = await db.scalar(
            select(Stock).where(
                Stock.product_id == ln.product_id,
                Stock.warehouse_id == count.warehouse_id,
            )
        )
        current = Decimal(stock.quantity) if stock else Decimal("0")
        delta = counted - current
        ln.applied = True
        if delta == 0:
            continue
        if stock is None:
            stock = Stock(
                product_id=ln.product_id,
                warehouse_id=count.warehouse_id,
                quantity=Decimal("0"),
            )
            db.add(stock)
        stock.quantity = counted
        db.add(
            StockMovement(
                product_id=ln.product_id,
                warehouse_id=count.warehouse_id,
                type=StockMovementType.ADJUSTMENT,
                quantity=delta,
                reference=f"stock_count:{count.id}",
                note=f"Инвентаризация #{count.id}",
                created_by_id=user.id,
            )
        )

    count.status = StockCountStatus.COMPLETED
    count.completed_by_id = user.id
    count.completed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(count, attribute_names=["lines"])
    return await _detail(db, count)


@router.post("/{count_id}/cancel", response_model=CountDetailOut)
async def cancel_count(
    count_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_MANAGE),
) -> CountDetailOut:
    count = await _load(db, count_id)
    if count.status not in _EDITABLE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Count is not editable")
    count.status = StockCountStatus.CANCELLED
    await db.flush()
    await db.refresh(count, attribute_names=["lines"])
    return await _detail(db, count)
