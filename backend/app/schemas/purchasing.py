from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PurchaseOrderStatus


class PurchaseOrderLineCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0)
    unit_cost: Decimal = Field(ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    warehouse_id: int | None = None
    expected_date: date | None = None
    note: str | None = None
    lines: list[PurchaseOrderLineCreate] = Field(min_length=1)


class ReceiveLine(BaseModel):
    line_id: int
    quantity: Decimal = Field(gt=0)


class GoodsReceipt(BaseModel):
    """Receive some/all lines of a PO into stock. Empty list = receive everything."""

    lines: list[ReceiveLine] = []


class PurchaseOrderLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: Decimal
    unit_cost: Decimal
    received_quantity: Decimal


class PurchaseOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supplier_id: int
    warehouse_id: int
    status: PurchaseOrderStatus
    expected_date: date | None
    total: Decimal
    note: str | None
    created_at: datetime
    lines: list[PurchaseOrderLineOut]
