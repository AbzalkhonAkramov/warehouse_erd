from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.telegram import TelegramTopic
from app.models.user import User
from app.schemas.telegram import TelegramUpdateHint, TopicCreate, TopicOut, TopicUpdate
from app.services import telegram

router = APIRouter(prefix="/telegram-topics", tags=["telegram"])

# Super-admin only.
_ADMIN = require_roles(UserRole.ADMIN)


async def _clear_other_defaults(db: AsyncSession, keep_id: int | None) -> None:
    rows = await db.scalars(select(TelegramTopic).where(TelegramTopic.is_default.is_(True)))
    for t in rows:
        if t.id != keep_id:
            t.is_default = False


@router.get("", response_model=list[TopicOut])
async def list_topics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_ADMIN),
) -> list[TelegramTopic]:
    return list(await db.scalars(select(TelegramTopic).order_by(TelegramTopic.id)))


@router.post("", response_model=TopicOut, status_code=status.HTTP_201_CREATED)
async def create_topic(
    data: TopicCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_ADMIN),
) -> TelegramTopic:
    topic = TelegramTopic(**data.model_dump())
    db.add(topic)
    await db.flush()
    if topic.is_default:
        await _clear_other_defaults(db, topic.id)
    return topic


@router.patch("/{topic_id}", response_model=TopicOut)
async def update_topic(
    topic_id: int,
    data: TopicUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_ADMIN),
) -> TelegramTopic:
    topic = await db.get(TelegramTopic, topic_id)
    if topic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topic not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    await db.flush()
    if topic.is_default:
        await _clear_other_defaults(db, topic.id)
    return topic


@router.get("/updates", response_model=list[TelegramUpdateHint])
async def discover_updates(_: User = Depends(_ADMIN)) -> list[TelegramUpdateHint]:
    """Read recent bot updates so the admin can find a group's chat_id and topic ids.

    Add the bot to the group, post a message in the target topic, then call this.
    """
    try:
        updates = await telegram.get_updates()
    except telegram.TelegramError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    hints: list[TelegramUpdateHint] = []
    for upd in updates:
        msg = upd.get("message") or upd.get("channel_post") or {}
        chat = msg.get("chat") or {}
        topic = msg.get("forum_topic_created") or {}
        hints.append(
            TelegramUpdateHint(
                chat_id=chat.get("id"),
                chat_title=chat.get("title"),
                chat_type=chat.get("type"),
                message_thread_id=msg.get("message_thread_id"),
                topic_name=topic.get("name"),
                text=msg.get("text"),
            )
        )
    return hints
