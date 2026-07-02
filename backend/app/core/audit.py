"""Pure-ASGI middleware that records every successful write-action to the activity
log. It writes *after* the response is fully sent (so the request's DB session is
already released — important for SQLite's single-writer lock)."""

import json
import logging

_log = logging.getLogger("audit")

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import decode_access_token
from app.models.activity import ActivityLog

_WRITE_METHODS = {"POST", "PATCH", "PUT", "DELETE"}

# Never record these fields' values (secrets).
_REDACT = ("password", "token", "secret", "hashed")


def _summarize_body(raw: bytes) -> str | None:
    """Turn a JSON request body into a short 'field=value, ...' summary so the
    activity log shows *what* was sent/changed, not just the action."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(data, dict):
        return None

    parts: list[str] = []
    for key, value in data.items():
        if any(s in key.lower() for s in _REDACT):
            parts.append(f"{key}=***")
        elif isinstance(value, list):
            parts.append(f"{key}=[{len(value)} item(s)]")
        elif isinstance(value, dict):
            parts.append(f"{key}={{…}}")
        else:
            text = str(value)
            if len(text) > 60:
                text = text[:57] + "…"
            parts.append(f"{key}={text}")
    summary = ", ".join(parts)
    return summary[:480] if summary else None

_VERBS = {"POST": "Created", "PATCH": "Updated", "PUT": "Updated", "DELETE": "Deleted"}
_RESOURCES = {
    "sales-orders": "order",
    "products": "product",
    "customers": "shop",
    "categories": "category",
    "photo-reports": "photo report",
    "telegram-topics": "topic",
    "users": "account",
    "purchase-orders": "purchase order",
    "agent-targets": "agent target",
    "payments": "payment",
}
_SUFFIXES = {
    "approve": "Approved order",
    "reject": "Rejected order",
    "pick": "Started picking",
    "deliver": "Delivered order",
    "cancel": "Cancelled order",
    "refund": "Refunded order",
    "receive": "Received goods",
    "resend": "Resent photo report",
    "image": "Updated product photo",
}


def action_label(method: str, path: str) -> str:
    seg = [s for s in path.split("/") if s]
    if seg[:2] == ["api", "v1"]:
        seg = seg[2:]
    if not seg:
        return method
    resource, last = seg[0], seg[-1]

    if resource == "cash":
        if last == "receive":
            return "Received cash from agent"
        if last == "submit":
            return "Submitted cash handover"
        if last == "confirm":
            return "Confirmed cash handover"
        if last == "reject":
            return "Rejected cash handover"
    if resource == "inventory" and last == "adjust":
        return "Added stock"
    if resource == "inventory" and last == "stock-import":
        return "Imported stock (Excel)"
    if resource == "auth" and last == "change-password":
        return "Changed password"
    if resource == "payments" and method == "POST":
        return "Recorded payment"
    if resource == "users" and last == "categories":
        return "Set agent categories"
    if last in _SUFFIXES:
        return _SUFFIXES[last]

    verb = _VERBS.get(method, method)
    name = _RESOURCES.get(resource, resource)
    return f"{verb} {name}".strip()


class AuditMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("method") not in _WRITE_METHODS:
            await self.app(scope, receive, send)
            return

        status = {"code": 0}
        body_chunks: list[bytes] = []

        async def receive_wrapper():
            message = await receive()
            if message.get("type") == "http.request":
                chunk = message.get("body", b"")
                if chunk and sum(len(c) for c in body_chunks) < 64_000:
                    body_chunks.append(chunk)
            return message

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        await self.app(scope, receive_wrapper, send_wrapper)

        # Response fully sent; the request's DB session is now released.
        try:
            if 200 <= status["code"] < 300:
                headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
                auth = headers.get("authorization", "")
                if auth.lower().startswith("bearer "):
                    payload = decode_access_token(auth[7:])
                    uid = int(payload.get("sub"))
                    path = scope.get("path", "")
                    method = scope["method"]
                    if path.startswith(settings.API_PREFIX) and "/activity" not in path:
                        detail = _summarize_body(b"".join(body_chunks))
                        async with AsyncSessionLocal() as session:
                            session.add(
                                ActivityLog(
                                    user_id=uid,
                                    method=method,
                                    path=path,
                                    action=action_label(method, path),
                                    detail=detail,
                                    status_code=status["code"],
                                )
                            )
                            await session.commit()
        except Exception as exc:  # auditing must never break the request
            _log.warning("audit write failed: %r", exc)
