from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import SalesOrderStatus


class Customer(Base, TimestampMixin):
    """A shop/retailer that an agent sells to."""

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    address: Mapped[str | None] = mapped_column(Text)
    # Geolocation of the shop (for the agent's route map).
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))

    # Credit control.
    credit_limit: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    debt: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    agent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    agent: Mapped["User | None"] = relationship(  # noqa: F821
        back_populates="customers", foreign_keys=[agent_id]
    )

    orders: Mapped[list["SalesOrder"]] = relationship(back_populates="customer")


class SalesOrder(Base, TimestampMixin):
    __tablename__ = "sales_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    agent_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)

    status: Mapped[SalesOrderStatus] = mapped_column(
        Enum(SalesOrderStatus), default=SalesOrderStatus.PENDING, nullable=False
    )
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

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

    order: Mapped["SalesOrder"] = relationship(back_populates="lines")


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
