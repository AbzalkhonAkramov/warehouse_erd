"""Route ERP notifications to the Telegram chats users have linked.

Users link their personal chat from the admin Telegram panel (they send the bot
a one-time ``/start <code>``). Here we fan a message out to every linked user of
the given role(s). Sending is best-effort — a Telegram failure never breaks the
request that triggered it (see ``telegram.send_message``).
"""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserRole
from app.models.user import User
from app.services import telegram


async def notify_roles(
    db: AsyncSession, roles: Iterable[UserRole], text: str
) -> None:
    """Send ``text`` to every active, linked user holding one of ``roles``."""
    role_list = list(roles)
    if not role_list:
        return
    users = await db.scalars(
        select(User).where(
            User.role.in_(role_list),
            User.is_active.is_(True),
            User.telegram_chat_id.is_not(None),
        )
    )
    for user in users:
        await telegram.send_message(user.telegram_chat_id, text)
