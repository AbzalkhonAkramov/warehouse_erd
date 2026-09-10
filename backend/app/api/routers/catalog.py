from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from openpyxl import Workbook, load_workbook
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
from app.schemas.imports import BulkImportResult

router = APIRouter(tags=["catalog"])

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(wb: Workbook, filename: str) -> Response:
    buf = BytesIO()
    wb.save(buf)
    return Response(
        content=buf.getvalue(),
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.get("/categories/template")
async def categories_template(
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> Response:
    """Blank .xlsx to bulk-create categories: one 'Name' column."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Categories"
    ws.append(["Name"])
    ws.append(["Drinks"])  # example row — replace with your categories
    return _xlsx_response(wb, "categories-template.xlsx")


@router.post("/categories/import", response_model=BulkImportResult)
async def categories_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.WAREHOUSE)),
) -> BulkImportResult:
    """Create a category per row (column A = Name). Blank or existing names skip."""
    try:
        wb = load_workbook(BytesIO(await file.read()), data_only=True)
    except Exception:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Could not read the Excel file (.xlsx expected)"
        ) from None
    ws = wb.worksheets[0]
    existing = {
        (n or "").strip().lower() for n in await db.scalars(select(Category.name))
    }

    created = skipped = 0
    errors: list[str] = []
    seen: set[str] = set()
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        name = (str(row[0]).strip() if row and row[0] not in (None, "") else "")
        if not name:
            continue
        key = name.lower()
        if key in existing or key in seen:
            skipped += 1
            continue
        db.add(Category(name=name))
        seen.add(key)
        created += 1

    await db.flush()
    return BulkImportResult(created=created, skipped=skipped, errors=errors[:50])


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
