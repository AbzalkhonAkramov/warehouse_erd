from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class AgentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str


class CustomerBase(BaseModel):
    name: str
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    # Comma-separated weekday codes the agent may visit, e.g. "mon,wed,fri".
    visit_days: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    credit_limit: Decimal = Decimal("0")
    region_id: int | None = None


class CustomerCreate(CustomerBase):
    # Agents pinned to this market (a manager may pin several).
    agent_ids: list[int] = []


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    visit_days: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    credit_limit: Decimal | None = None
    region_id: int | None = None
    agent_ids: list[int] | None = None


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    debt: Decimal
    region_name: str | None = None
    agents: list[AgentBrief] = []
    # Convenience: ids only, so the web doesn't have to map.
    agent_ids: list[int] = []


class VisitDaysUpdate(BaseModel):
    """Set the days an agent may visit a market (comma-separated weekday codes)."""

    visit_days: str | None = None


class AgentShopsUpdate(BaseModel):
    """Set which shops belong to an agent (managed by a manager, like categories)."""

    customer_ids: list[int]


class RegionCreate(BaseModel):
    name: str


class RegionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
