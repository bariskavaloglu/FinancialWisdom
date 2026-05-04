"""
AdminOverride modeli — Admin müdahale katmanı

Admin, belirli kullanıcıların portföy üretim sürecine guardrail koyabilir.
Bu override'lar, Algorithm D'nin ürettiği ağırlıklara ek kısıt uygular.
Portföy algoritması hiç değişmez; sadece guardrail kaynağı genişler.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AdminOverride(Base):
    """
    Admin tarafından belirli bir kullanıcıya uygulanan portföy kısıtı.
    Her kayıt: bir kullanıcı + bir varlık sınıfı için min/max band.

    Aynı kullanıcı + asset_class çifti için en son aktif override geçerlidir.
    """
    __tablename__ = "admin_overrides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Kısıt uygulanan kullanıcı
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # Varlık sınıfı: BIST_EQUITY, SP500_EQUITY, COMMODITY, CRYPTOCURRENCY, CASH_EQUIVALENT
    asset_class: Mapped[str] = mapped_column(String(50), nullable=False)

    # Min/max yüzde kısıtları (None = kısıt yok)
    min_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_weight: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Admin notu (zorunlu — audit için)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    # Override yapan admin
    created_by_admin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_by_admin_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Durum
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # İlişkiler
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[user_id], back_populates="admin_overrides"
    )

    def __repr__(self) -> str:
        return (
            f"<AdminOverride user={self.user_id} "
            f"{self.asset_class} min={self.min_weight} max={self.max_weight}>"
        )
