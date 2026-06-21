from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.security import hash_password
from app.models.associations import agent_categories
from app.models.catalog import Category
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.catalog import CategoryOut
from app.schemas.user import AgentCategoriesUpdate, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    role: UserRole | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> list[User]:
    stmt = select(User).order_by(User.id)
    if role is not None:
        stmt = stmt.where(User.role == role)
    return list(await db.scalars(stmt))


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> User:
    exists = await db.scalar(select(User).where(User.email == data.email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        role=data.role,
        telegram_chat_id=data.telegram_chat_id,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.flush()
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    payload = data.model_dump(exclude_unset=True)

    # Never allow removing the last active admin (by demotion or deactivation).
    demoting = "role" in payload and payload["role"] != UserRole.ADMIN
    deactivating = payload.get("is_active") is False
    if user.role == UserRole.ADMIN and user.is_active and (demoting or deactivating):
        other_admins = await db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                User.role == UserRole.ADMIN,
                User.is_active.is_(True),
                User.id != user_id,
            )
        )
        if not other_admins:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "At least one active admin is required",
            )

    if "password" in payload:
        user.hashed_password = hash_password(payload.pop("password"))
        user.reset_requested = False  # request fulfilled
    for field, value in payload.items():
        setattr(user, field, value)
    await db.flush()
    return user


async def _agent_categories(db: AsyncSession, agent_id: int) -> list[Category]:
    rows = await db.scalars(
        select(Category)
        .join(agent_categories, agent_categories.c.category_id == Category.id)
        .where(agent_categories.c.agent_id == agent_id)
        .order_by(Category.name)
    )
    return list(rows)


@router.get("/{user_id}/categories", response_model=list[CategoryOut])
async def get_agent_categories(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> list[Category]:
    """Categories an agent is allowed to see (empty list = unrestricted)."""
    return await _agent_categories(db, user_id)


@router.put("/{user_id}/categories", response_model=list[CategoryOut])
async def set_agent_categories(
    user_id: int,
    data: AgentCategoriesUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER)),
) -> list[Category]:
    """Replace the set of categories visible to an agent."""
    agent = await db.get(User, user_id)
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if agent.role != UserRole.AGENT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User is not an agent")

    await db.execute(delete(agent_categories).where(agent_categories.c.agent_id == user_id))
    if data.category_ids:
        valid_ids = list(
            await db.scalars(select(Category.id).where(Category.id.in_(data.category_ids)))
        )
        if valid_ids:
            await db.execute(
                insert(agent_categories),
                [{"agent_id": user_id, "category_id": cid} for cid in valid_ids],
            )
    await db.flush()
    return await _agent_categories(db, user_id)
