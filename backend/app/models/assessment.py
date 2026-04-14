import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RiskAssessment(Base):
    """
    Stores questionnaire answers and computed risk profile.
    RAD UC-03, UC-08 — classifies user as conservative / balanced / aggressive
    and independently records investment horizon (short / medium / long).
    """
    __tablename__ = "risk_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Raw answers: [{"questionId": 1, "selectedOption": 2}, ...]
    answers: Mapped[list] = mapped_column(JSON, nullable=False)

    # Computed score 0-100 from questionnaire (RAD: each of 15 questions scored 0-3)
    composite_score: Mapped[int] = mapped_column(Integer, nullable=False)

    # Profile classification
    profile_type: Mapped[str] = mapped_column(
        Enum("conservative", "balanced", "aggressive", name="profile_type"), nullable=False
    )

    # Investment horizon — treated independently from risk (RAD key differentiator)
    horizon_type: Mapped[str] = mapped_column(
        Enum("short", "medium", "long", name="horizon_type"), nullable=False
    )

    explanation: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="assessments")  # noqa: F821
    portfolio: Mapped["Portfolio | None"] = relationship(  # noqa: F821
        "Portfolio", back_populates="assessment", uselist=False
    )

    def __repr__(self) -> str:
        return f"<RiskAssessment {self.id} [{self.profile_type}/{self.horizon_type} score={self.composite_score}]>"
