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
    # Managers/admins may create an order on behalf of an agent; agents leave this
    # blank and the order is filed under their own account.
    agent_id: int | None = None
    warehouse_id: int | None = None  # defaults to the default warehouse
    discount: Decimal = Decimal("0")
    note: str | None = None
    lines: list[SalesOrderLineCreate] = Field(min_length=1)


class SalesOrderUpdate(BaseModel):
    """Manager-only edit of an order's deliverer / note (not the status)."""

    deliverer: str | None = None
    # Assign a deliverer account (its name is copied into `deliverer`).
    deliverer_id: int | None = None
    note: str | None = None
    # Manager waive/require before-after photos for this single order.
    photo_required: bool | None = None


class OrderPhotoOut(BaseModel):
    """A before/after image pinned to an order (for the order-detail view).

    Images live in Telegram only; ``link`` is the deep link managers click."""

    model_config = ConfigDict(from_attributes=True)

    stage: str
    link: str | None


class SalesOrderLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str | None = None
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal
    refunded_quantity: Decimal


class SalesOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Display number: plain id for normal orders, "<parent>.<n>" for forked orders.
    order_no: str | None = None
    invoice_number: str | None = None
    customer_id: int
    # Market (shop) the goods go to — so a deliverer sees where to deliver.
    customer_name: str | None = None
    customer_address: str | None = None
    agent_id: int
    agent_name: str | None = None
    created_by_id: int | None
    created_by_name: str | None = None
    parent_order_id: int | None = None
    warehouse_id: int
    status: SalesOrderStatus
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    note: str | None
    deliverer: str | None
    deliverer_id: int | None = None
    archived: bool
    photo_required: bool = True
    # Whether the agent is flagged "important" (photos matter for their orders).
    agent_photo_required: bool = True
    # Before/after photos pinned to this order (populated on the detail endpoint).
    photos: list[OrderPhotoOut] = []
    # True once both a before AND an after photo are pinned to this order.
    photo_complete: bool = False
    approved_by_id: int | None
    approved_at: datetime | None
    rejection_reason: str | None
    created_at: datetime
    lines: list[SalesOrderLineOut]


class RefundLineIn(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0)


class RefundRequest(BaseModel):
    """Partial refund: which goods came back, and where they go."""

    lines: list[RefundLineIn] = Field(min_length=1)
    # True -> return goods to sellable stock; False -> hold as refunded goods only.
    restock: bool = False
    note: str | None = None


class StatusMoveRequest(BaseModel):
    """Move an order to a status. With no lines the whole order moves; with lines a
    partial amount is moved and the order forks (the rest stays in its old status)."""

    status: SalesOrderStatus
    lines: list[RefundLineIn] | None = None
    restock: bool = False  # only relevant when status == refund
    note: str | None = None


class RefundEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    product_id: int
    product_name: str | None = None
    customer_id: int
    customer_name: str | None = None
    agent_id: int | None
    agent_name: str | None = None
    deliverer: str | None
    quantity: Decimal
    unit_price: Decimal
    value: Decimal
    restocked: bool
    created_at: datetime


class OrderStatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    order_no: str | None = None
    from_status: str | None
    to_status: str
    kind: str = "move"
    detail: str | None = None
    related_order_id: int | None = None
    related_order_no: str | None = None
    changed_by_id: int | None
    changed_by_name: str | None = None
    created_at: datetime
