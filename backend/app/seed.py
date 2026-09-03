"""Seed the database with an admin user and a small demo dataset.

Run with:  python -m app.seed
Safe to re-run: it skips records that already exist (keyed by unique fields).
"""

import asyncio
from decimal import Decimal

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.core.security import hash_password
from app.models import Base
from app.models.catalog import Category, Product, Warehouse
from app.models.enums import UserRole
from app.models.inventory import Stock
from app.models.sales import Customer
from app.models.user import User


async def _get_or_create(db, model, defaults=None, **filters):
    obj = await db.scalar(select(model).filter_by(**filters))
    if obj:
        return obj, False
    obj = model(**filters, **(defaults or {}))
    db.add(obj)
    await db.flush()
    return obj, True


async def seed() -> None:
    # For first-run convenience, create tables directly. In production use Alembic.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        await _get_or_create(
            db, User, email="admin@erp.local",
            defaults={
                "full_name": "System Admin",
                "role": UserRole.ADMIN,
                "hashed_password": hash_password("admin123"),
            },
        )
        manager, _ = await _get_or_create(
            db, User, email="manager@erp.local",
            defaults={
                "full_name": "Warehouse Manager",
                "role": UserRole.MANAGER,
                "hashed_password": hash_password("manager123"),
            },
        )
        agent, _ = await _get_or_create(
            db, User, email="agent@erp.local",
            defaults={
                "full_name": "Field Agent One",
                "role": UserRole.AGENT,
                "commission_rate": Decimal("5"),
                "hashed_password": hash_password("agent123"),
            },
        )

        warehouse, _ = await _get_or_create(
            db, Warehouse, name="Main Warehouse", defaults={"is_default": True}
        )

        drinks, _ = await _get_or_create(db, Category, name="Drinks")
        snacks, _ = await _get_or_create(db, Category, name="Snacks")

        demo_products = [
            ("SKU-001", "Cola 1.5L", drinks, "6", "9", 24),
            ("SKU-002", "Water 0.5L", drinks, "2", "3", 100),
            ("SKU-003", "Potato Chips", snacks, "5", "8", 40),
            ("SKU-004", "Chocolate Bar", snacks, "3", "5", 60),
        ]
        for sku, name, cat, cost, price, qty in demo_products:
            product, created = await _get_or_create(
                db, Product, sku=sku,
                defaults={
                    "name": name,
                    "category_id": cat.id,
                    "cost_price": Decimal(cost),
                    "sale_price": Decimal(price),
                    "min_stock": Decimal("10"),
                },
            )
            if created:
                db.add(
                    Stock(
                        product_id=product.id,
                        warehouse_id=warehouse.id,
                        quantity=Decimal(qty),
                    )
                )

        corner, _ = await _get_or_create(
            db, Customer, name="Corner Shop",
            defaults={
                "phone": "+1000000001",
                "address": "12 Market St",
                "credit_limit": Decimal("500"),
            },
        )
        mini, _ = await _get_or_create(
            db, Customer, name="Mini Mart",
            defaults={
                "phone": "+1000000002",
                "address": "5 High St",
                "credit_limit": Decimal("1000"),
            },
        )
        # Assigning a many-to-many relationship on a persistent row forces
        # SQLAlchemy to load the current collection; under async that lazy load
        # raises MissingGreenlet, so refresh it explicitly first, then append
        # idempotently (keeps re-seeding an existing DB safe).
        for shop in (corner, mini):
            await db.refresh(shop, attribute_names=["agents"])
            if agent not in shop.agents:
                shop.agents.append(agent)

        await db.commit()

    print("Seed complete.")
    print("  admin@erp.local / admin123   (admin)")
    print("  manager@erp.local / manager123")
    print("  agent@erp.local / agent123")


if __name__ == "__main__":
    asyncio.run(seed())
