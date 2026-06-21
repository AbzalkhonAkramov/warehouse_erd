from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SalesOrderStatus


class SalesOrderLineCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal | None = None  # falls back to product.sale_price


class SalesOrderCreate(BaseModel):
    customer_id: int
    warehouse_id: int | None = None  # defaults to the default warehouse
    discount: Decimal = Decimal("0")
    note: str | None = None
    lines: list[SalesOrderLineCreate] = Field(min_length=1)


class SalesOrderReject(BaseModel):
    reason: str


class SalesOrderLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal


class SalesOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    agent_id: int
    warehouse_id: int
    status: SalesOrderStatus
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    note: str | None
    approved_by_id: int | None
    approved_at: datetime | None
    rejection_reason: str | None
    created_at: datetime
    lines: list[SalesOrderLineOut]
