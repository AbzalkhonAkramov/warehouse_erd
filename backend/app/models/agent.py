from sqlalchemy import ForeignKey, Numeric, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AgentTarget(Base, TimestampMixin):
    """A monthly sales target for an agent (used by the commission/targets report)."""

    __tablename__ = "agent_targets"
    __table_args__ = (
        UniqueConstraint("agent_id", "year", "month", name="uq_agent_target_period"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1–12
    target_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
