from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    RegisterRequest,
    Token,
)
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Public sign-up. Creates an INACTIVE agent account that a super-admin must
    approve (activate) before it can log in."""
    exists = await db.scalar(select(User).where(User.email == data.email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        role=UserRole.AGENT,
        is_active=False,  # awaiting super-admin approval
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.flush()
    return user


@router.post("/login", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    """OAuth2 password flow. `username` field carries the email."""
    user = await db.scalar(select(User).where(User.email == form.username))
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Account is disabled or awaiting approval"
        )
    return Token(access_token=create_access_token(user.id, user.role.value))


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Any signed-in user can change their own password."""
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if len(data.new_password) < 4:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password is too short")
    user.hashed_password = hash_password(data.new_password)
    user.reset_requested = False
    await db.flush()
    return {"status": "ok"}


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Flag the account so a super-admin sees the request and resets the password.

    Always returns ok (does not reveal whether the email exists)."""
    user = await db.scalar(select(User).where(User.email == data.email))
    if user is not None:
        user.reset_requested = True
        await db.flush()
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
