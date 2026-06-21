from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.sales import Region
from app.models.user import User
from app.schemas.customer import RegionCreate, RegionOut

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("", response_model=list[RegionOut])
async def list_regions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Region]:
    return list(await db.scalars(select(Region).order_by(Region.name)))


@router.post("", response_model=RegionOut, status_code=status.HTTP_201_CREATED)
async def create_region(
    data: RegionCreate,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_roles(UserRole.MANAGER)),
) -> Region:
    name = data.name.strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Region name required")
    if await db.scalar(select(Region).where(Region.name == name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Region already exists")
    region = Region(name=name, created_by_id=manager.id)
    db.add(region)
    await db.flush()
    return region
