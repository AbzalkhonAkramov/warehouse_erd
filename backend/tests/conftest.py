"""Test fixtures: a fresh in-memory-style SQLite DB per test session.

The app is DB-agnostic, so SQLite is enough to exercise the business logic
without needing Postgres. Set DATABASE_URL *before* importing app modules.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_erp.db")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "")

import pytest_asyncio  # noqa: E402

from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.models import Base  # noqa: E402


@pytest_asyncio.fixture
async def db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
