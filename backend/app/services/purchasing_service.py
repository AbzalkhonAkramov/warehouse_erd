"""Purchasing: create a purchase order and receive goods into stock."""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.catalog import Product, Supplier, Warehouse
from app.models.enums import PurchaseOrderStatus, StockMovementType
from app.models.inventory import Stock, StockMovement
from app.models.purchasing import PurchaseOrder, PurchaseOrderLine
from app.models.user import User
from app.schemas.purchasing import GoodsReceipt, PurchaseOrderCreate

ZERO = Decimal("0")


async def _default_warehouse_id(db: AsyncSession) -> int:
    wh = await db.scalar(select(Warehouse).where(Warehouse.is_default).limit(1))
    if wh is None:
        wh = await db.scalar(select(Warehouse).order_by(Warehouse.id).limit(1))
    if wh is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No warehouse configured")
    return wh.id


async def create_purchase_order(
    db: AsyncSession, user: User, data: PurchaseOrderCreate
) -> PurchaseOrder:
    supplier = await db.get(Supplier, data.supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")
    warehouse_id = data.warehouse_id or await _default_warehouse_id(db)

    po = PurchaseOrder(
        supplier_id=supplier.id,
        warehouse_id=warehouse_id,
        status=PurchaseOrderStatus.ORDERED,
        expected_date=data.expected_date,
        note=data.note,
        created_by_id=user.id,
    )
    total = ZERO
    for line in data.lines:
        product = await db.get(Product, line.product_id)
        if product is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Product {line.product_id} not found")
        total += (line.unit_cost * line.quantity).quantize(Decimal("0.01"))
        po.lines.append(
            PurchaseOrderLine(
                product_id=product.id,
                quantity=line.quantity,
                unit_cost=line.unit_cost,
            )
        )
    po.total = total
    db.add(po)
    await db.flush()
    await db.refresh(po, attribute_names=["lines"])
    return po


async def receive_goods(
    db: AsyncSession, user: User, po_id: int, data: GoodsReceipt
) -> PurchaseOrder:
    po = await db.scalar(
        select(PurchaseOrder)
        .where(PurchaseOrder.id == po_id)
        .options(selectinload(PurchaseOrder.lines))
    )
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    if po.status in (PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CANCELLED):
        raise HTTPException(status.HTTP_409_CONFLICT, f"PO is {po.status.value}")

    lines_by_id = {ln.id: ln for ln in po.lines}
    # Default: receive the outstanding quantity of every line.
    if data.lines:
        requested = {rl.line_id: Decimal(rl.quantity) for rl in data.lines}
    else:
        requested = {
            ln.id: (Decimal(ln.quantity) - Decimal(ln.received_quantity)) for ln in po.lines
        }

    for line_id, qty in requested.items():
        line = lines_by_id.get(line_id)
        if line is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Line {line_id} not in this PO")
        outstanding = Decimal(line.quantity) - Decimal(line.received_quantity)
        if qty <= 0:
            continue
        if qty > outstanding:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Line {line_id}: receiving {qty} exceeds outstanding {outstanding}",
            )

        stock = await db.scalar(
            select(Stock).where(
                Stock.product_id == line.product_id, Stock.warehouse_id == po.warehouse_id
            )
        )
        if stock is None:
            stock = Stock(product_id=line.product_id, warehouse_id=po.warehouse_id, quantity=ZERO)
            db.add(stock)
        stock.quantity = Decimal(stock.quantity) + qty
        line.received_quantity = Decimal(line.received_quantity) + qty

        # Keep the product's reference cost in sync with the latest purchase price.
        product = await db.get(Product, line.product_id)
        product.cost_price = line.unit_cost

        db.add(
            StockMovement(
                product_id=line.product_id,
                warehouse_id=po.warehouse_id,
                type=StockMovementType.RECEIPT,
                quantity=qty,
                unit_cost=line.unit_cost,
                reference=f"purchase_order:{po.id}",
                created_by_id=user.id,
            )
        )

    fully_received = all(
        Decimal(ln.received_quantity) >= Decimal(ln.quantity) for ln in po.lines
    )
    po.status = PurchaseOrderStatus.RECEIVED if fully_received else PurchaseOrderStatus.ORDERED
    await db.flush()
    return po
