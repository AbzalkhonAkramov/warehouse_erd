from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.security import hash_password, verify_password
from app.models.catalog import Product, Warehouse
from app.models.enums import InvoiceStatus, PaymentMethod, SalesOrderStatus, UserRole
from app.models.finance import Invoice
from app.models.inventory import Stock
from app.models.sales import Customer
from app.models.user import User
from app.schemas.sales import SalesOrderCreate, SalesOrderLineCreate
from app.services import sales_service

pytestmark = pytest.mark.asyncio


async def _setup_basic(db, stock_qty="24"):
    manager = User(
        full_name="Mgr", email="m@e.l", role=UserRole.MANAGER,
        hashed_password=hash_password("x"),
    )
    agent = User(
        full_name="Agt", email="a@e.l", role=UserRole.AGENT,
        hashed_password=hash_password("x"),
    )
    wh = Warehouse(name="Main", is_default=True)
    db.add_all([manager, agent, wh])
    await db.flush()
    product = Product(sku="P1", name="Cola", sale_price=Decimal("9"), cost_price=Decimal("6"))
    db.add(product)
    await db.flush()
    db.add(Stock(product_id=product.id, warehouse_id=wh.id, quantity=Decimal(stock_qty)))
    customer = Customer(name="Shop", credit_limit=Decimal("5000"), agent_id=agent.id)
    db.add(customer)
    await db.flush()
    return manager, agent, product, customer


async def _create(db, agent, customer, product, qty):
    return await sales_service.create_order(
        db, agent,
        SalesOrderCreate(
            customer_id=customer.id,
            lines=[SalesOrderLineCreate(product_id=product.id, quantity=Decimal(qty))],
        ),
    )


async def test_password_roundtrip():
    h = hash_password("secret123")
    assert verify_password("secret123", h)
    assert not verify_password("wrong", h)


async def test_auto_approve_when_in_stock(db):
    """Enough stock → the order is approved on creation (no manager step)."""
    _manager, agent, product, customer = await _setup_basic(db, stock_qty="24")

    order = await _create(db, agent, customer, product, "5")
    assert order.status == SalesOrderStatus.APPROVED
    assert order.approved_by_id is None  # auto, not a manager
    assert order.total == Decimal("45.00")

    stock = await db.scalar(select(Stock).where(Stock.product_id == product.id))
    await db.refresh(customer)
    invoice = await db.scalar(select(Invoice).where(Invoice.sales_order_id == order.id))
    assert stock.quantity == Decimal("19.000")
    assert customer.debt == Decimal("45.00")
    assert invoice is not None and invoice.status == InvoiceStatus.UNPAID

    await sales_service.record_payment(
        db, agent, invoice.id, Decimal("20"), PaymentMethod.CASH, None
    )
    await db.refresh(invoice)
    await db.refresh(customer)
    assert invoice.status == InvoiceStatus.PARTIAL
    assert customer.debt == Decimal("25.00")


async def test_manual_approve_when_short(db):
    """Not enough stock → stays PENDING; nothing changes until a manager approves."""
    manager, agent, product, customer = await _setup_basic(db, stock_qty="24")

    order = await _create(db, agent, customer, product, "30")  # 30 > 24
    assert order.status == SalesOrderStatus.PENDING
    stock = await db.scalar(select(Stock).where(Stock.product_id == product.id))
    await db.refresh(customer)
    assert stock.quantity == Decimal("24.000")  # untouched
    assert customer.debt == Decimal("0.00")
    assert await db.scalar(select(Invoice).where(Invoice.sales_order_id == order.id)) is None

    # Stock arrives, manager approves.
    stock.quantity = Decimal("60")
    await db.flush()
    await sales_service.approve_order(db, manager, order.id)
    await db.refresh(order)
    await db.refresh(stock)
    invoice = await db.scalar(select(Invoice).where(Invoice.sales_order_id == order.id))
    assert order.status == SalesOrderStatus.APPROVED
    assert order.approved_by_id == manager.id
    assert stock.quantity == Decimal("30.000")
    assert invoice is not None


async def test_approve_fails_without_stock(db):
    manager, agent, product, customer = await _setup_basic(db, stock_qty="24")
    order = await _create(db, agent, customer, product, "9999")  # stays pending
    assert order.status == SalesOrderStatus.PENDING
    with pytest.raises(HTTPException) as exc:
        await sales_service.approve_order(db, manager, order.id)
    assert exc.value.status_code == 409


async def test_payment_cannot_exceed_balance(db):
    _manager, agent, product, customer = await _setup_basic(db, stock_qty="24")
    order = await _create(db, agent, customer, product, "1")  # auto-approved
    invoice = await db.scalar(select(Invoice).where(Invoice.sales_order_id == order.id))
    with pytest.raises(HTTPException) as exc:
        await sales_service.record_payment(
            db, agent, invoice.id, Decimal("1000"), PaymentMethod.CASH, None
        )
    assert exc.value.status_code == 400
