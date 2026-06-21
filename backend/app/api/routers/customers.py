from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.associations import customer_agents
from app.models.enums import UserRole
from app.models.sales import Customer
from app.models.user import User
from app.schemas.customer import (
    AgentBrief,
    AgentShopsUpdate,
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
)

router = APIRouter(prefix="/customers", tags=["customers"])

_EAGER = (selectinload(Customer.agents), selectinload(Customer.region))


def _to_out(c: Customer) -> CustomerOut:
    out = CustomerOut.model_validate(c)
    out.region_name = c.region.name if c.region else None
    out.agents = [AgentBrief(id=a.id, full_name=a.full_name) for a in c.agents]
    out.agent_ids = [a.id for a in c.agents]
    return out


async def _load(db: AsyncSession, customer_id: int) -> Customer:
    c = await db.scalar(
        select(Customer)
        .where(Customer.id == customer_id)
        .options(*_EAGER)
        .execution_options(populate_existing=True)
    )
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    return c


@router.get("", response_model=list[CustomerOut])
async def list_customers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CustomerOut]:
    stmt = select(Customer).options(*_EAGER).order_by(Customer.name)
    # Agents only see their own markets; managers/admin see all.
    if user.role == UserRole.AGENT:
        stmt = stmt.where(Customer.agents.any(User.id == user.id))
    return [_to_out(c) for c in await db.scalars(stmt)]


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CustomerOut:
    c = await _load(db, customer_id)
    if user.role == UserRole.AGENT and user.id not in [a.id for a in c.agents]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This shop is not assigned to you")
    return _to_out(c)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CustomerOut:
    payload = data.model_dump(exclude={"agent_ids"})
    customer = Customer(**payload)

    agent_ids = set(data.agent_ids)
    if user.role == UserRole.AGENT:
        agent_ids.add(user.id)  # an agent creating a shop pins it to themselves
    if agent_ids:
        customer.agents = list(await db.scalars(select(User).where(User.id.in_(agent_ids))))

    db.add(customer)
    await db.flush()
    return _to_out(await _load(db, customer.id))


@router.put("/agent-shops/{agent_id}", response_model=list[CustomerOut])
async def set_agent_shops(
    agent_id: int,
    data: AgentShopsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> list[CustomerOut]:
    """Pin exactly this set of markets to the agent (managers only). Other agents on
    those markets are left untouched (many-to-many)."""
    await db.execute(delete(customer_agents).where(customer_agents.c.agent_id == agent_id))
    for cid in set(data.customer_ids):
        await db.execute(insert(customer_agents).values(customer_id=cid, agent_id=agent_id))
    await db.flush()
    stmt = (
        select(Customer)
        .where(Customer.agents.any(User.id == agent_id))
        .options(*_EAGER)
        .order_by(Customer.name)
    )
    return [_to_out(c) for c in await db.scalars(stmt)]


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> CustomerOut:
    customer = await _load(db, customer_id)
    payload = data.model_dump(exclude_unset=True, exclude={"agent_ids"})
    for field, value in payload.items():
        setattr(customer, field, value)
    if data.agent_ids is not None:
        customer.agents = list(
            await db.scalars(select(User).where(User.id.in_(set(data.agent_ids))))
        )
    await db.flush()
    return _to_out(await _load(db, customer.id))
