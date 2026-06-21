from sqlalchemy import BigInteger, Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TelegramTopic(Base, TimestampMixin):
    """A destination for photo reports: a forum topic inside a Telegram group.

    Configured by the super-admin. ``chat_id`` is the group id (negative for
    supergroups); ``message_thread_id`` is the forum topic id (omit for the
    group's General thread).
    """

    __tablename__ = "telegram_topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    chat_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    message_thread_id: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
