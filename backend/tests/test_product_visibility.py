from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.api.routers import products as products_router
from app.api.routers import users as users_router
from app.core.security import hash_password
from app.models.catalog import Category, Product
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import AgentCategoriesUpdate

pytestmark = pytest.mark.asyncio


async def _setup(db):
    manager = User(full_name="M", email="m@e.l", role=UserRole.MANAGER,
                   hashed_password=hash_password("x"))
    agent = User(full_name="A", email="a@e.l", role=UserRole.AGENT,
                 hashed_password=hash_password("x"))
    drinks = Category(name="Drinks")
    snacks = Category(name="Snacks")
    db.add_all([manager, agent, drinks, snacks])
    await db.flush()
    db.add_all([
        Product(sku="D1", name="Cola", category_id=drinks.id, sale_price=Decimal("9")),
        Product(sku="S1", name="Chips", category_id=snacks.id, sale_price=Decimal("8")),
        Product(sku="U1", name="Uncategorized", sale_price=Decimal("3")),
    ])
    await db.flush()
    return manager, agent, drinks, snacks


async def _names(db, user):
    products = await products_router.list_products(
        search=None, active_only=True, db=db, user=user
    )
    return {p.name for p in products}


async def test_unassigned_agent_sees_all(db):
    _, agent, _d, _s = await _setup(db)
    assert await _names(db, agent) == {"Cola", "Chips", "Uncategorized"}


async def test_assigned_agent_sees_only_their_categories(db):
    manager, agent, drinks, _snacks = await _setup(db)
    await users_router.set_agent_categories(
        agent.id, AgentCategoriesUpdate(category_ids=[drinks.id]), db=db, _=manager
    )
    # Only the Drinks product is visible — not Snacks, not the uncategorized one.
    assert await _names(db, agent) == {"Cola"}


async def test_clearing_categories_restores_full_visibility(db):
    manager, agent, drinks, _snacks = await _setup(db)
    await users_router.set_agent_categories(
        agent.id, AgentCategoriesUpdate(category_ids=[drinks.id]), db=db, _=manager
    )
    await users_router.set_agent_categories(
        agent.id, AgentCategoriesUpdate(category_ids=[]), db=db, _=manager
    )
    assert await _names(db, agent) == {"Cola", "Chips", "Uncategorized"}


async def test_cannot_assign_categories_to_non_agent(db):
    manager, _agent, drinks, _snacks = await _setup(db)
    with pytest.raises(HTTPException) as exc:
        await users_router.set_agent_categories(
            manager.id, AgentCategoriesUpdate(category_ids=[drinks.id]), db=db, _=manager
        )
    assert exc.value.status_code == 400
