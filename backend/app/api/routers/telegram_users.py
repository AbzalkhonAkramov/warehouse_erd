"""Admin Telegram panel: let staff link their personal Telegram chat so ERP
notifications reach them.

Linking is self-serve: the admin generates a one-time code for a user, the user
opens the bot via ``t.me/<bot>?start=<code>`` and taps Start, then the admin hits
"Sync" — which reads the bot's recent updates (getUpdates), matches each
``/start <code>`` to its user and stores that chat id.
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.services import telegram

router = APIRouter(prefix="/telegram/users", tags=["telegram"])

_ADMIN = require_roles(UserRole.ADMIN)


# --- Schemas ---------------------------------------------------------------

class BotInfoOut(BaseModel):
    configured: bool
    username: str | None = None
    error: str | None = None


class TgUserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    linked: bool
    telegram_username: str | None = None
    has_code: bool


class LinkCodeOut(BaseModel):
    code: str
    link: str | None = None


class SyncResultOut(BaseModel):
    checked: int
    linked: list[str]


# --- Helpers ---------------------------------------------------------------

async def _unique_code(db: AsyncSession) -> str:
    for _ in range(10):
        code = secrets.token_hex(3).upper()  # e.g. "A1B2C3"
        exists = await db.scalar(
            select(User.id).where(User.telegram_link_code == code)
        )
        if not exists:
            return code
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not allocate code")


# --- Endpoints -------------------------------------------------------------

@router.get("/bot", response_model=BotInfoOut)
async def bot_info(_: User = Depends(_ADMIN)) -> BotInfoOut:
    """Report whether the bot token is set and the bot's @username (for links)."""
    from app.core.config import settings

    if not settings.TELEGRAM_BOT_TOKEN:
        return BotInfoOut(configured=False)
    try:
        me = await telegram.get_me()
    except telegram.TelegramError as exc:
        return BotInfoOut(configured=True, error=str(exc))
    return BotInfoOut(configured=True, username=me.get("username"))


@router.get("", response_model=list[TgUserOut])
async def list_link_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_ADMIN),
) -> list[TgUserOut]:
    """Every staff user (admins aside) with their Telegram link status."""
    users = list(
        await db.scalars(
            select(User)
            .where(User.role != UserRole.ADMIN)
            .order_by(User.role, User.full_name)
        )
    )
    return [
        TgUserOut(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            linked=bool(u.telegram_chat_id),
            telegram_username=u.telegram_username,
            has_code=bool(u.telegram_link_code),
        )
        for u in users
    ]


@router.post("/{user_id}/code", response_model=LinkCodeOut)
async def generate_code(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_ADMIN),
) -> LinkCodeOut:
    """Issue a fresh start code for the user and return its deep link."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.telegram_link_code = await _unique_code(db)
    await db.flush()

    link: str | None = None
    from app.core.config import settings

    if settings.TELEGRAM_BOT_TOKEN:
        try:
            me = await telegram.get_me()
            username = me.get("username")
            if username:
                link = f"https://t.me/{username}?start={user.telegram_link_code}"
        except telegram.TelegramError:
            link = None
    return LinkCodeOut(code=user.telegram_link_code, link=link)


@router.post("/{user_id}/unlink", response_model=TgUserOut)
async def unlink(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_ADMIN),
) -> TgUserOut:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.telegram_chat_id = None
    user.telegram_link_code = None
    user.telegram_username = None
    await db.flush()
    return TgUserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        linked=False,
        telegram_username=None,
        has_code=False,
    )


@router.post("/sync", response_model=SyncResultOut)
async def sync_links(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_ADMIN),
) -> SyncResultOut:
    """Read recent bot updates and link any user whose code was sent to the bot."""
    try:
        updates = await telegram.get_updates()
    except telegram.TelegramError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    # Map each start code seen in the updates to the chat it came from.
    seen: dict[str, dict] = {}
    for upd in updates:
        msg = upd.get("message") or {}
        text = (msg.get("text") or "").strip()
        if not text.startswith("/start"):
            continue
        parts = text.split(maxsplit=1)
        if len(parts) < 2:
            continue
        code = parts[1].strip().upper()
        chat = msg.get("chat") or {}
        if chat.get("id") is not None:
            seen[code] = chat  # last one wins

    linked: list[str] = []
    for code, chat in seen.items():
        user = await db.scalar(
            select(User).where(User.telegram_link_code == code)
        )
        if user is None:
            continue
        user.telegram_chat_id = str(chat["id"])
        user.telegram_username = (
            chat.get("username")
            or " ".join(
                p for p in (chat.get("first_name"), chat.get("last_name")) if p
            )
            or None
        )
        user.telegram_link_code = None  # consume the code
        linked.append(user.full_name)
    await db.flush()
    return SyncResultOut(checked=len(seen), linked=linked)
