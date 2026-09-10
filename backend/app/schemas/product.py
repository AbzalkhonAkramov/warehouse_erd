from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import SaleMode


class ProductBase(BaseModel):
    # use_enum_values so sale_mode round-trips as its string value ("piece"),
    # matching the plain-text column, both when dumping to the model and to JSON.
    model_config = ConfigDict(use_enum_values=True)

    sku: str
    name: str
    barcode: str | None = None
    description: str | None = None
    unit: str = "шт"
    category_id: int | None = None
    cost_price: Decimal = Decimal("0")
    sale_price: Decimal = Decimal("0")
    min_stock: Decimal = Decimal("0")

    # Money type + packaging + sale mode. Manager-editable; agents read-only.
    currency_id: int | None = None
    box_qty: int | None = None
    box_weight: Decimal | None = None
    box_dimensions: str | None = None
    sale_mode: SaleMode = SaleMode.PIECE
    integer_qty: bool = True  # whole units only vs fractional (kg/litres)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

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
    currency_id: int | None = None
    box_qty: int | None = None
    box_weight: Decimal | None = None
    box_dimensions: str | None = None
    sale_mode: SaleMode | None = None
    integer_qty: bool | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: int
    is_active: bool
    image_path: str | None = None
    image_back_path: str | None = None
    on_hand: Decimal | None = None  # filled by the endpoint when stock is joined
    # Purchase price — hidden (None) for agents, who only see the retail price.
    cost_price: Decimal | None = None
    # Convenience currency fields, filled by the endpoint from the relationship.
    currency_code: str | None = None
    currency_symbol: str | None = None


class ProductHistoryEntry(BaseModel):
    kind: str  # "added" (stock-in by an account) | "sale" (sold by an agent)
    date: datetime
    quantity: Decimal
    user_name: str | None = None  # account that added stock, or agent that sold
    detail: str | None = None  # movement type, or "#<order> · <status>"
