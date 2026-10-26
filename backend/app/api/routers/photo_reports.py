from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.associations import agent_topics
from app.models.enums import PhotoReportStatus, UserRole
from app.models.photo import PhotoReport
from app.models.telegram import TelegramTopic
from app.models.user import User
from app.schemas.photo import PhotoReportOut
from app.services import photo_service

router = APIRouter(prefix="/photo-reports", tags=["photo-reports"])


class TopicOption(BaseModel):
    id: int
    name: str


@router.get("/topics", response_model=list[TopicOption])
async def list_topic_options(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TopicOption]:
    """Active topics the caller may target (id + name only — no chat ids).

    Admins restrict which topics an agent sees via the agent_topics assignment;
    an agent with no assignment is unrestricted (sees every active topic)."""
    stmt = (
        select(TelegramTopic)
        .where(TelegramTopic.is_active.is_(True))
        .order_by(TelegramTopic.name)
    )
    if user.role == UserRole.AGENT:
        allowed = set(
            await db.scalars(
                select(agent_topics.c.topic_id).where(
                    agent_topics.c.agent_id == user.id
                )
            )
        )
        if allowed:
            stmt = stmt.where(TelegramTopic.id.in_(allowed))
    rows = await db.scalars(stmt)
    return [TopicOption(id=t.id, name=t.name) for t in rows]


@router.get("", response_model=list[PhotoReportOut])
async def list_reports(
    customer_id: int | None = Query(None),
    agent_id: int | None = Query(None),
    topic_id: int | None = Query(None),
    status: PhotoReportStatus | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PhotoReport]:
    stmt = (
        select(PhotoReport)
        .options(selectinload(PhotoReport.images))
        .order_by(PhotoReport.id.desc())
    )
    # Agents only ever see their own reports (the agent filter is ignored for them).
    if user.role == UserRole.AGENT:
        stmt = stmt.where(PhotoReport.agent_id == user.id)
    elif agent_id is not None:
        stmt = stmt.where(PhotoReport.agent_id == agent_id)
    if customer_id is not None:
        stmt = stmt.where(PhotoReport.customer_id == customer_id)
    if topic_id is not None:
        stmt = stmt.where(PhotoReport.topic_id == topic_id)
    if status is not None:
        stmt = stmt.where(PhotoReport.status == status)
    if date_from is not None:
        stmt = stmt.where(PhotoReport.created_at >= datetime.combine(date_from, time.min))
    if date_to is not None:
        # Inclusive of the whole end day.
        stmt = stmt.where(
            PhotoReport.created_at < datetime.combine(date_to + timedelta(days=1), time.min)
        )
    return list(await db.scalars(stmt))


@router.post("", response_model=PhotoReportOut, status_code=201)
async def create_report(
    customer_id: int = Form(...),
    sales_order_id: int | None = Form(None),
    topic_id: int | None = Form(None),
    note: str | None = Form(None),
    before: UploadFile = File(...),
    after: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    agent: User = Depends(get_current_user),
) -> PhotoReport:
    """Submit a before/after photo report; it is forwarded to the resolved topic."""
    report = await photo_service.create_report(
        db,
        agent,
        customer_id=customer_id,
        sales_order_id=sales_order_id,
        topic_id=topic_id,
        note=note,
        before=(await before.read(), before.filename or "before.jpg"),
        after=(await after.read(), after.filename or "after.jpg"),
    )
    return report


@router.post("/{report_id}/resend", response_model=PhotoReportOut)
async def resend_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.AGENT)),
) -> PhotoReport:
    return await photo_service.resend_report(db, report_id)
