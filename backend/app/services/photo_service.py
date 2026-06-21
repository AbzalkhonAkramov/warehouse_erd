"""Photo reports: persist before/after images and forward them to a Telegram topic.

Topic resolution order: explicit ``topic_id`` on the request → the agent's
assigned ``default_topic_id`` → the topic flagged ``is_default``.
"""

import uuid
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.enums import PhotoReportStatus, PhotoStage
from app.models.photo import PhotoReport, PhotoReportImage
from app.models.sales import Customer
from app.models.telegram import TelegramTopic
from app.models.user import User

_PHOTO_SUBDIR = "photo_reports"


def _upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR) / _PHOTO_SUBDIR
    root.mkdir(parents=True, exist_ok=True)
    return root


def _save_file(content: bytes, original_name: str) -> str:
    suffix = Path(original_name).suffix.lower() or ".jpg"
    name = f"{uuid.uuid4().hex}{suffix}"
    (_upload_root() / name).write_bytes(content)
    # Path stored relative to UPLOAD_DIR so it maps to /uploads/<...>.
    return f"{_PHOTO_SUBDIR}/{name}"


async def _resolve_topic(
    db: AsyncSession, agent: User, topic_id: int | None
) -> TelegramTopic | None:
    if topic_id is not None:
        return await db.get(TelegramTopic, topic_id)
    if agent.default_topic_id is not None:
        return await db.get(TelegramTopic, agent.default_topic_id)
    return await db.scalar(
        select(TelegramTopic).where(
            TelegramTopic.is_default.is_(True), TelegramTopic.is_active.is_(True)
        )
    )


async def _send_report(db: AsyncSession, report: PhotoReport) -> None:
    """Send all of a report's images to its topic; update status in place."""
    # Imported here to keep the Telegram dependency lazy/testable.
    from app.services import telegram

    topic = await db.get(TelegramTopic, report.topic_id) if report.topic_id else None
    if topic is None or not topic.is_active:
        report.status = PhotoReportStatus.FAILED
        report.error = "No active Telegram topic resolved for this report"
        return

    agent = await db.get(User, report.agent_id)
    customer = await db.get(Customer, report.customer_id)
    try:
        for image in sorted(report.images, key=lambda i: i.stage.value):
            caption = f"{image.stage.value.upper()} — {customer.name} · {agent.full_name}"
            if report.note:
                caption += f"\n{report.note}"
            data = (Path(settings.UPLOAD_DIR) / image.file_path).read_bytes()
            file_id = await telegram.send_photo(
                chat_id=topic.chat_id,
                photo=data,
                filename=Path(image.file_path).name,
                caption=caption,
                message_thread_id=topic.message_thread_id,
            )
            image.telegram_file_id = file_id
        report.status = PhotoReportStatus.SENT
        report.error = None
    except telegram.TelegramError as exc:
        report.status = PhotoReportStatus.FAILED
        report.error = str(exc)


async def create_report(
    db: AsyncSession,
    agent: User,
    *,
    customer_id: int,
    sales_order_id: int | None,
    topic_id: int | None,
    note: str | None,
    before: tuple[bytes, str],
    after: tuple[bytes, str],
) -> PhotoReport:
    customer = await db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

    topic = await _resolve_topic(db, agent, topic_id)

    report = PhotoReport(
        agent_id=agent.id,
        customer_id=customer_id,
        sales_order_id=sales_order_id,
        topic_id=topic.id if topic else None,
        note=note,
        status=PhotoReportStatus.PENDING,
    )
    report.images.append(
        PhotoReportImage(stage=PhotoStage.BEFORE, file_path=_save_file(*before))
    )
    report.images.append(
        PhotoReportImage(stage=PhotoStage.AFTER, file_path=_save_file(*after))
    )
    db.add(report)
    await db.flush()

    await _send_report(db, report)
    await db.flush()
    return report


async def resend_report(db: AsyncSession, report_id: int) -> PhotoReport:
    report = await db.scalar(
        select(PhotoReport)
        .where(PhotoReport.id == report_id)
        .options(selectinload(PhotoReport.images))
    )
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo report not found")
    await _send_report(db, report)
    await db.flush()
    return report
