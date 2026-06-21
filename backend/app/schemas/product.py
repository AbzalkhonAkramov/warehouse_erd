from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ProductBase(BaseModel):
    sku: str
    name: str
    barcode: str | None = None
    description: str | None = None
    unit: str = "pcs"
    category_id: int | None = None
    cost_price: Decimal = Decimal("0")
    sale_price: Decimal = Decimal("0")
    min_stock: Decimal = Decimal("0")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    sku: str | None = None
    name: str | None = None
    barcode: str | None = None
    description: str | None = None
    unit: str | None = None
    category_id: int | None = None
    cost_price: Decimal | None = None
    sale_price: Decimal | None = None
    min_stock: Decimal | None = None
    is_active: bool | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    image_path: str | None = None
    image_back_path: str | None = None
    on_hand: Decimal | None = None  # filled by the endpoint when stock is joined
    # Purchase price — hidden (None) for agents, who only see the retail price.
    cost_price: Decimal | None = None


class ProductHistoryEntry(BaseModel):
    kind: str  # "added" (stock-in by an account) | "sale" (sold by an agent)
    date: datetime
    quantity: Decimal
    user_name: str | None = None  # account that added stock, or agent that sold
    detail: str | None = None  # movement type, or "#<order> · <status>"
