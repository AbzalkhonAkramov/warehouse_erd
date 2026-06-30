"""Photo reports: forward before/after images to a Telegram group topic.

The images are stored in Telegram ONLY — they are never written to the server.
We keep just a deep link to each Telegram message so managers can click through.

Topic resolution order: explicit ``topic_id`` on the request → the agent's
assigned ``default_topic_id`` → the topic flagged ``is_default``.
"""

import re
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import PhotoReportStatus, PhotoStage, SalesOrderStatus
from app.models.photo import PhotoReport, PhotoReportImage
from app.models.sales import Customer, SalesOrder
from app.models.telegram import TelegramTopic
from app.models.user import User

# Uzbekistan local time (the app's working timezone, no DST).
_TZ = ZoneInfo("Asia/Tashkent")


def _slug(text: str | None) -> str:
    """Turn a name into a hashtag-safe token: letters/digits kept (Unicode ok),
    every run of spaces/punctuation becomes a single underscore."""
    s = re.sub(r"[^\w]+", "_", text or "", flags=re.UNICODE)
    return re.sub(r"_+", "_", s).strip("_")[:40]


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


def _caption(report: PhotoReport, customer: Customer, agent: User) -> str:
    """One caption for the before/after album: shop, who sent it, order id, the
    short date+time (24h, Tashkent) and the agent's comment — plus hashtags
    (#shop / #user / #order / #month) for easy searching inside Telegram."""
    now = datetime.now(_TZ)
    order = f"Order #{report.sales_order_id}" if report.sales_order_id else "No order"
    lines = [
        f"📸 Before / After — {customer.name}",
        order,
        f"Agent: {agent.full_name}",
        f"Date: {now:%d.%m.%Y %H:%M}",
    ]
    if report.note:
        lines.append(f"Comment: {report.note}")

    shop_tag = f"#shop_{_slug(customer.name) or customer.id}"
    user_tag = f"#user_{_slug(agent.full_name) or agent.id}"
    order_tag = f"#order_{report.sales_order_id}" if report.sales_order_id else "#no_order"
    month_tag = f"#month_{now:%Y_%m}"
    lines.append(" ".join([shop_tag, user_tag, order_tag, month_tag]))
    return "\n".join(lines)


async def _send_report(
    db: AsyncSession,
    report: PhotoReport,
    payloads: dict[PhotoStage, tuple[bytes, str]],
) -> None:
    """Forward the before/after photos to the report's topic as ONE album message
    and record the per-photo message links. The bytes are sent straight to Telegram
    and discarded (never stored)."""
    # Imported here to keep the Telegram dependency lazy/testable.
    from app.services import telegram

    topic = await db.get(TelegramTopic, report.topic_id) if report.topic_id else None
    if topic is None or not topic.is_active:
        report.status = PhotoReportStatus.FAILED
        report.error = "No active Telegram topic resolved for this report"
        return

    agent = await db.get(User, report.agent_id)
    customer = await db.get(Customer, report.customer_id)
    by_stage = {img.stage: img for img in report.images}
    # Album order: BEFORE first, then AFTER.
    stages = [s for s in (PhotoStage.BEFORE, PhotoStage.AFTER) if s in payloads]
    try:
        sent = await telegram.send_media_group(
            chat_id=topic.chat_id,
            photos=[payloads[s] for s in stages],
            caption=_caption(report, customer, agent),
            message_thread_id=topic.message_thread_id,
        )
        for stage, msg in zip(stages, sent):
            image = by_stage.get(stage)
            if image is None:
                continue
            image.telegram_file_id = msg.file_id
            image.telegram_message_id = msg.message_id
            image.telegram_link = msg.link
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

    # A report pinned to an order is only allowed while that order is SHIPPED
    # (before it is delivered). Reports with no order are always allowed.
    if sales_order_id is not None:
        order = await db.get(SalesOrder, sales_order_id)
        if order is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
        if order.status != SalesOrderStatus.SHIPPED:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "A photo report can only be sent while the order is shipped.",
            )

    topic = await _resolve_topic(db, agent, topic_id)

    report = PhotoReport(
        agent_id=agent.id,
        customer_id=customer_id,
        sales_order_id=sales_order_id,
        topic_id=topic.id if topic else None,
        note=note,
        status=PhotoReportStatus.PENDING,
    )
    report.images.append(PhotoReportImage(stage=PhotoStage.BEFORE))
    report.images.append(PhotoReportImage(stage=PhotoStage.AFTER))
    db.add(report)
    await db.flush()

    await _send_report(
        db, report, {PhotoStage.BEFORE: before, PhotoStage.AFTER: after}
    )
    await db.flush()
    return report


async def resend_report(db: AsyncSession, report_id: int) -> PhotoReport:
    """Resending is not possible: the images are kept in Telegram only, so the
    server has no copy to re-upload. The agent must submit a new report."""
    report = await db.scalar(
        select(PhotoReport)
        .where(PhotoReport.id == report_id)
        .options(selectinload(PhotoReport.images))
    )
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo report not found")
    raise HTTPException(
        status.HTTP_409_CONFLICT,
        "Photos are stored in Telegram only and cannot be re-sent from the server. "
        "Ask the agent to submit the report again.",
    )
