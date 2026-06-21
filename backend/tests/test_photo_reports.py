from pathlib import Path

import pytest

from app.core.config import settings
from app.core.security import hash_password
from app.models.enums import PhotoReportStatus, UserRole
from app.models.sales import Customer
from app.models.telegram import TelegramTopic
from app.models.user import User
from app.services import photo_service, telegram

pytestmark = pytest.mark.asyncio


async def _agent_and_customer(db):
    agent = User(full_name="A", email="a@e.l", role=UserRole.AGENT, hashed_password=hash_password("x"))
    db.add(agent)
    await db.flush()
    customer = Customer(name="Shop", agent_id=agent.id)
    db.add(customer)
    await db.flush()
    return agent, customer


async def test_create_report_sends_to_default_topic(db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    sent: list[dict] = []

    async def fake_send_photo(*, chat_id, photo, filename, caption, message_thread_id):
        sent.append({"chat_id": chat_id, "thread": message_thread_id, "caption": caption})
        return f"file_{len(sent)}"

    monkeypatch.setattr(telegram, "send_photo", fake_send_photo)

    db.add(TelegramTopic(name="Reports", chat_id=-100123, message_thread_id=7, is_default=True))
    agent, customer = await _agent_and_customer(db)

    report = await photo_service.create_report(
        db, agent,
        customer_id=customer.id, sales_order_id=None, topic_id=None, note="shelf done",
        before=(b"BEFOREBYTES", "b.jpg"), after=(b"AFTERBYTES", "a.jpg"),
    )

    assert report.status == PhotoReportStatus.SENT
    assert len(sent) == 2
    assert sent[0]["chat_id"] == -100123 and sent[0]["thread"] == 7
    # Files were written and image rows carry the returned telegram file ids.
    for img in report.images:
        assert (tmp_path / img.file_path).exists()
        assert img.telegram_file_id.startswith("file_")


async def test_report_failed_when_no_topic(db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    agent, customer = await _agent_and_customer(db)

    report = await photo_service.create_report(
        db, agent,
        customer_id=customer.id, sales_order_id=None, topic_id=None, note=None,
        before=(b"B", "b.jpg"), after=(b"A", "a.jpg"),
    )
    assert report.status == PhotoReportStatus.FAILED
    assert "topic" in (report.error or "").lower()


async def test_report_failed_on_telegram_error_then_resend(db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    db.add(TelegramTopic(name="R", chat_id=-1, is_default=True))
    agent, customer = await _agent_and_customer(db)

    async def boom(**_kwargs):
        raise telegram.TelegramError("chat not found")

    monkeypatch.setattr(telegram, "send_photo", boom)
    report = await photo_service.create_report(
        db, agent,
        customer_id=customer.id, sales_order_id=None, topic_id=None, note=None,
        before=(b"B", "b.jpg"), after=(b"A", "a.jpg"),
    )
    assert report.status == PhotoReportStatus.FAILED
    assert "chat not found" in report.error

    # Now Telegram recovers; resend should flip it to SENT.
    async def ok(**_kwargs):
        return "fid"

    monkeypatch.setattr(telegram, "send_photo", ok)
    again = await photo_service.resend_report(db, report.id)
    assert again.status == PhotoReportStatus.SENT
