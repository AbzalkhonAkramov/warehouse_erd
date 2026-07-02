import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.config import settings
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.setting import CompanySettings
from app.models.user import User

router = APIRouter(prefix="/meta", tags=["meta"])

_LOGO_SUBDIR = "branding"
_MODES = {"text", "logo", "both"}
_CASH_MODES = {"manager_records", "agent_submits"}


class CompanyOut(BaseModel):
    name: str
    logo_url: str | None = None
    display_mode: str
    cash_handover_mode: str = "manager_records"


class CompanyUpdate(BaseModel):
    name: str | None = None
    display_mode: str | None = None
    cash_handover_mode: str | None = None


async def _get_settings(db: AsyncSession) -> CompanySettings:
    obj = await db.scalar(select(CompanySettings).limit(1))
    if obj is None:
        obj = CompanySettings(company_name=settings.COMPANY_NAME, display_mode="both")
        db.add(obj)
        await db.flush()
    return obj


def _to_out(s: CompanySettings) -> CompanyOut:
    return CompanyOut(
        name=s.company_name,
        logo_url=f"/uploads/{s.logo_path}" if s.logo_path else None,
        display_mode=s.display_mode,
        cash_handover_mode=s.cash_handover_mode,
    )


@router.get("/company", response_model=CompanyOut)
async def get_company(db: AsyncSession = Depends(get_db)) -> CompanyOut:
    """Branding for receipts/headers (public). Singleton, auto-created with defaults."""
    return _to_out(await _get_settings(db))


@router.patch("/company", response_model=CompanyOut)
async def update_company(
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> CompanyOut:
    s = await _get_settings(db)
    if data.name is not None:
        s.company_name = data.name.strip() or s.company_name
    if data.display_mode is not None:
        if data.display_mode not in _MODES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid display mode")
        s.display_mode = data.display_mode
    if data.cash_handover_mode is not None:
        if data.cash_handover_mode not in _CASH_MODES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid cash handover mode")
        s.cash_handover_mode = data.cash_handover_mode
    await db.flush()
    return _to_out(s)


@router.post("/company/logo", response_model=CompanyOut)
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> CompanyOut:
    s = await _get_settings(db)
    root = Path(settings.UPLOAD_DIR) / _LOGO_SUBDIR
    root.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower() or ".png"
    name = f"{uuid.uuid4().hex}{suffix}"
    (root / name).write_bytes(await file.read())
    s.logo_path = f"{_LOGO_SUBDIR}/{name}"
    await db.flush()
    return _to_out(s)


@router.delete("/company/logo", response_model=CompanyOut)
async def delete_logo(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> CompanyOut:
    s = await _get_settings(db)
    s.logo_path = None
    await db.flush()
    return _to_out(s)
