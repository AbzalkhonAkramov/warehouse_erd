from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AgentTargetCreate(BaseModel):
    agent_id: int
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    target_amount: Decimal = Field(ge=0)


class AgentTargetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    agent_id: int
    year: int
    month: int
    target_amount: Decimal


class CommissionRow(BaseModel):
    agent_id: int
    agent_name: str
    commission_rate: Decimal
    sales_total: Decimal
    commission: Decimal
    target: Decimal | None
    achievement_pct: float | None
