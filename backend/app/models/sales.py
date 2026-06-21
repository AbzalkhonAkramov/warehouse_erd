from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.associations import customer_agents
from app.models.base import Base, TimestampMixin
from app.models.enums import SalesOrderStatus


class Region(Base, TimestampMixin):
    """A sales region/territory that groups markets. Created by a manager."""

    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    customers: Mapped[list["Customer"]] = relationship(back_populates="region")


class Customer(Base, TimestampMixin):
    """A shop/market that agents sell to. Can be pinned to several agents (M2M)."""

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(120))
    # Geolocation of the shop (for the agent's route map).
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))

    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"))
    region: Mapped["Region | None"] = relationship(back_populates="customers")

    # Credit control.
    credit_limit: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    debt: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    # Agents pinned to this market (a market may have more than one agent).
    agents: Mapped[list["User"]] = relationship(  # noqa: F821
        secondary=customer_agents, back_populates="customers"
    )

    orders: Mapped[list["SalesOrder"]] = relationship(back_populates="customer")


class SalesOrder(Base, TimestampMixin):
    __tablename__ = "sales_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    agent_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)

    status: Mapped[SalesOrderStatus] = mapped_column(
        Enum(SalesOrderStatus), default=SalesOrderStatus.NEW, nullable=False
    )
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    # Free-text name of the person who delivers the order (set by a manager).
    deliverer: Mapped[str | None] = mapped_column(String(200))
    # Finished orders (delivered/cancelled/refund) are archived nightly. Archived
    # orders drop out of the active list; changing their status un-archives them.
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Who actually created the order (the order owner is agent_id; for a manager
    # placing an order on behalf of an agent these differ).
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    # A partial refund forks a new REFUND order off the original; this points back
    # to that original order.
    parent_order_id: Mapped[int | None] = mapped_column(ForeignKey("sales_orders.id"))

    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    customer: Mapped["Customer"] = relationship(back_populates="orders")
    lines: Mapped[list["SalesOrderLine"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    invoice: Mapped["Invoice | None"] = relationship(  # noqa: F821
        back_populates="order", uselist=False
    )


class SalesOrderLine(Base):
    __tablename__ = "sales_order_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    # How much of this line has been refunded (supports partial refunds).
    refunded_quantity: Mapped[float] = mapped_column(Numeric(14, 3), default=0, nullable=False)

    order: Mapped["SalesOrder"] = relationship(back_populates="lines")


class RefundEntry(Base, TimestampMixin):
    """One returned product (a partial refund line). Feeds the 'Refunded goods' page.

    Carries denormalised customer/agent/deliverer so the page can filter/show full
    context without extra joins back through the order.
    """

    __tablename__ = "refund_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    deliverer: Mapped[str | None] = mapped_column(String(200))

    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    # True -> goods went back into sellable stock; False -> held as refunded goods only.
    restocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class OrderStatusHistory(Base, TimestampMixin):
    """Audit trail of every order status transition (for the status-history page)."""

    __tablename__ = "order_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    # "create" | "move" | "fork_out" | "fork_in" — what kind of event this was.
    kind: Mapped[str] = mapped_column(String(16), default="move", nullable=False)
    # Items involved (e.g. "4×Cola, 2×Water"); language-neutral product/qty summary.
    detail: Mapped[str | None] = mapped_column(Text)
    # The other order in a fork event (the fork, or the parent).
    related_order_id: Mapped[int | None] = mapped_column(ForeignKey("sales_orders.id"))


class Visit(Base, TimestampMixin):
    """A record that an agent visited a shop (check-in), even if no order resulted."""

    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    agent_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    note: Mapped[str | None] = mapped_column(Text)
    sales_order_id: Mapped[int | None] = mapped_column(ForeignKey("sales_orders.id"))
