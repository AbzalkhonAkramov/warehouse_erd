"""Container startup helper.

Ensures the schema exists (idempotent) and seeds demo data ONLY when the
database is empty, so an existing/migrated database is never modified.

Run with:  python -m app.bootstrap
"""

import asyncio

from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal, engine
from app.models import Base
from app.models.user import User
from app.seed import seed


async def main() -> None:
    # Create any missing tables (never drops existing ones).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        users = await db.scalar(select(func.count()).select_from(User))

    if users:
        print(f"Database already has {users} user(s); skipping seed.")
    else:
        print("Empty database detected — seeding demo data...")
        await seed()


if __name__ == "__main__":
    asyncio.run(main())
