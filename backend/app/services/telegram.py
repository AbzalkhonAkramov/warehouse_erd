"""Telegram notification helper.

Fire-and-forget messages to managers/agents. If no bot token is configured
(typical in local dev) the calls become harmless no-ops that just log.
"""

import json
import logging
from typing import NamedTuple

import httpx

from app.core.config import settings

logger = logging.getLogger("telegram")

_API = "https://api.telegram.org/bot{token}/sendMessage"


async def send_message(chat_id: str | None, text: str) -> None:
    if not settings.TELEGRAM_BOT_TOKEN or not chat_id:
        logger.info("Telegram disabled or no chat_id; would send: %s", text)
        return
    url = _API.format(token=settings.TELEGRAM_BOT_TOKEN)
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
    except httpx.HTTPError as exc:  # never let a notification break the request
        logger.warning("Failed to send Telegram message: %s", exc)


async def notify_managers(text: str) -> None:
    await send_message(settings.TELEGRAM_MANAGER_CHAT_ID, text)


class TelegramError(RuntimeError):
    pass


class SentPhoto(NamedTuple):
    """Identifiers of a photo message that was delivered to Telegram."""

    message_id: int
    file_id: str
    link: str | None


def _require_token() -> str:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise TelegramError("TELEGRAM_BOT_TOKEN is not configured")
    return settings.TELEGRAM_BOT_TOKEN


def message_link(
    chat_id: int | str, message_id: int, message_thread_id: int | None = None
) -> str | None:
    """Build a t.me deep link to a specific message in a private supergroup.

    Supergroup chat ids look like ``-100XXXXXXXXXX``; the link uses the ``XXXXXXXXXX``
    part: ``https://t.me/c/<id>/<thread?>/<message>``. Returns None if the chat id is
    not a supergroup id (no shareable web link exists for it)."""
    s = str(chat_id)
    if not s.startswith("-100"):
        return None
    internal = s[4:]
    if message_thread_id is not None:
        return f"https://t.me/c/{internal}/{message_thread_id}/{message_id}"
    return f"https://t.me/c/{internal}/{message_id}"


async def send_photo(
    chat_id: int | str,
    photo: bytes,
    filename: str,
    caption: str | None = None,
    message_thread_id: int | None = None,
) -> SentPhoto:
    """Send a photo to a chat/topic. Returns the message id, the largest photo's
    file_id, and a deep link to the message.

    Raises TelegramError on failure (callers decide how to record it).
    """
    token = _require_token()
    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    data: dict[str, str] = {"chat_id": str(chat_id)}
    if caption:
        data["caption"] = caption
    if message_thread_id is not None:
        data["message_thread_id"] = str(message_thread_id)
    files = {"photo": (filename, photo, "application/octet-stream")}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, data=data, files=files)
        body = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise TelegramError(f"Telegram request failed: {exc}") from exc
    if not body.get("ok"):
        raise TelegramError(body.get("description", "Unknown Telegram error"))
    result = body["result"]
    message_id = int(result["message_id"])
    sizes = result.get("photo", [])
    file_id = sizes[-1]["file_id"] if sizes else ""
    return SentPhoto(
        message_id=message_id,
        file_id=file_id,
        link=message_link(chat_id, message_id, message_thread_id),
    )


async def send_media_group(
    chat_id: int | str,
    photos: list[tuple[bytes, str]],
    caption: str | None = None,
    message_thread_id: int | None = None,
) -> list[SentPhoto]:
    """Send several photos as ONE album message. The caption (if any) is attached to
    the first photo so it shows once for the whole album. Returns one SentPhoto per
    image (each with the message id + a deep link to that photo in the album).

    Raises TelegramError on failure.
    """
    token = _require_token()
    url = f"https://api.telegram.org/bot{token}/sendMediaGroup"
    files: dict[str, tuple[str, bytes, str]] = {}
    media: list[dict] = []
    for i, (data, filename) in enumerate(photos):
        key = f"file{i}"
        files[key] = (filename, data, "application/octet-stream")
        item: dict = {"type": "photo", "media": f"attach://{key}"}
        if i == 0 and caption:
            item["caption"] = caption
        media.append(item)
    payload: dict[str, str] = {"chat_id": str(chat_id), "media": json.dumps(media)}
    if message_thread_id is not None:
        payload["message_thread_id"] = str(message_thread_id)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, data=payload, files=files)
        body = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise TelegramError(f"Telegram request failed: {exc}") from exc
    if not body.get("ok"):
        raise TelegramError(body.get("description", "Unknown Telegram error"))
    out: list[SentPhoto] = []
    for msg in body["result"]:
        message_id = int(msg["message_id"])
        sizes = msg.get("photo", [])
        file_id = sizes[-1]["file_id"] if sizes else ""
        out.append(
            SentPhoto(
                message_id=message_id,
                file_id=file_id,
                link=message_link(chat_id, message_id, message_thread_id),
            )
        )
    return out


async def get_updates() -> list[dict]:
    """Fetch recent updates — used by admins to discover group chat_id / topic ids."""
    token = _require_token()
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
        body = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise TelegramError(f"Telegram request failed: {exc}") from exc
    if not body.get("ok"):
        raise TelegramError(body.get("description", "Unknown Telegram error"))
    return body.get("result", [])
