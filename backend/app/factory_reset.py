"""Factory reset for the Warehouse ERP database.

Wipes ALL business data — products, categories, suppliers, customers, regions,
stock, stock movements, inventory counts, purchase orders, sales orders, returns,
refunds, photo reports, Telegram topics, activity log, agent targets — and every
non-admin user. Only ADMIN user(s) survive, and their Telegram link / password-reset
flags are cleared.

Infrastructure needed for the app to keep working is preserved (and re-created if
missing): the base currencies and a default warehouse. Company settings are kept.

The database schema is NOT touched (no tables dropped) — this only clears rows.

Usage (run as a module so the ``app`` package imports resolve):

    # Inside the running backend container (recommended):
    docker compose exec backend python -m app.factory_reset          # asks to confirm
    docker compose exec backend python -m app.factory_reset --yes    # no prompt

    # Or from the backend/ directory on the host (needs the deps + DB env):
    python -m app.factory_reset
"""

import argparse
import asyncio
import sys

from sqlalchemy import text

from app.core.database import AsyncSessionLocal, engine
from app.models import Base
from app.models.enums import UserRole
from app.models.user import User

# Tables whose rows are preserved. Everything else is emptied.
#   users            -> admins kept (non-admins deleted separately below)
#   currencies       -> money types the app needs
#   warehouses       -> a default warehouse is required for stock operations
#   company_settings -> branding / Excel language config
KEEP_TABLES = {"users", "currencies", "warehouses", "company_settings"}


async def _count(conn, table: str) -> int:
    return int(await conn.scalar(text(f"SELECT COUNT(*) FROM {table}")) or 0)


async def run(assume_yes: bool) -> int:
    # --- Safety: make sure at least one admin will remain -------------------
    async with AsyncSessionLocal() as db:
        admins = list(
            await db.scalars(
                text("SELECT email FROM users WHERE role = 'ADMIN' ORDER BY id")
            )
        )
    if not admins:
        print(
            "ABORT: no ADMIN user found. A factory reset would leave no one able to "
            "log in. Create an admin first, then re-run.",
            file=sys.stderr,
        )
        return 2

    print("This will PERMANENTLY DELETE all data in the ERP database.")
    print(f"Admin account(s) that will be kept: {', '.join(admins)}")
    print("Infrastructure kept: currencies, default warehouse, company settings.")
    if not assume_yes:
        reply = input("Type RESET to continue (anything else aborts): ").strip()
        if reply != "RESET":
            print("Aborted — nothing was changed.")
            return 1

    # --- Wipe -----------------------------------------------------------------
    async with engine.begin() as conn:
        # users.default_topic_id references telegram_topics, which we delete; clear
        # it first so the delete does not hit a foreign-key violation.
        await conn.execute(text("UPDATE users SET default_topic_id = NULL"))

        # Delete child tables before parents (reverse dependency order).
        cleared: list[str] = []
        for table in reversed(Base.metadata.sorted_tables):
            if table.name in KEEP_TABLES:
                continue
            await conn.execute(table.delete())
            cleared.append(table.name)

        # Remove every non-admin user; clear the kept admins' personal state.
        await conn.execute(text("DELETE FROM users WHERE role <> 'ADMIN'"))
        await conn.execute(
            text(
                "UPDATE users SET telegram_chat_id = NULL, telegram_link_code = NULL, "
                "telegram_username = NULL, reset_requested = FALSE"
            )
        )

        # --- Re-create required infrastructure if it was empty ---------------
        if await _count(conn, "currencies") == 0:
            await conn.execute(
                text(
                    "INSERT INTO currencies (code, name, symbol, is_active) VALUES "
                    "('UZS', 'Uzbek som', 'so''m', TRUE), "
                    "('USD', 'US dollar', '$', TRUE)"
                )
            )
        if await _count(conn, "warehouses") == 0:
            await conn.execute(
                text(
                    "INSERT INTO warehouses (name, is_default) "
                    "VALUES ('Main Warehouse', TRUE)"
                )
            )

        remaining_admins = await _count(conn, "users")

    # --- Report ---------------------------------------------------------------
    print("\nFactory reset complete.")
    print(f"  Cleared {len(cleared)} table(s): {', '.join(sorted(cleared))}")
    print(f"  Admin user(s) kept: {remaining_admins}")
    print("  Base currencies and a default warehouse are in place.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Factory-reset the ERP database (keeps admins).")
    parser.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args()
    code = asyncio.run(run(args.yes))
    sys.exit(code)


if __name__ == "__main__":
    main()
