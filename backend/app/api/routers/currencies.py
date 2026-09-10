from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.catalog import Currency, Product
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.currency import CurrencyCreate, CurrencyOut, CurrencyUpdate

router = APIRouter(prefix="/currencies", tags=["currencies"])


@router.get("", response_model=list[CurrencyOut])
async def list_currencies(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Currency]:
    stmt = select(Currency).order_by(Currency.code)
    if active_only:
        stmt = stmt.where(Currency.is_active.is_(True))
    return list(await db.scalars(stmt))


@router.post("", response_model=CurrencyOut, status_code=status.HTTP_201_CREATED)
async def create_currency(
    data: CurrencyCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> Currency:
    code = data.code.strip().upper()
    exists = await db.scalar(select(Currency).where(func.upper(Currency.code) == code))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Currency code already exists")
    currency = Currency(
        code=code, name=data.name, symbol=data.symbol, is_active=data.is_active
    )
    db.add(currency)
    await db.flush()
    return currency


@router.patch("/{currency_id}", response_model=CurrencyOut)
async def update_currency(
    currency_id: int,
    data: CurrencyUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> Currency:
    currency = await db.get(Currency, currency_id)
    if currency is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Currency not found")
    payload = data.model_dump(exclude_unset=True)
    if "code" in payload and payload["code"]:
        payload["code"] = payload["code"].strip().upper()
        clash = await db.scalar(
            select(Currency).where(
                func.upper(Currency.code) == payload["code"], Currency.id != currency_id
            )
        )
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "Currency code already exists")
    for field, value in payload.items():
        setattr(currency, field, value)
    await db.flush()
    return currency


@router.delete("/{currency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_currency(
    currency_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> None:
    currency = await db.get(Currency, currency_id)
    if currency is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Currency not found")
    in_use = await db.scalar(
        select(func.count()).select_from(Product).where(Product.currency_id == currency_id)
    )
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Currency is used by products; deactivate it instead",
        )
    await db.delete(currency)
    await db.flush()
