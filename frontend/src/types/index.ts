// ─── Enums ───────────────────────────────────────────────────────────────────

export type ProfileType = 'conservative' | 'balanced' | 'aggressive'
export type HorizonType = 'short' | 'medium' | 'long'
export type AssetClass =
  | 'BIST_EQUITY'
  | 'SP500_EQUITY'
  | 'COMMODITY'
  | 'CRYPTOCURRENCY'
  | 'CASH_EQUIVALENT'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  userId: string
  email: string
  fullName: string
  role: 'investor' | 'admin'
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  fullName: string
  email: string
  password: string
}

// ─── Risk Assessment ─────────────────────────────────────────────────────────

export interface QuestionnaireAnswer {
  questionId: number
  selectedOption: number // 0–3
}

export interface RiskAssessment {
  assessmentId: string
  userId: string
  answers: QuestionnaireAnswer[]
  compositeScore: number
  profileType: ProfileType
  investmentHorizon: HorizonType
  completedAt: string
}

export interface AssessmentSubmitRequest {
  answers: QuestionnaireAnswer[]
}

export interface AssessmentListItem {
  assessmentId: string
  profileType: ProfileType
  investmentHorizon: HorizonType
  compositeScore: number
  portfolioId: string
  completedAt: string
}

export interface AssessmentResult {
  assessmentId: string
  profileType: ProfileType
  investmentHorizon: HorizonType
  compositeScore: number
  explanation: string
  portfolioId: string
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface FactorScore {
  momentum: number   // 0–100
  value: number
  quality: number
  volatility: number
  composite: number
  calculatedAt: string
}

export interface Instrument {
  instrumentId: string
  ticker: string
  name: string
  assetClass: AssetClass
  exchange: string
  currency: string
  currentPrice: number
  isActive: boolean
  factorScore?: FactorScore
  whySelected?: string[]
}

export interface AssetAllocation {
  allocationId: string
  portfolioId: string
  assetClass: AssetClass
  targetWeight: number  // percentage 0–100
  instruments: Instrument[]
}

export interface Portfolio {
  portfolioId: string
  userId: string
  assessmentId: string
  generatedAt: string
  isCurrent: boolean
  profileType: ProfileType
  horizonType: HorizonType
  allocations: AssetAllocation[]
  portfolioScore: number
  expectedVolatility: number
  expectedReturn: number
  explanation?: string
}

// ─── Market Data ──────────────────────────────────────────────────────────────

export interface PricePoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface InstrumentDetail extends Instrument {
  priceHistory: PricePoint[]
  metrics: {
    marketCap?: number
    peRatio?: number
    pbRatio?: number
    roe?: number
    week52High?: number
    week52Low?: number
    momentum1M?: number
    volatility1Y?: number
    beta?: number
  }
  whySelected: string[]
  isStale?: boolean
}

// ─── Comparison ───────────────────────────────────────────────────────────────

export interface PortfolioComparison {
  scenarioA: Portfolio
  scenarioB: Portfolio
  diff: {
    expectedReturn: number
    expectedVolatility: number
    equityExposure: number
    cryptoExposure: number
    cashExposure: number
    sharpeRatio: number
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface FactorWeights {
  momentum: number
  value: number
  quality: number
  lowVolatility: number
}

export interface AllocationRule {
  profile: ProfileType
  horizon: HorizonType
  equityPct: number
  cryptoPct: number
  commodityPct: number
  cashPct: number
}

export interface SystemConfig {
  factorWeights: FactorWeights
  allocationMatrix: AllocationRule[]
  yfinanceCacheTtlMinutes: number
  minDataCompleteness: number
  maxInstrumentsPerClass: number
  enableRedisCache: boolean
  useFallbackOnApiFailure: boolean
}

// ─── API Response wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
  isStale?: boolean
}

export interface ApiError {
  detail: string
  status: number
}
