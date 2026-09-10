from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import SaleMode


class Currency(Base, TimestampMixin):
    """A money type (e.g. UZS, USD). Managed by an admin on a dedicated page;
    each product references one. Agents only ever read it."""

    __tablename__ = "currencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)  # UZS, USD
    name: Mapped[str] = mapped_column(String(64), nullable=False)  # Uzbek som
    symbol: Mapped[str] = mapped_column(String(8), nullable=False)  # so'm, $
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(16), default="pcs", nullable=False)  # pcs/box/kg

    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    category: Mapped["Category | None"] = relationship(back_populates="products")

    # Default cost (purchase) and sale price; per-line price can still override.
    cost_price: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    sale_price: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    # Money type for this product's prices. Manager-editable, agent read-only.
    currency_id: Mapped[int | None] = mapped_column(ForeignKey("currencies.id"))
    currency: Mapped["Currency | None"] = relationship(lazy="selectin")

    # Box (packaging) info — optional; a product may have no box at all.
    box_qty: Mapped[int | None] = mapped_column(Integer)  # units per box; None = no box
    box_weight: Mapped[float | None] = mapped_column(Numeric(10, 3))  # kg per box
    box_dimensions: Mapped[str | None] = mapped_column(String(64))  # e.g. "40x30x25 cm"

    # Whether the good is sold as a box, one-by-one, or both. Manager-editable.
    # Stored as text (not a native enum) so it can be added to existing DBs with a
    # plain ALTER; validated against SaleMode at the schema layer.
    sale_mode: Mapped[str] = mapped_column(
        String(8), default=SaleMode.PIECE.value, nullable=False
    )

    # Reorder threshold for low-stock alerts.
    min_stock: Mapped[float] = mapped_column(Numeric(14, 3), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relative paths under the upload dir, served at /uploads/<path>.
    image_path: Mapped[str | None] = mapped_column(String(255))  # front (main)
    image_back_path: Mapped[str | None] = mapped_column(String(255))  # back (optional)

    stock: Mapped[list["Stock"]] = relationship(back_populates="product")  # noqa: F821


class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)


class Warehouse(Base, TimestampMixin):
    """Single warehouse for the MVP, but modelled so multi-warehouse is a later add."""

    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
