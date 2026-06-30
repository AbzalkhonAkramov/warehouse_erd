import pytest

from app.core.security import hash_password
from app.models.catalog import Warehouse
from app.models.enums import PhotoReportStatus, SalesOrderStatus, UserRole
from app.models.sales import Customer, SalesOrder
from app.models.telegram import TelegramTopic
from app.models.user import User
from app.services import photo_service, telegram

pytestmark = pytest.mark.asyncio


async def _agent_and_customer(db):
    agent = User(full_name="A", email="a@e.l", role=UserRole.AGENT, hashed_password=hash_password("x"))
    db.add(agent)
    await db.flush()
    customer = Customer(name="Shop")
    db.add(customer)
    await db.flush()
    return agent, customer


async def _order(db, agent, customer, status: SalesOrderStatus) -> SalesOrder:
    wh = Warehouse(name="Main", is_default=True)
    db.add(wh)
    await db.flush()
    order = SalesOrder(
        customer_id=customer.id, agent_id=agent.id, warehouse_id=wh.id, status=status,
    )
    db.add(order)
    await db.flush()
    return order


async def test_create_report_sends_album_with_hashtags_and_link(db, monkeypatch):
    """Before/after go to Telegram as ONE album (no server files); the single caption
    carries order id, agent, a 24h date and #shop/#user/#order/#month hashtags, and
    each image row keeps a Telegram deep link."""
    calls: list[dict] = []

    async def fake_send_media_group(*, chat_id, photos, caption, message_thread_id):
        calls.append({"chat_id": chat_id, "thread": message_thread_id,
                      "caption": caption, "count": len(photos)})
        return [
            telegram.SentPhoto(
                message_id=100 + i,
                file_id=f"file_{i}",
                link=telegram.message_link(chat_id, 100 + i, message_thread_id),
            )
            for i in range(len(photos))
        ]

    monkeypatch.setattr(telegram, "send_media_group", fake_send_media_group)

    db.add(TelegramTopic(name="Reports", chat_id=-1001234567890, message_thread_id=7, is_default=True))
    agent, customer = await _agent_and_customer(db)
    order = await _order(db, agent, customer, SalesOrderStatus.SHIPPED)

    report = await photo_service.create_report(
        db, agent,
        customer_id=customer.id, sales_order_id=order.id, topic_id=None, note="shelf done",
        before=(b"BEFOREBYTES", "b.jpg"), after=(b"AFTERBYTES", "a.jpg"),
    )

    assert report.status == PhotoReportStatus.SENT
    # Exactly one message (album) with both photos.
    assert len(calls) == 1 and calls[0]["count"] == 2
    assert calls[0]["chat_id"] == -1001234567890 and calls[0]["thread"] == 7
    cap = calls[0]["caption"]
    assert f"Order #{order.id}" in cap
    assert "shelf done" in cap
    assert agent.full_name in cap and customer.name in cap
    assert f"#order_{order.id}" in cap and "#shop_" in cap and "#user_" in cap and "#month_" in cap
    assert "Date: " in cap
    # No server file path; each image carries a Telegram deep link instead.
    for img in report.images:
        assert img.file_path is None
        assert img.telegram_link is not None and img.telegram_link.startswith("https://t.me/c/")
        assert img.telegram_message_id is not None


async def test_report_failed_when_no_topic(db):
    agent, customer = await _agent_and_customer(db)

    report = await photo_service.create_report(
        db, agent,
        customer_id=customer.id, sales_order_id=None, topic_id=None, note=None,
        before=(b"B", "b.jpg"), after=(b"A", "a.jpg"),
    )
    assert report.status == PhotoReportStatus.FAILED
    assert "topic" in (report.error or "").lower()
    # Failed sends leave no link behind.
    assert all(img.telegram_link is None for img in report.images)


async def test_report_rejected_when_order_not_shipped(db, monkeypatch):
    """A report pinned to an order is only allowed while the order is shipped; a
    delivered order is refused (409) before anything is sent."""
    from fastapi import HTTPException

    sent: list = []

    async def fake_send_media_group(**_kwargs):
        sent.append(1)
        return []

    monkeypatch.setattr(telegram, "send_media_group", fake_send_media_group)
    db.add(TelegramTopic(name="R", chat_id=-1001234567890, is_default=True))
    agent, customer = await _agent_and_customer(db)
    order = await _order(db, agent, customer, SalesOrderStatus.DELIVERED)

    with pytest.raises(HTTPException) as exc:
        await photo_service.create_report(
            db, agent,
            customer_id=customer.id, sales_order_id=order.id, topic_id=None, note=None,
            before=(b"B", "b.jpg"), after=(b"A", "a.jpg"),
        )
    assert exc.value.status_code == 409
    assert "shipped" in str(exc.value.detail).lower()
    assert sent == []  # nothing was sent to Telegram


async def test_resend_is_rejected_telegram_only(db, monkeypatch):
    """Resending is impossible: nothing is stored on the server to re-upload."""
    from fastapi import HTTPException

    db.add(TelegramTopic(name="R", chat_id=-1, is_default=True))
    agent, customer = await _agent_and_customer(db)

    async def boom(**_kwargs):
        raise telegram.TelegramError("chat not found")

    monkeypatch.setattr(telegram, "send_media_group", boom)
    report = await photo_service.create_report(
        db, agent,
        customer_id=customer.id, sales_order_id=None, topic_id=None, note=None,
        before=(b"B", "b.jpg"), after=(b"A", "a.jpg"),
    )
    assert report.status == PhotoReportStatus.FAILED
    assert "chat not found" in report.error

    with pytest.raises(HTTPException) as exc:
        await photo_service.resend_report(db, report.id)
    assert exc.value.status_code == 409
