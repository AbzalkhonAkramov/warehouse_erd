"""Agent cash custody: track how much collected cash each agent still holds and
record handovers to the manager.

Balance model (per agent):
  collected   = Σ payments the agent collected (all methods)
  received    = Σ remittances confirmed RECEIVED
  pending     = Σ remittances still PENDING (agent_submits mode)
  outstanding = collected − received                (money 'with agent')
  available   = collected − received − pending      (free to hand over)
"""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.enums import CashRemittanceStatus, UserRole
from app.models.finance import CashRemittance, Payment
from app.models.setting import CompanySettings
from app.models.user import User
from app.schemas.cash import (
    AgentCashOut,
    CashSummaryOut,
    RemittanceOut,
    RemittanceReceive,
    RemittanceSubmit,
)

router = APIRouter(prefix="/cash", tags=["cash"])

ZERO = Decimal("0")


async def _handover_mode(db: AsyncSession) -> str:
    mode = await db.scalar(select(CompanySettings.cash_handover_mode).limit(1))
    return mode or "manager_records"


async def _totals(db: AsyncSession, agent_id: int) -> dict[str, Decimal]:
    collected = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.collected_by_id == agent_id
        )
    )
    received = await db.scalar(
        select(func.coalesce(func.sum(CashRemittance.amount), 0)).where(
            CashRemittance.agent_id == agent_id,
            CashRemittance.status == CashRemittanceStatus.RECEIVED,
        )
    )
    pending = await db.scalar(
        select(func.coalesce(func.sum(CashRemittance.amount), 0)).where(
            CashRemittance.agent_id == agent_id,
            CashRemittance.status == CashRemittanceStatus.PENDING,
        )
    )
    c, r, p = Decimal(collected), Decimal(received), Decimal(pending)
    return {
        "collected": c,
        "received": r,
        "pending": p,
        "outstanding": c - r,
        "available": c - r - p,
    }


@router.get("/summary", response_model=CashSummaryOut)
async def my_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CashSummaryOut:
    """The current user's own cash position + the active handover mode."""
    t = await _totals(db, user.id)
    return CashSummaryOut(mode=await _handover_mode(db), **t)


@router.get("/agents", response_model=list[AgentCashOut])
async def agents_cash(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> list[AgentCashOut]:
    """Cash position of everyone who collects money — agents and deliverers
    (for the manager's 'receive money' page)."""
    agents = list(
        await db.scalars(
            select(User)
            .where(User.role.in_([UserRole.AGENT, UserRole.DELIVERER]))
            .order_by(User.full_name)
        )
    )
    out: list[AgentCashOut] = []
    for a in agents:
        t = await _totals(db, a.id)
        out.append(AgentCashOut(agent_id=a.id, agent_name=a.full_name, **t))
    return out


async def _remittance_out(db: AsyncSession, r: CashRemittance) -> RemittanceOut:
    agent = await db.get(User, r.agent_id)
    receiver = await db.get(User, r.received_by_id) if r.received_by_id else None
    out = RemittanceOut.model_validate(r)
    out.agent_name = agent.full_name if agent else None
    out.received_by_name = receiver.full_name if receiver else None
    return out


@router.post("/submit", response_model=RemittanceOut, status_code=201)
async def submit_handover(
    data: RemittanceSubmit,
    db: AsyncSession = Depends(get_db),
    agent: User = Depends(get_current_user),
) -> RemittanceOut:
    """Agent declares a handover (agent_submits mode) — a manager confirms it."""
    if await _handover_mode(db) != "agent_submits":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Handovers are recorded by the manager in the current mode.",
        )
    t = await _totals(db, agent.id)
    if Decimal(data.amount) > t["available"]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Amount exceeds what you can hand over ({t['available']}).",
        )
    r = CashRemittance(
        agent_id=agent.id,
        amount=data.amount,
        status=CashRemittanceStatus.PENDING,
        note=data.note,
        created_by_id=agent.id,
    )
    db.add(r)
    await db.flush()
    return await _remittance_out(db, r)


@router.post("/receive", response_model=RemittanceOut, status_code=201)
async def receive_cash(
    data: RemittanceReceive,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> RemittanceOut:
    """Manager records cash received from an agent (reduces the agent's balance)."""
    agent = await db.get(User, data.agent_id)
    if agent is None or agent.role not in (UserRole.AGENT, UserRole.DELIVERER):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collector not found")
    t = await _totals(db, agent.id)
    if Decimal(data.amount) > t["available"]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Amount exceeds the agent's outstanding cash ({t['available']}).",
        )
    r = CashRemittance(
        agent_id=agent.id,
        amount=data.amount,
        status=CashRemittanceStatus.RECEIVED,
        note=data.note,
        created_by_id=manager.id,
        received_by_id=manager.id,
        received_at=datetime.now(timezone.utc),
    )
    db.add(r)
    await db.flush()
    return await _remittance_out(db, r)


@router.post("/remittances/{rid}/confirm", response_model=RemittanceOut)
async def confirm_remittance(
    rid: int,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> RemittanceOut:
    """Confirm a pending agent-submitted handover (money now with the manager)."""
    r = await db.get(CashRemittance, rid)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Remittance not found")
    if r.status != CashRemittanceStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "Remittance is not pending")
    r.status = CashRemittanceStatus.RECEIVED
    r.received_by_id = manager.id
    r.received_at = datetime.now(timezone.utc)
    await db.flush()
    return await _remittance_out(db, r)


@router.post("/remittances/{rid}/reject", status_code=204)
async def reject_remittance(
    rid: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> None:
    """Reject a pending handover (deletes it; the amount returns to the agent)."""
    r = await db.get(CashRemittance, rid)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Remittance not found")
    if r.status != CashRemittanceStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only pending handovers can be rejected")
    await db.delete(r)
    await db.flush()


@router.get("/remittances", response_model=list[RemittanceOut])
async def list_remittances(
    agent_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RemittanceOut]:
    """Handover history. Agents see their own; managers may filter by agent."""
    agent = aliased(User)
    receiver = aliased(User)
    stmt = (
        select(CashRemittance, agent.full_name, receiver.full_name)
        .outerjoin(agent, agent.id == CashRemittance.agent_id)
        .outerjoin(receiver, receiver.id == CashRemittance.received_by_id)
        .order_by(CashRemittance.id.desc())
    )
    if user.role == UserRole.AGENT:
        stmt = stmt.where(CashRemittance.agent_id == user.id)
    elif agent_id is not None:
        stmt = stmt.where(CashRemittance.agent_id == agent_id)

    rows = (await db.execute(stmt)).all()
    result: list[RemittanceOut] = []
    for r, agent_name, receiver_name in rows:
        out = RemittanceOut.model_validate(r)
        out.agent_name = agent_name
        out.received_by_name = receiver_name
        result.append(out)
    return result
