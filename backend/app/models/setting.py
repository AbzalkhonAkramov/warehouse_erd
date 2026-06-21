from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CompanySettings(Base, TimestampMixin):
    """Singleton (id=1) branding configuration, edited from the super-admin panel."""

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(120), nullable=False, default="Warehouse ERP")
    logo_path: Mapped[str | None] = mapped_column(String(255))
    # How branding is shown: "text" (name only), "logo" (logo only), "both".
    display_mode: Mapped[str] = mapped_column(String(8), nullable=False, default="both")
