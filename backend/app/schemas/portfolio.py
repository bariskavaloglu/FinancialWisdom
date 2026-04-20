from pydantic import BaseModel


class FactorScore(BaseModel):
    momentum: float
    value: float
    quality: float
    volatility: float
    composite: float
    calculatedAt: str


class Instrument(BaseModel):
    instrumentId: str
    ticker: str
    name: str
    assetClass: str
    exchange: str
    currency: str = "USD"
    currentPrice: float
    isActive: bool
    factorScore: FactorScore | None = None
    whySelected: list[str] = []


class AssetAllocation(BaseModel):
    allocationId: str
    portfolioId: str
    assetClass: str
    targetWeight: float
    instruments: list[Instrument]


class Portfolio(BaseModel):
    portfolioId: str
    userId: str
    assessmentId: str
    generatedAt: str
    isCurrent: bool
    profileType: str
    horizonType: str
    allocations: list[AssetAllocation]
    portfolioScore: int
    expectedVolatility: float
    expectedReturn: float = 0.0
    explanation: str | None = None


class PortfolioDiff(BaseModel):
    expectedReturn: float
    expectedVolatility: float
    equityExposure: float
    cryptoExposure: float
    cashExposure: float
    sharpeRatio: float


class PortfolioComparison(BaseModel):
    scenarioA: Portfolio
    scenarioB: Portfolio
    diff: PortfolioDiff
