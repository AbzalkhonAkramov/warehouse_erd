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
from app.models.photo import PhotoReport, PhotoReportImage
from app.models.sales import (
    Customer,
    OrderStatusHistory,
    RefundEntry,
    SalesOrder,
    SalesOrderLine,
)
from app.models.user import User
from app.schemas.sales import SalesOrderCreate, SalesOrderUpdate, StatusMoveRequest
from app.services import telegram

ZERO = Decimal("0")


def _fmt_qty(q) -> str:
    return f"{float(q):g}"


def _items_desc(pairs) -> str:
    """Language-neutral '4×Cola, 2×Water' summary from (name, qty) pairs."""
    return ", ".join(f"{_fmt_qty(q)}×{name}" for name, q in pairs)


async def _plan_items_desc(db: AsyncSession, plan) -> str:
    names = dict(
        (await db.execute(
            select(Product.id, Product.name).where(
                Product.id.in_([line.product_id for line, _, _ in plan])
            )
        )).all()
    )
    return _items_desc([(names.get(line.product_id, f"#{line.product_id}"), q) for line, q, _ in plan])


async def _default_warehouse_id(db: AsyncSession) -> int:
    wh = await db.scalar(select(Warehouse).where(Warehouse.is_default).limit(1))
    if wh is None:
        wh = await db.scalar(select(Warehouse).order_by(Warehouse.id).limit(1))
    if wh is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No warehouse configured")
    return wh.id


async def create_order(db: AsyncSession, creator: User, data: SalesOrderCreate) -> SalesOrder:
    """Create an order in status NEW. Agents file it under their own account; a
    manager/admin may file it under any agent via ``data.agent_id``."""
    customer = await db.scalar(
        select(Customer)
        .where(Customer.id == data.customer_id)
        .options(selectinload(Customer.agents))
    )
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

    # Agents may only order for markets they are pinned to (many-to-many).
    if creator.role == UserRole.AGENT and creator.id not in {a.id for a in customer.agents}:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "This shop is not assigned to you"
        )

    # Only managers/admins may apply a discount.
    discount = data.discount or ZERO
    if creator.role not in (UserRole.ADMIN, UserRole.MANAGER):
        discount = ZERO

    warehouse_id = data.warehouse_id or await _default_warehouse_id(db)

    # Resolve which agent the order belongs to.
    is_privileged = creator.role in (UserRole.ADMIN, UserRole.MANAGER)
    if is_privileged and data.agent_id is not None:
        agent = await db.get(User, data.agent_id)
        if agent is None or agent.role != UserRole.AGENT:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid agent")
    else:
        agent = creator

    # Category visibility: when an *agent* creates the order they may only pick goods
    # in the categories a manager assigned to them (no assignment = unrestricted).
    # Managers/admins are never restricted. Mirrors GET /products.
    allowed_categories: set[int] | None = None
    if creator.role == UserRole.AGENT:
        cat_ids = set(
            await db.scalars(
                select(agent_categories.c.category_id).where(
                    agent_categories.c.agent_id == creator.id
                )
            )
        )
        allowed_categories = cat_ids or None  # empty -> unrestricted

    order = SalesOrder(
        customer_id=customer.id,
        agent_id=agent.id,
        created_by_id=creator.id,
        warehouse_id=warehouse_id,
        status=SalesOrderStatus.NEW,
        discount=discount,
        note=data.note,
    )

    subtotal = ZERO
    created_items: list[tuple[str, Decimal]] = []
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
        created_items.append((product.name, line.quantity))
        order.lines.append(
            SalesOrderLine(
                product_id=product.id,
                quantity=line.quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    order.subtotal = subtotal
    order.total = max(subtotal - discount, ZERO)

    db.add(order)
    await db.flush()
    await db.refresh(order, attribute_names=["lines"])

    # Record the opening event (order created).
    db.add(
        OrderStatusHistory(
            sales_order_id=order.id,
            from_status=None,
            to_status=order.status.value,
            kind="create",
            detail=_items_desc(created_items),
            changed_by_id=creator.id,
        )
    )

    # Flag (do not block) when this order would push the customer over their credit limit.
    over_limit = (
        customer.credit_limit
        and (Decimal(customer.debt) + order.total) > Decimal(customer.credit_limit)
    )
    warn = "  ⚠️ OVER CREDIT LIMIT" if over_limit else ""

    # New orders wait for a manager to ship/deliver them.
    await telegram.notify_managers(
        f"🆕 <b>New order #{order.id}</b>\n"
        f"Customer: {customer.name}\n"
        f"Agent: {agent.full_name}\n"
        f"Total: {order.total}{warn}"
    )
    return order


# Statuses that mean the goods have left the warehouse (stock already deducted and an
# invoice created). Entering one of these for the first time triggers fulfilment.
_FULFILLED_STATUSES = (SalesOrderStatus.SHIPPED, SalesOrderStatus.DELIVERED)


async def update_order(
    db: AsyncSession, manager: User, order_id: int, data: SalesOrderUpdate
) -> SalesOrder:
    """Manager-only edit of the deliverer / note. The deliverer can only be changed
    while the order is still NEW; status changes go through move_order()."""
    order = await _get_order_with_lines(db, order_id)

    # Assign a deliverer account (preferred) — copies the account's name into the
    # display field so receipts/history keep showing a name.
    if data.deliverer_id is not None and data.deliverer_id != order.deliverer_id:
        if order.status != SalesOrderStatus.NEW:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The deliverer can only be edited while the order is New",
            )
        deliverer = await db.get(User, data.deliverer_id)
        if deliverer is None or deliverer.role != UserRole.DELIVERER:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid deliverer")
        order.deliverer_id = deliverer.id
        order.deliverer = deliverer.full_name
    elif data.deliverer is not None and data.deliverer != (order.deliverer or ""):
        if order.status != SalesOrderStatus.NEW:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The deliverer can only be edited while the order is New",
            )
        order.deliverer = data.deliverer
    if data.note is not None:
        order.note = data.note
    if data.photo_required is not None:
        order.photo_required = data.photo_required

    await db.flush()
    await db.refresh(order, attribute_names=["lines"])
    return order


async def _photos_pinned(db: AsyncSession, order_id: int) -> bool:
    """True when both a before AND an after photo were delivered to Telegram for
    this order (a report whose Telegram send failed does not count)."""
    stages = set(
        await db.scalars(
            select(PhotoReportImage.stage)
            .join(PhotoReport, PhotoReportImage.report_id == PhotoReport.id)
            .where(
                PhotoReport.sales_order_id == order_id,
                PhotoReportImage.telegram_link.is_not(None),
            )
        )
    )
    return len(stages) >= 2


def _change_status(
    db: AsyncSession,
    order: SalesOrder,
    new_status: SalesOrderStatus,
    user_id: int,
    *,
    kind: str = "move",
    detail: str | None = None,
    related_order_id: int | None = None,
) -> None:
    """Apply a status change: record history and un-archive (a changed order is active
    again). Caller flushes."""
    db.add(
        OrderStatusHistory(
            sales_order_id=order.id,
            from_status=order.status.value,
            to_status=new_status.value,
            kind=kind,
            detail=detail,
            related_order_id=related_order_id,
            changed_by_id=user_id,
        )
    )
    order.status = new_status
    order.archived = False


def _recompute_invoice_status(inv: Invoice) -> None:
    paid = Decimal(inv.paid_amount)
    if paid <= ZERO:
        inv.status = InvoiceStatus.UNPAID
    elif paid >= Decimal(inv.total):
        inv.status = InvoiceStatus.PAID
    else:
        inv.status = InvoiceStatus.PARTIAL


async def _invoice_of(db: AsyncSession, order_id: int) -> "Invoice | None":
    return await db.scalar(select(Invoice).where(Invoice.sales_order_id == order_id))


async def _refund_goods(db, order, plan, restock, actor_id) -> None:
    """Restock (optional) and record the returned goods for the refunded-goods page."""
    for line, q, value in plan:
        if restock:
            stock = await db.scalar(
                select(Stock).where(
                    Stock.product_id == line.product_id,
                    Stock.warehouse_id == order.warehouse_id,
                )
            )
            if stock is None:
                stock = Stock(
                    product_id=line.product_id, warehouse_id=order.warehouse_id, quantity=ZERO
                )
                db.add(stock)
            stock.quantity = Decimal(stock.quantity) + q
            db.add(
                StockMovement(
                    product_id=line.product_id,
                    warehouse_id=order.warehouse_id,
                    type=StockMovementType.RETURN_IN,
                    quantity=q,
                    reference=f"refund:{order.id}",
                    created_by_id=actor_id,
                )
            )
        db.add(
            RefundEntry(
                sales_order_id=order.id,
                product_id=line.product_id,
                customer_id=order.customer_id,
                agent_id=order.agent_id,
                deliverer=order.deliverer,
                quantity=q,
                unit_price=line.unit_price,
                value=value,
                restocked=restock,
                created_by_id=actor_id,
            )
        )


async def move_order(
    db: AsyncSession, manager: User, order_id: int, data: StatusMoveRequest
) -> SalesOrder:
    """Move an order to a status. With no lines the whole order moves; with lines a
    partial amount moves and a new order forks off (the rest keeps the old status).

    NEW -> SHIPPED/DELIVERED deducts stock + creates an invoice + debt. REFUND /
    CANCELLED of already-sold goods cuts the debt (REFUND can also restock and is
    recorded as refunded goods)."""
    order = await _get_order_with_lines(db, order_id)
    target = data.status
    if data.note:
        order.note = data.note
    if target == order.status:
        await db.flush()
        await db.refresh(order, attribute_names=["lines"])
        return order

    # Before/after photo gate: an order can only be delivered once its before+after
    # photos are pinned — but only when the agent is flagged "important" (admin) AND
    # the order itself still requires photos (manager can waive a single order).
    if target == SalesOrderStatus.DELIVERED and order.photo_required:
        agent_important = await db.scalar(
            select(User.photo_required).where(User.id == order.agent_id)
        )
        if agent_important and not await _photos_pinned(db, order.id):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Before/after photos must be attached to this order before it can be "
                "marked delivered.",
            )

    # Plan which goods move (all lines, or the requested subset).
    by_product = {line.product_id: line for line in order.lines}
    plan: list[tuple[SalesOrderLine, Decimal, Decimal]] = []
    moved_value = ZERO
    if data.lines:
        for req in data.lines:
            line = by_product.get(req.product_id)
            if line is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Product {req.product_id} is not in order #{order.id}",
                )
            avail = Decimal(line.quantity)
            if Decimal(req.quantity) > avail:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Cannot move {req.quantity} of product {req.product_id}; only {avail} left",
                )
            value = (Decimal(line.unit_price) * Decimal(req.quantity)).quantize(Decimal("0.01"))
            plan.append((line, Decimal(req.quantity), value))
            moved_value += value
    else:
        for line in order.lines:
            plan.append((line, Decimal(line.quantity), Decimal(line.line_total)))
            moved_value += Decimal(line.line_total)

    total_qty = sum((Decimal(line.quantity) for line in order.lines), ZERO)
    move_qty = sum((q for _, q, _ in plan), ZERO)
    full = move_qty >= total_qty
    moved_desc = await _plan_items_desc(db, plan)

    had_invoice = await _invoice_of(db, order.id) is not None
    is_fulfil = target in _FULFILLED_STATUSES
    is_reversal = target in (SalesOrderStatus.REFUND, SalesOrderStatus.CANCELLED)

    if full:
        moved = order
        _change_status(db, order, target, manager.id, kind="move", detail=moved_desc)
    else:
        # Fork the moved goods into a new order; reduce the original.
        fork_lines: list[SalesOrderLine] = []
        for line, q, value in plan:
            line.quantity = Decimal(line.quantity) - q
            line.line_total = (Decimal(line.unit_price) * Decimal(line.quantity)).quantize(
                Decimal("0.01")
            )
            fork_lines.append(
                SalesOrderLine(
                    product_id=line.product_id,
                    quantity=q,
                    unit_price=line.unit_price,
                    line_total=value,
                )
            )
        for line in list(order.lines):
            if Decimal(line.quantity) <= ZERO:
                order.lines.remove(line)
        order.subtotal = sum((Decimal(line.line_total) for line in order.lines), ZERO)
        order.total = max(order.subtotal - Decimal(order.discount), ZERO)
        order.archived = False  # the original stays active in its current status

        fork = SalesOrder(
            customer_id=order.customer_id,
            agent_id=order.agent_id,
            created_by_id=manager.id,
            parent_order_id=order.id,
            warehouse_id=order.warehouse_id,
            status=target,
            deliverer=order.deliverer,
            subtotal=moved_value,
            discount=ZERO,
            total=moved_value,
            note=data.note,
            archived=False,
        )
        fork.lines = fork_lines
        db.add(fork)
        await db.flush()
        # Two linked events: the parent records what it forked out; the fork records
        # that it was created by forking from the parent.
        db.add(
            OrderStatusHistory(
                sales_order_id=order.id,
                from_status=order.status.value,
                # The destination status the forked goods moved into.
                to_status=target.value,
                kind="fork_out",
                detail=moved_desc,
                related_order_id=fork.id,
                changed_by_id=manager.id,
            )
        )
        db.add(
            OrderStatusHistory(
                sales_order_id=fork.id,
                from_status=None,
                to_status=target.value,
                kind="fork_in",
                detail=moved_desc,
                related_order_id=order.id,
                changed_by_id=manager.id,
            )
        )
        moved = fork

    # Financial effects on the moved goods.
    if is_fulfil:
        if not had_invoice:
            invoice = await _fulfil_order(db, moved, manager.id)
            moved.approved_by_id = manager.id
            moved.approved_at = datetime.now(timezone.utc)
            await _notify_agent(
                db, order, f"📦 Order #{order.id} → {target.value}. Invoice {invoice.number}."
            )
        else:
            # Goods already sold/deducted (e.g. shipped → delivered).
            if not full:
                inv = await _invoice_of(db, order.id)
                if inv is not None:
                    inv.total = max(Decimal(inv.total) - moved_value, ZERO)
                    _recompute_invoice_status(inv)
                    db.add(
                        Invoice(
                            number=f"INV-{moved.id:06d}",
                            sales_order_id=moved.id,
                            customer_id=moved.customer_id,
                            total=moved_value,
                            paid_amount=ZERO,
                            status=InvoiceStatus.UNPAID,
                        )
                    )
            await _notify_agent(db, order, f"📦 Order #{order.id} → {target.value}.")
    elif is_reversal:
        if had_invoice:
            reverse_value = Decimal(order.total) if full else moved_value
            customer = await db.get(Customer, order.customer_id)
            if customer is not None:
                customer.debt = max(Decimal(customer.debt) - reverse_value, ZERO)
            inv = await _invoice_of(db, order.id)
            if inv is not None:
                inv.total = max(Decimal(inv.total) - reverse_value, ZERO)
                _recompute_invoice_status(inv)
            if target == SalesOrderStatus.REFUND:
                await _refund_goods(db, order, plan, data.restock, manager.id)
            await _notify_agent(
                db, order, f"↩️ Order #{order.id} → {target.value} (−{reverse_value})."
            )
        else:
            # Goods were never sold; refund just records them, cancel is a label.
            if target == SalesOrderStatus.REFUND:
                await _refund_goods(db, order, plan, False, manager.id)
            await _notify_agent(db, order, f"Order #{order.id} → {target.value}.")
    else:
        await _notify_agent(db, order, f"Order #{order.id} → {target.value}.")

    await db.flush()
    await db.refresh(order, attribute_names=["lines"])
    return order


async def archive_finished_orders(db: AsyncSession) -> int:
    """Archive finished orders (delivered / cancelled / refund). Shipped & new stay
    active. Returns the number archived. Idempotent."""
    finished = (
        SalesOrderStatus.DELIVERED,
        SalesOrderStatus.CANCELLED,
        SalesOrderStatus.REFUND,
    )
    rows = list(
        await db.scalars(
            select(SalesOrder).where(
                SalesOrder.status.in_(finished), SalesOrder.archived.is_(False)
            )
        )
    )
    for order in rows:
        order.archived = True
    await db.flush()
    return len(rows)


async def _notify_agent(db: AsyncSession, order: SalesOrder, message: str) -> None:
    agent = await db.get(User, order.agent_id)
    if agent and agent.telegram_chat_id:
        await telegram.send_message(agent.telegram_chat_id, message)


async def _fulfil_order(db: AsyncSession, order: SalesOrder, actor_id: int) -> Invoice:
    """Decrement stock, record movements, create the invoice and raise the customer's
    debt. Raises 409 if any line lacks stock. Caller sets the order status."""
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
