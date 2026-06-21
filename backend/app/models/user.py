from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import UserRole


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.AGENT, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Set when the user submits a "forgot password" request; cleared on reset.
    reset_requested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Commission percentage on the agent's sales (0–100). Used by commission report.
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)

    # Telegram chat id for personal notifications (e.g. an agent's order approved)
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64))

    # Default Telegram topic this agent's photo reports route to (admin-assigned).
    default_topic_id: Mapped[int | None] = mapped_column(ForeignKey("telegram_topics.id"))

    # Customers assigned to this user when role == AGENT
    customers: Mapped[list["Customer"]] = relationship(  # noqa: F821
        back_populates="agent", foreign_keys="Customer.agent_id"
    )
