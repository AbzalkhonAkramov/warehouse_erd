from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.catalog import Category, Supplier
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.catalog import (
    CategoryCreate,
    CategoryOut,
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
)

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Category]:
    return list(await db.scalars(select(Category).order_by(Category.name)))


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> Category:
    exists = await db.scalar(select(Category).where(Category.name == data.name))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Category already exists")
    cat = Category(name=data.name)
    db.add(cat)
    await db.flush()
    return cat


@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE, UserRole.ACCOUNTANT)),
) -> list[Supplier]:
    return list(await db.scalars(select(Supplier).order_by(Supplier.name)))


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> Supplier:
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    await db.flush()
    return supplier


@router.patch("/suppliers/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> Supplier:
    supplier = await db.get(Supplier, supplier_id)
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    await db.flush()
    return supplier
