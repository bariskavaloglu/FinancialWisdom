# Import all models here so Alembic autogenerate picks them up
from app.models.user import User
from app.models.assessment import RiskAssessment
from app.models.portfolio import Portfolio, AssetAllocation
from app.models.admin_override import AdminOverride

__all__ = ["User", "RiskAssessment", "Portfolio", "AssetAllocation", "AdminOverride"]
