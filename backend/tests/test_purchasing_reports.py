from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.routers import reports
from app.core.security import hash_password
from app.models.catalog import Product, Supplier, Warehouse
from app.models.enums import PurchaseOrderStatus, SalesOrderStatus, UserRole
from app.models.inventory import Stock
from app.models.sales import Customer
from app.models.user import User
from app.schemas.purchasing import GoodsReceipt, PurchaseOrderCreate, PurchaseOrderLineCreate
from app.schemas.sales import SalesOrderCreate, SalesOrderLineCreate
from app.services import purchasing_service, sales_service

pytestmark = pytest.mark.asyncio


async def _base(db):
    mgr = User(full_name="M", email="m@e.l", role=UserRole.MANAGER, hashed_password=hash_password("x"))
    wh = Warehouse(name="Main", is_default=True)
    supplier = Supplier(name="ACME")
    db.add_all([mgr, wh, supplier])
    await db.flush()
    product = Product(sku="P1", name="Cola", sale_price=Decimal("9"), cost_price=Decimal("0"))
    db.add(product)
    await db.flush()
    return mgr, wh, supplier, product


async def test_receive_goods_updates_stock_and_cost(db):
    mgr, wh, supplier, product = await _base(db)

    po = await purchasing_service.create_purchase_order(
        db, mgr,
        PurchaseOrderCreate(
            supplier_id=supplier.id,
            lines=[PurchaseOrderLineCreate(product_id=product.id, quantity=Decimal("100"),
                                           unit_cost=Decimal("6"))],
        ),
    )
    assert po.total == Decimal("600.00")
    assert po.status == PurchaseOrderStatus.ORDERED

    await purchasing_service.receive_goods(db, mgr, po.id, GoodsReceipt())
    stock = await db.scalar(select(Stock).where(Stock.product_id == product.id))
    await db.refresh(product)
    await db.refresh(po, attribute_names=["lines", "status"])
    assert stock.quantity == Decimal("100.000")
    assert product.cost_price == Decimal("6")           # cost synced from purchase
    assert po.status == PurchaseOrderStatus.RECEIVED
    assert po.lines[0].received_quantity == Decimal("100.000")


async def test_partial_receipt_keeps_po_ordered(db):
    mgr, wh, supplier, product = await _base(db)
    po = await purchasing_service.create_purchase_order(
        db, mgr,
        PurchaseOrderCreate(
            supplier_id=supplier.id,
            lines=[PurchaseOrderLineCreate(product_id=product.id, quantity=Decimal("100"),
                                           unit_cost=Decimal("6"))],
        ),
    )
    line_id = po.lines[0].id
    await purchasing_service.receive_goods(
        db, mgr, po.id, GoodsReceipt(lines=[{"line_id": line_id, "quantity": Decimal("40")}])
    )
    await db.refresh(po, attribute_names=["status"])
    stock = await db.scalar(select(Stock).where(Stock.product_id == product.id))
    assert stock.quantity == Decimal("40.000")
    assert po.status == PurchaseOrderStatus.ORDERED


async def test_fulfilment_transitions(db):
    mgr, wh, supplier, product = await _base(db)
    db.add(Stock(product_id=product.id, warehouse_id=wh.id, quantity=Decimal("50")))
    agent = User(full_name="A", email="a@e.l", role=UserRole.AGENT, hashed_password=hash_password("x"))
    db.add(agent)
    await db.flush()
    customer = Customer(name="Shop", agent_id=agent.id)
    db.add(customer)
    await db.flush()

    order = await sales_service.create_order(
        db, agent,
        SalesOrderCreate(customer_id=customer.id,
                         lines=[SalesOrderLineCreate(product_id=product.id, quantity=Decimal("2"))]),
    )
    # In stock (50) → auto-approved on creation.
    assert order.status == SalesOrderStatus.APPROVED
    await sales_service.advance_status(db, mgr, order.id, SalesOrderStatus.PICKING)
    await sales_service.advance_status(db, mgr, order.id, SalesOrderStatus.DELIVERED)
    assert order.status == SalesOrderStatus.DELIVERED

    # Cannot deliver an already-delivered order.
    with pytest.raises(HTTPException) as exc:
        await sales_service.advance_status(db, mgr, order.id, SalesOrderStatus.PICKING)
    assert exc.value.status_code == 409


async def test_commission_report(db):
    mgr, wh, supplier, product = await _base(db)
    db.add(Stock(product_id=product.id, warehouse_id=wh.id, quantity=Decimal("100")))
    agent = User(full_name="A", email="a@e.l", role=UserRole.AGENT,
                 commission_rate=Decimal("10"), hashed_password=hash_password("x"))
    db.add(agent)
    await db.flush()
    customer = Customer(name="Shop", agent_id=agent.id)
    db.add(customer)
    await db.flush()

    order = await sales_service.create_order(
        db, agent,
        SalesOrderCreate(customer_id=customer.id,
                         lines=[SalesOrderLineCreate(product_id=product.id, quantity=Decimal("10"))]),
    )  # total = 10 * 9 = 90; in stock (100) → auto-approved
    assert order.status == SalesOrderStatus.APPROVED
    await db.flush()

    now = order.created_at
    rows = await reports.commissions(now.year, now.month, db, mgr)
    me = next(r for r in rows if r.agent_id == agent.id)
    assert me.sales_total == Decimal("90.00")
    assert me.commission == Decimal("9.00")   # 10% of 90
