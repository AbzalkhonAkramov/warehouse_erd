"""Telegram notification helper.

Fire-and-forget messages to managers/agents. If no bot token is configured
(typical in local dev) the calls become harmless no-ops that just log.
"""

import logging

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


def _require_token() -> str:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise TelegramError("TELEGRAM_BOT_TOKEN is not configured")
    return settings.TELEGRAM_BOT_TOKEN


async def send_photo(
    chat_id: int | str,
    photo: bytes,
    filename: str,
    caption: str | None = None,
    message_thread_id: int | None = None,
) -> str:
    """Send a photo to a chat/topic. Returns the largest photo's Telegram file_id.

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
    sizes = body["result"].get("photo", [])
    return sizes[-1]["file_id"] if sizes else ""


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
