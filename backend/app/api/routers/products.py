from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import uuid
from decimal import Decimal
from pathlib import Path

from fastapi import File, Form, UploadFile
from sqlalchemy import func

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.models.associations import agent_categories
from app.models.enums import SalesOrderStatus, UserRole
from app.models.catalog import Product
from app.models.inventory import Stock, StockMovement
from app.models.sales import SalesOrder, SalesOrderLine
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductHistoryEntry,
    ProductOut,
    ProductUpdate,
)

router = APIRouter(prefix="/products", tags=["products"])

_IMAGE_SUBDIR = "products"


@router.get("", response_model=list[ProductOut])
async def list_products(
    search: str | None = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProductOut]:
    stmt = select(Product).order_by(Product.name)
    if active_only:
        stmt = stmt.where(Product.is_active.is_(True))
    if search:
        like = f"%{search}%"
        stmt = stmt.where(Product.name.ilike(like) | Product.sku.ilike(like))

    is_agent = user.role == UserRole.AGENT
    # Agents only see products in the categories assigned to them by a manager.
    # No assignment = unrestricted (see everything).
    if is_agent:
        cat_ids = list(
            await db.scalars(
                select(agent_categories.c.category_id).where(
                    agent_categories.c.agent_id == user.id
                )
            )
        )
        if cat_ids:
            stmt = stmt.where(Product.category_id.in_(cat_ids))

    products = list(await db.scalars(stmt))

    # On-hand quantity per product (so agents can see available stock).
    qty_rows = await db.execute(
        select(Stock.product_id, func.coalesce(func.sum(Stock.quantity), 0)).group_by(
            Stock.product_id
        )
    )
    qty_map = {pid: Decimal(q) for pid, q in qty_rows.all()}

    out: list[ProductOut] = []
    for p in products:
        item = ProductOut.model_validate(p)
        item.on_hand = qty_map.get(p.id, Decimal("0"))
        if is_agent:
            item.cost_price = None  # agents never see the purchase price
        out.append(item)
    return out


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProductOut:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    total = await db.scalar(
        select(func.coalesce(func.sum(Stock.quantity), 0)).where(Stock.product_id == product_id)
    )
    item = ProductOut.model_validate(product)
    item.on_hand = Decimal(total or 0)
    if user.role == UserRole.AGENT:
        item.cost_price = None
    return item


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> Product:
    exists = await db.scalar(select(Product).where(Product.sku == data.sku))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "SKU already exists")
    product = Product(**data.model_dump())
    db.add(product)
    await db.flush()
    return product


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> Product:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    payload = data.model_dump(exclude_unset=True)
    if payload.get("sku") and payload["sku"] != product.sku:
        clash = await db.scalar(
            select(Product).where(Product.sku == payload["sku"], Product.id != product_id)
        )
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "SKU already exists")
    for field, value in payload.items():
        setattr(product, field, value)
    await db.flush()
    return product


@router.post("/{product_id}/image", response_model=ProductOut)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    side: str = Form("front"),  # "front" (main) or "back"
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> Product:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    root = Path(settings.UPLOAD_DIR) / _IMAGE_SUBDIR
    root.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower() or ".jpg"
    name = f"{uuid.uuid4().hex}{suffix}"
    (root / name).write_bytes(await file.read())

    rel = f"{_IMAGE_SUBDIR}/{name}"
    if side == "back":
        product.image_back_path = rel
    else:
        product.image_path = rel
    await db.flush()
    return product


# Statuses that do NOT represent a real (stock-deducting) sale.
_EXCLUDED_SALE_STATUSES = (
    SalesOrderStatus.NEW,
    SalesOrderStatus.REFUND,
    SalesOrderStatus.CANCELLED,
    # legacy values:
    SalesOrderStatus.REJECTED,
    SalesOrderStatus.DRAFT,
    SalesOrderStatus.PENDING,
)


@router.get("/{product_id}/history", response_model=list[ProductHistoryEntry])
async def product_history(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProductHistoryEntry]:
    """Movement history for a product.

    Managers/warehouse/accountants see the full history — stock added (by which
    account) and every sale (by which agent). Agents see only their own sales.
    """
    if await db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    is_privileged = user.role != UserRole.AGENT
    entries: list[ProductHistoryEntry] = []

    # Stock-in events (receipts / positive adjustments) — privileged roles only.
    if is_privileged:
        rows = await db.execute(
            select(StockMovement, User.full_name)
            .outerjoin(User, User.id == StockMovement.created_by_id)
            .where(StockMovement.product_id == product_id, StockMovement.quantity > 0)
        )
        for mv, account in rows.all():
            detail = f"{mv.type.value} · {mv.note}" if mv.note else mv.type.value
            entries.append(
                ProductHistoryEntry(
                    kind="added",
                    date=mv.created_at,
                    quantity=mv.quantity,
                    user_name=account,
                    detail=detail,
                )
            )

    # Sales — full for privileged roles, own-only for agents.
    sales_stmt = (
        select(SalesOrderLine, SalesOrder, User.full_name)
        .join(SalesOrder, SalesOrder.id == SalesOrderLine.sales_order_id)
        .outerjoin(User, User.id == SalesOrder.agent_id)
        .where(
            SalesOrderLine.product_id == product_id,
            SalesOrder.status.notin_(_EXCLUDED_SALE_STATUSES),
        )
    )
    if not is_privileged:
        sales_stmt = sales_stmt.where(SalesOrder.agent_id == user.id)

    for line, order, agent_name in (await db.execute(sales_stmt)).all():
        entries.append(
            ProductHistoryEntry(
                kind="sale",
                date=order.created_at,
                quantity=line.quantity,
                user_name=agent_name,
                detail=f"#{order.id} · {order.status.value}",
            )
        )

    entries.sort(key=lambda e: e.date, reverse=True)
    return entries
