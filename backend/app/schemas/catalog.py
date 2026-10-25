from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class SupplierBase(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None


class SupplierCreate(SupplierBase):
    # Individual code: digits only, at least 5 of them.
    code: str = Field(pattern=r"^\d{5,}$")


class SupplierUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None


class SupplierOut(SupplierBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str | None = None
