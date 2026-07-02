from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CashRemittanceStatus


class CashSummaryOut(BaseModel):
    """An agent's cash position (their own view)."""

    collected: Decimal   # all payments the agent collected
    received: Decimal     # already handed over and confirmed by a manager
    pending: Decimal      # declared, awaiting manager confirmation
    outstanding: Decimal  # collected − received (money still 'with agent')
    available: Decimal    # collected − received − pending (free to hand over)
    mode: str             # cash_handover_mode


class AgentCashOut(BaseModel):
    agent_id: int
    agent_name: str
    collected: Decimal
    received: Decimal
    pending: Decimal
    outstanding: Decimal


class RemittanceSubmit(BaseModel):
    """Agent declares a handover (agent_submits mode)."""

    amount: Decimal = Field(gt=0)
    note: str | None = None


class RemittanceReceive(BaseModel):
    """Manager records cash received from an agent."""

    agent_id: int
    amount: Decimal = Field(gt=0)
    note: str | None = None


class RemittanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    agent_id: int
    agent_name: str | None = None
    amount: Decimal
    status: CashRemittanceStatus
    note: str | None
    created_at: datetime
    received_at: datetime | None
    received_by_name: str | None = None
