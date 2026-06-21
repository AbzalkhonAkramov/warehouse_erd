from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import InvoiceStatus, PaymentMethod


class PaymentCreate(BaseModel):
    invoice_id: int
    amount: Decimal = Field(gt=0)
    method: PaymentMethod = PaymentMethod.CASH
    note: str | None = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    amount: Decimal
    method: PaymentMethod
    collected_by_id: int | None
    collected_by_name: str | None = None
    collected_at: datetime
    note: str | None = None
    image_path: str | None = None


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    sales_order_id: int
    customer_id: int
    total: Decimal
    paid_amount: Decimal
    status: InvoiceStatus
    created_at: datetime


class InvoiceDetailOut(InvoiceOut):
    payments: list[PaymentOut] = []
