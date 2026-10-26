"""Container startup helper.

Ensures the schema exists (idempotent) and seeds demo data ONLY when the
database is empty, so an existing/migrated database is never modified.

Run with:  python -m app.bootstrap
"""

import asyncio

from sqlalchemy import func, select, text

from app.core.database import AsyncSessionLocal, engine
from app.models import Base
from app.models.catalog import Currency
from app.models.user import User
from app.seed import seed

# Additive columns on `products`. create_all creates missing TABLES but never
# ALTERs existing ones, so on a pre-existing database these new columns must be
# added by hand. Each is idempotent (IF NOT EXISTS) and safe to run every boot.
_PRODUCT_COLUMN_MIGRATIONS = (
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS currency_id INTEGER REFERENCES currencies(id)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS box_qty INTEGER",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS box_weight NUMERIC(10,3)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS box_dimensions VARCHAR(64)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_mode VARCHAR(8) NOT NULL DEFAULT 'piece'",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS integer_qty BOOLEAN NOT NULL DEFAULT TRUE",
    # Per-line sell-as label + box breakdown on order lines.
    "ALTER TABLE sales_order_lines ADD COLUMN IF NOT EXISTS sell_as VARCHAR(8) NOT NULL DEFAULT 'piece'",
    "ALTER TABLE sales_order_lines ADD COLUMN IF NOT EXISTS box_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE sales_order_lines ADD COLUMN IF NOT EXISTS box_size INTEGER NOT NULL DEFAULT 0",
    # Purchase orders / goods receipts may be recorded without a supplier.
    "ALTER TABLE purchase_orders ALTER COLUMN supplier_id DROP NOT NULL",
    # Language for downloaded Excel template headers.
    "ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS excel_lang VARCHAR(4) NOT NULL DEFAULT 'ru'",
    # Individual supplier code (unique).
    "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS code VARCHAR(32)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_suppliers_code ON suppliers (code)",
    # Returns may be recorded by market+SKU without a specific order.
    "ALTER TABLE return_requests ALTER COLUMN sales_order_id DROP NOT NULL",
    "ALTER TABLE refund_entries ALTER COLUMN sales_order_id DROP NOT NULL",
    # Inventory count: completion mode + per-line applied/excluded flag.
    "ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS apply_stock BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE stock_count_lines ADD COLUMN IF NOT EXISTS applied BOOLEAN",
    # New DRAFT state for inventory counts (native enum needs the value added).
    "ALTER TYPE stockcountstatus ADD VALUE IF NOT EXISTS 'DRAFT'",
    # Telegram self-link: per-user start code + captured username.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_code VARCHAR(16)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(120)",
)


async def main() -> None:
    # Create any missing tables (never drops existing ones), then bring existing
    # `products` rows up to the current schema. `currencies` is created by
    # create_all first, so the currency_id foreign key resolves.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for ddl in _PRODUCT_COLUMN_MIGRATIONS:
            await conn.execute(text(ddl))

    # Ensure the base money types exist even on an already-seeded database, and
    # give every product a currency so amounts always render with one.
    async with AsyncSessionLocal() as db:
        has_currency = await db.scalar(select(func.count()).select_from(Currency))
        if not has_currency:
            db.add_all([
                Currency(code="UZS", name="Uzbek som", symbol="so'm", is_active=True),
                Currency(code="USD", name="US dollar", symbol="$", is_active=True),
            ])
            await db.commit()
        base = await db.scalar(
            select(Currency).where(Currency.code == "UZS")
        ) or await db.scalar(select(Currency).order_by(Currency.id))
        if base is not None:
            await db.execute(
                text("UPDATE products SET currency_id = :cid WHERE currency_id IS NULL"),
                {"cid": base.id},
            )
            await db.commit()

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User))

    if users:
        print(f"Database already has {users} user(s); skipping seed.")
    else:
        print("Empty database detected — seeding demo data...")
        await seed()


if __name__ == "__main__":
    asyncio.run(main())
