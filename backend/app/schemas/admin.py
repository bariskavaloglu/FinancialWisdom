"""
Admin şemaları — sistem config + override CRUD
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Sistem konfigürasyonu (mevcut) ────────────────────────────────────────────

class FactorWeights(BaseModel):
    momentum: float = Field(..., ge=0, le=1)
    value: float = Field(..., ge=0, le=1)
    quality: float = Field(..., ge=0, le=1)
    lowVolatility: float = Field(..., ge=0, le=1)


class AllocationRule(BaseModel):
    profile: str
    horizon: str
    equityPct: float
    cryptoPct: float
    commodityPct: float
    cashPct: float


class SystemConfig(BaseModel):
    factorWeights: FactorWeights
    allocationMatrix: list[AllocationRule]
    yfinanceCacheTtlMinutes: int = Field(..., ge=1, le=1440)
    minDataCompleteness: float = Field(..., ge=0, le=1)
    maxInstrumentsPerClass: int = Field(..., ge=1, le=10)
    enableRedisCache: bool
    useFallbackOnApiFailure: bool


# ── Admin Override şemaları ───────────────────────────────────────────────────

VALID_ASSET_CLASSES = {
    "BIST_EQUITY", "SP500_EQUITY", "COMMODITY", "CRYPTOCURRENCY", "CASH_EQUIVALENT"
}


class AdminOverrideCreate(BaseModel):
    """Admin'in yeni override oluşturması için."""
    user_id: uuid.UUID
    asset_class: str = Field(..., description="BIST_EQUITY | SP500_EQUITY | COMMODITY | CRYPTOCURRENCY | CASH_EQUIVALENT")
    min_weight: Optional[float] = Field(None, ge=0, le=100, description="Minimum % (0-100)")
    max_weight: Optional[float] = Field(None, ge=0, le=100, description="Maximum % (0-100)")
    reason: str = Field(..., min_length=5, max_length=500, description="Override sebebi (zorunlu)")

    model_config = {"json_schema_extra": {
        "example": {
            "user_id": "123e4567-e89b-12d3-a456-426614174000",
            "asset_class": "CRYPTOCURRENCY",
            "min_weight": None,
            "max_weight": 5.0,
            "reason": "Kullanıcı risk profiline göre kripto üst sınırı %5 olarak ayarlandı."
        }
    }}


class AdminOverrideUpdate(BaseModel):
    """Mevcut override'ı güncelleme."""
    min_weight: Optional[float] = Field(None, ge=0, le=100)
    max_weight: Optional[float] = Field(None, ge=0, le=100)
    reason: str = Field(..., min_length=5, max_length=500)
    is_active: bool = True


class AdminOverrideResponse(BaseModel):
    """API response şeması."""
    id: uuid.UUID
    user_id: uuid.UUID
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    asset_class: str
    min_weight: Optional[float]
    max_weight: Optional[float]
    reason: str
    created_by_admin_email: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserWithOverrides(BaseModel):
    """Admin kullanıcı listesi için."""
    userId: str
    email: str
    fullName: str
    role: str
    isActive: bool
    createdAt: str
    overrideCount: int = 0
    activeOverrides: list[AdminOverrideResponse] = []

    model_config = {"populate_by_name": True}
