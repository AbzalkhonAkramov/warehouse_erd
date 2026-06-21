from datetime import date, datetime, time

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.activity import ActivityLog
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.activity import ActivityOut

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[ActivityOut])
async def list_activity(
    user_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[ActivityOut]:
    """Actions performed by all workers (super-admin only)."""
    stmt = (
        select(ActivityLog, User.full_name)
        .outerjoin(User, User.id == ActivityLog.user_id)
        .order_by(ActivityLog.id.desc())
        .limit(2000)
    )
    if user_id is not None:
        stmt = stmt.where(ActivityLog.user_id == user_id)
    if date_from is not None:
        stmt = stmt.where(ActivityLog.created_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        stmt = stmt.where(ActivityLog.created_at <= datetime.combine(date_to, time.max))
    if search:
        like = f"%{search}%"
        stmt = stmt.where(ActivityLog.action.ilike(like) | ActivityLog.path.ilike(like))

    out: list[ActivityOut] = []
    for log, name in (await db.execute(stmt)).all():
        item = ActivityOut.model_validate(log)
        item.user_name = name
        out.append(item)
    return out
