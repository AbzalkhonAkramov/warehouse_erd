from sqlalchemy import BigInteger, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import PhotoReportStatus, PhotoStage


class PhotoReport(Base, TimestampMixin):
    """A before/after photo report submitted by a field agent and forwarded to a
    Telegram group topic. The images live in Telegram only — they are never stored
    on the server; we keep just a deep link to each message."""

    __tablename__ = "photo_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    sales_order_id: Mapped[int | None] = mapped_column(ForeignKey("sales_orders.id"))
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("telegram_topics.id"))

    note: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PhotoReportStatus] = mapped_column(
        Enum(PhotoReportStatus), default=PhotoReportStatus.PENDING, nullable=False
    )
    error: Mapped[str | None] = mapped_column(Text)

    images: Mapped[list["PhotoReportImage"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )


class PhotoReportImage(Base):
    __tablename__ = "photo_report_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("photo_reports.id"), nullable=False)
    stage: Mapped[PhotoStage] = mapped_column(Enum(PhotoStage), nullable=False)
    # Legacy server path (kept for old rows only; new reports are Telegram-only).
    file_path: Mapped[str | None] = mapped_column(String(255))
    telegram_file_id: Mapped[str | None] = mapped_column(String(255))
    # The Telegram message id and a deep link managers click to view the photo.
    telegram_message_id: Mapped[int | None] = mapped_column(BigInteger)
    telegram_link: Mapped[str | None] = mapped_column(String(255))

    report: Mapped["PhotoReport"] = relationship(back_populates="images")
