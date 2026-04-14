from pydantic import BaseModel, Field


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
