from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ReturnRequestStatus


class ReturnLineIn(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0)


class ReturnRequestCreate(BaseModel):
    sales_order_id: int
    lines: list[ReturnLineIn] = Field(min_length=1)
    note: str | None = None


class ReturnApprove(BaseModel):
    # True -> goods back to sellable stock; False -> hold as refunded goods.
    restock: bool = False


class ReturnLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    product_name: str | None = None
    quantity: Decimal


class ReturnRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    customer_name: str | None = None
    sales_order_id: int
    order_no: str | None = None
    agent_id: int | None
    agent_name: str | None = None
    status: ReturnRequestStatus
    note: str | None
    created_at: datetime
    lines: list[ReturnLineOut] = []
