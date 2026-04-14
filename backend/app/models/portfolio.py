import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Portfolio(Base):
    """
    Generated portfolio recommendation for a user.
    RAD UC-04, UC-05, UC-06.
    Only one portfolio per user has is_current=True at a time.
    """
    __tablename__ = "portfolios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("risk_assessments.id", ondelete="CASCADE"),
        nullable=False,
    )

    profile_type: Mapped[str] = mapped_column(
        Enum("conservative", "balanced", "aggressive", name="profile_type"),
        nullable=False,
    )
    horizon_type: Mapped[str] = mapped_column(
        Enum("short", "medium", "long", name="horizon_type"), nullable=False
    )

    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    portfolio_score: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_volatility: Mapped[float] = mapped_column(Float, nullable=False)

    explanation: Mapped[str | None] = mapped_column(Text)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="portfolios")  # noqa: F821
    assessment: Mapped["RiskAssessment"] = relationship(  # noqa: F821
        "RiskAssessment", back_populates="portfolio"
    )
    allocations: Mapped[list["AssetAllocation"]] = relationship(
        "AssetAllocation", back_populates="portfolio", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Portfolio {self.id} [{self.profile_type}/{self.horizon_type} current={self.is_current}]>"


class AssetAllocation(Base):
    """
    Layer 1 output: percentage weight per asset class in a portfolio.
    Also stores the Layer 2 selected instruments as JSON.
    RAD UC-04 Layer 1 + Layer 2.
    """
    __tablename__ = "asset_allocations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    asset_class: Mapped[str] = mapped_column(
        Enum(
            "BIST_EQUITY", "SP500_EQUITY", "COMMODITY", "CRYPTOCURRENCY", "CASH_EQUIVALENT",
            name="asset_class",
        ),
        nullable=False,
    )

    # Layer 1: percentage weight (0-100)
    target_weight: Mapped[float] = mapped_column(Float, nullable=False)

    # Layer 2: selected instruments with factor scores, stored as JSON array
    # Structure: [{"ticker": "THYAO.IS", "name": "...", "factorScore": {...}, ...}]
    instruments: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Relationships
    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="allocations")

    def __repr__(self) -> str:
        return f"<AssetAllocation {self.asset_class} {self.target_weight}%>"
