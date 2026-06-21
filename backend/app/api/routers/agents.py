from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.agent import AgentTarget
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.agent import AgentTargetCreate, AgentTargetOut

router = APIRouter(prefix="/agent-targets", tags=["agents"])


@router.get("", response_model=list[AgentTargetOut])
async def list_targets(
    agent_id: int | None = None,
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> list[AgentTarget]:
    stmt = select(AgentTarget).order_by(AgentTarget.year.desc(), AgentTarget.month.desc())
    if agent_id is not None:
        stmt = stmt.where(AgentTarget.agent_id == agent_id)
    if year is not None:
        stmt = stmt.where(AgentTarget.year == year)
    return list(await db.scalars(stmt))


@router.post("", response_model=AgentTargetOut, status_code=status.HTTP_201_CREATED)
async def set_target(
    data: AgentTargetCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> AgentTarget:
    agent = await db.get(User, data.agent_id)
    if agent is None or agent.role != UserRole.AGENT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "agent_id must reference an agent user")
    # Upsert on (agent, year, month).
    existing = await db.scalar(
        select(AgentTarget).where(
            AgentTarget.agent_id == data.agent_id,
            AgentTarget.year == data.year,
            AgentTarget.month == data.month,
        )
    )
    if existing:
        existing.target_amount = data.target_amount
        await db.flush()
        return existing
    target = AgentTarget(**data.model_dump())
    db.add(target)
    await db.flush()
    return target
