"""Background scheduler: archive finished orders nightly at 00:00 Asia/Tashkent.

Finished orders (delivered / cancelled / refund) move to the archive; new & shipped
stay active. Changing an archived order's status un-archives it (handled in the
service). The loop also runs once on startup to catch up if the server was down at
midnight.
"""

import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.database import AsyncSessionLocal
from app.services import sales_service

TZ = ZoneInfo("Asia/Tashkent")


async def _run_archive() -> None:
    async with AsyncSessionLocal() as db:
        archived = await sales_service.archive_finished_orders(db)
        await db.commit()
        if archived:
            print(f"[archive] archived {archived} finished order(s)")


def _seconds_until_midnight() -> float:
    now = datetime.now(TZ)
    nxt = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max((nxt - now).total_seconds(), 1.0)


async def archive_loop() -> None:
    try:
        await _run_archive()  # startup catch-up
    except Exception as exc:  # noqa: BLE001
        print(f"[archive] startup pass failed: {exc}")
    while True:
        await asyncio.sleep(_seconds_until_midnight())
        try:
            await _run_archive()
        except Exception as exc:  # noqa: BLE001
            print(f"[archive] nightly pass failed: {exc}")
