"""Business logic for the agent → manager sales flow.

Each function receives an open AsyncSession and flushes its changes; the caller
(the request dependency) owns the final commit.
"""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.associations import agent_categories
from app.models.catalog import Product, Warehouse
from app.models.enums import (
    InvoiceStatus,
    SalesOrderStatus,
    StockMovementType,
    UserRole,
)
from app.models.finance import Invoice, Payment
from app.models.inventory import Stock, StockMovement
from app.models.sales import Customer, SalesOrder, SalesOrderLine
from app.models.user import User
from app.schemas.sales import SalesOrderCreate
from app.services import telegram

ZERO = Decimal("0")


async def _default_warehouse_id(db: AsyncSession) -> int:
    wh = await db.scalar(select(Warehouse).where(Warehouse.is_default).limit(1))
    if wh is None:
        wh = await db.scalar(select(Warehouse).order_by(Warehouse.id).limit(1))
    if wh is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No warehouse configured")
    return wh.id


async def create_order(db: AsyncSession, agent: User, data: SalesOrderCreate) -> SalesOrder:
    customer = await db.get(Customer, data.customer_id)
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

    warehouse_id = data.warehouse_id or await _default_warehouse_id(db)

    # Category visibility: an agent may only order goods in the categories a manager
    # assigned to them. No assignment = unrestricted (mirrors GET /products).
    allowed_categories: set[int] | None = None
    if agent.role == UserRole.AGENT:
        cat_ids = set(
            await db.scalars(
                select(agent_categories.c.category_id).where(
                    agent_categories.c.agent_id == agent.id
                )
            )
        )
        allowed_categories = cat_ids or None  # empty -> unrestricted

    order = SalesOrder(
        customer_id=customer.id,
        agent_id=agent.id,
        warehouse_id=warehouse_id,
        status=SalesOrderStatus.PENDING,
        discount=data.discount or ZERO,
        note=data.note,
    )

    subtotal = ZERO
    for line in data.lines:
        product = await db.get(Product, line.product_id)
        if product is None or not product.is_active:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Product {line.product_id} not available"
            )
        if allowed_categories is not None and product.category_id not in allowed_categories:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Product {product.id} is not in your assigned categories",
            )
        unit_price = line.unit_price if line.unit_price is not None else Decimal(product.sale_price)
        line_total = (unit_price * line.quantity).quantize(Decimal("0.01"))
        subtotal += line_total
        order.lines.append(
            SalesOrderLine(
                product_id=product.id,
                quantity=line.quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    order.subtotal = subtotal
    order.total = max(subtotal - (data.discount or ZERO), ZERO)

    db.add(order)
    await db.flush()
    await db.refresh(order, attribute_names=["lines"])

    # Flag (do not block) when this order would push the customer over their credit limit.
    over_limit = (
        customer.credit_limit
        and (Decimal(customer.debt) + order.total) > Decimal(customer.credit_limit)
    )
    warn = "  ⚠️ OVER CREDIT LIMIT" if over_limit else ""

    # Auto-approve when every line is in stock; otherwise leave PENDING for a manager.
    if await _order_fully_in_stock(db, order):
        invoice = await _fulfil_order(db, order, agent.id)  # approved_by stays null = auto
        await db.flush()
        await telegram.notify_managers(
            f"✅ <b>Order #{order.id} auto-approved</b> (stock available)\n"
            f"Customer: {customer.name}\n"
            f"Agent: {agent.full_name}\n"
            f"Total: {order.total} · {invoice.number}{warn}"
        )
        if agent.telegram_chat_id:
            await telegram.send_message(
                agent.telegram_chat_id,
                f"✅ Your order #{order.id} was auto-approved. Invoice {invoice.number}.",
            )
    else:
        await telegram.notify_managers(
            f"🧾 <b>New order #{order.id}</b> needs approval (insufficient stock)\n"
            f"Customer: {customer.name}\n"
            f"Agent: {agent.full_name}\n"
            f"Total: {order.total}{warn}"
        )
    return order


async def _order_fully_in_stock(db: AsyncSession, order: SalesOrder) -> bool:
    """True when every line can be satisfied from the order's warehouse."""
    for line in order.lines:
        stock = await db.scalar(
            select(Stock).where(
                Stock.product_id == line.product_id,
                Stock.warehouse_id == order.warehouse_id,
            )
        )
        available = Decimal(stock.quantity) if stock else ZERO
        if available < Decimal(line.quantity):
            return False
    return True


async def _fulfil_order(db: AsyncSession, order: SalesOrder, actor_id: int) -> Invoice:
    """Decrement stock, record movements, mark APPROVED, create the invoice and raise
    the customer's debt. Raises 409 if any line lacks stock."""
    for line in order.lines:
        stock = await db.scalar(
            select(Stock).where(
                Stock.product_id == line.product_id,
                Stock.warehouse_id == order.warehouse_id,
            )
        )
        available = Decimal(stock.quantity) if stock else ZERO
        if available < Decimal(line.quantity):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Insufficient stock for product {line.product_id}: "
                f"have {available}, need {line.quantity}",
            )
        stock.quantity = available - Decimal(line.quantity)
        db.add(
            StockMovement(
                product_id=line.product_id,
                warehouse_id=order.warehouse_id,
                type=StockMovementType.SALE,
                quantity=-Decimal(line.quantity),
                reference=f"sales_order:{order.id}",
                created_by_id=actor_id,
            )
        )

    order.status = SalesOrderStatus.APPROVED
    order.approved_at = datetime.now(timezone.utc)

    invoice = Invoice(
        number=f"INV-{order.id:06d}",
        sales_order_id=order.id,
        customer_id=order.customer_id,
        total=order.total,
        paid_amount=ZERO,
        status=InvoiceStatus.UNPAID,
    )
    db.add(invoice)

    customer = await db.get(Customer, order.customer_id)
    customer.debt = Decimal(customer.debt) + Decimal(order.total)
    return invoice


async def approve_order(db: AsyncSession, manager: User, order_id: int) -> SalesOrder:
    order = await _get_order_with_lines(db, order_id)
    if order.status != SalesOrderStatus.PENDING:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Order is {order.status.value}, cannot approve"
        )
    invoice = await _fulfil_order(db, order, manager.id)
    order.approved_by_id = manager.id
    await db.flush()

    agent = await db.get(User, order.agent_id)
    if agent and agent.telegram_chat_id:
        await telegram.send_message(
            agent.telegram_chat_id,
            f"✅ Your order #{order.id} was approved. Invoice {invoice.number}.",
        )
    return order


async def reject_order(
    db: AsyncSession, manager: User, order_id: int, reason: str
) -> SalesOrder:
    order = await _get_order_with_lines(db, order_id)
    if order.status != SalesOrderStatus.PENDING:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Order is {order.status.value}, cannot reject"
        )
    order.status = SalesOrderStatus.REJECTED
    order.rejection_reason = reason
    await db.flush()

    agent = await db.get(User, order.agent_id)
    if agent and agent.telegram_chat_id:
        await telegram.send_message(
            agent.telegram_chat_id, f"❌ Your order #{order.id} was rejected: {reason}"
        )
    return order


# Allowed warehouse fulfilment transitions.
_FULFIL_TRANSITIONS: dict[SalesOrderStatus, set[SalesOrderStatus]] = {
    SalesOrderStatus.APPROVED: {SalesOrderStatus.PICKING, SalesOrderStatus.DELIVERED},
    SalesOrderStatus.PICKING: {SalesOrderStatus.DELIVERED},
}


async def advance_status(
    db: AsyncSession, user: User, order_id: int, target: SalesOrderStatus
) -> SalesOrder:
    """Move an approved order through picking → delivered."""
    order = await _get_order_with_lines(db, order_id)
    allowed = _FULFIL_TRANSITIONS.get(order.status, set())
    if target not in allowed:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot move order from {order.status.value} to {target.value}",
        )
    order.status = target
    await db.flush()
    return order


async def cancel_order(db: AsyncSession, user: User, order_id: int) -> SalesOrder:
    """Cancel a still-pending order. Approved/fulfilled orders need a credit note
    (stock + debt reversal), which is intentionally not auto-handled yet."""
    order = await _get_order_with_lines(db, order_id)
    if order.status != SalesOrderStatus.PENDING:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Only pending orders can be cancelled here (order is {order.status.value})",
        )
    order.status = SalesOrderStatus.CANCELLED
    await db.flush()
    return order


async def record_payment(
    db: AsyncSession, collector: User, invoice_id: int, amount: Decimal, method, note: str | None
) -> Payment:
    invoice = await db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if Decimal(amount) > (Decimal(invoice.total) - Decimal(invoice.paid_amount)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment exceeds invoice balance")

    payment = Payment(
        invoice_id=invoice.id,
        amount=amount,
        method=method,
        collected_by_id=collector.id,
        collected_at=datetime.now(timezone.utc),
        note=note,
    )
    db.add(payment)

    invoice.paid_amount = Decimal(invoice.paid_amount) + Decimal(amount)
    if Decimal(invoice.paid_amount) >= Decimal(invoice.total):
        invoice.status = InvoiceStatus.PAID
    else:
        invoice.status = InvoiceStatus.PARTIAL

    customer = await db.get(Customer, invoice.customer_id)
    customer.debt = max(Decimal(customer.debt) - Decimal(amount), ZERO)

    await db.flush()
    return payment


async def _get_order_with_lines(db: AsyncSession, order_id: int) -> SalesOrder:
    order = await db.scalar(
        select(SalesOrder)
        .where(SalesOrder.id == order_id)
        .options(selectinload(SalesOrder.lines))
    )
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order
