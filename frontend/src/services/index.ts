/**
 * services/index.ts — Backend API calls
 *
 * Endpoint mapping:
 *   assessmentService.submit    → POST  /api/v1/assessments
 *   assessmentService.getLatest → GET   /api/v1/assessments/latest
 *   portfolioService.getLatest  → GET   /api/v1/portfolios/current
 *   portfolioService.getById    → GET   /api/v1/portfolios/:id
 *   portfolioService.list       → GET   /api/v1/portfolios
 *   portfolioService.compare    → GET   /api/v1/portfolios/compare?a=&b=
 *   instrumentService.getDetail → GET   /api/v1/instruments/:ticker
 *   poolService.getSnapshot     → GET   /api/v1/pool
 *   poolService.getTicker       → GET   /api/v1/pool/:ticker
 *   poolService.refresh         → GET   /api/v1/pool/refresh
 *   adminService.getConfig      → GET   /api/v1/admin/config
 *   adminService.updateConfig   → PUT   /api/v1/admin/config
 */

import { api } from '@/services/api'
import type {
  AssessmentSubmitRequest,
  AssessmentResult,
  AssessmentListItem,
  Portfolio,
  PortfolioComparison,
} from '@/types'

// ─── Assessment Service ───────────────────────────────────────────────────────

export const assessmentService = {
  submit: async (data: AssessmentSubmitRequest): Promise<AssessmentResult> => {
    const { data: result } = await api.post('/assessments', data)
    return result
  },

  getLatest: async (): Promise<AssessmentResult | null> => {
    try {
      const { data } = await api.get('/assessments/latest')
      return data
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) return null
      throw err
    }
  },

  listAll: async (): Promise<AssessmentListItem[]> => {
    const { data } = await api.get('/assessments/history')
    return data
  },
}

// ─── Portfolio Service ─────────────────────────────────────────────────────────

export const portfolioService = {
  getLatest: async (): Promise<Portfolio> => {
    const { data } = await api.get('/portfolios/current')
    return data
  },

  getById: async (id: string): Promise<Portfolio> => {
    const { data } = await api.get(`/portfolios/${id}`)
    return data
  },

  list: async (): Promise<Portfolio[]> => {
    const { data } = await api.get('/portfolios')
    return data
  },

  compare: async (idA: string, idB: string): Promise<PortfolioComparison> => {
    const { data } = await api.get('/portfolios/compare', {
      params: { a: idA, b: idB },
    })
    return data
  },
}

// ─── Instrument Service ───────────────────────────────────────────────────────

export const instrumentService = {
  getDetail: async (ticker: string, period = '1y') => {
    const { data } = await api.get(`/instruments/${ticker}`, {
      params: { period },
    })
    return data
  },

  getPriceHistory: async (ticker: string, period = '1y') => {
    const { data } = await api.get(`/instruments/${ticker}/history`, {
      params: { period },
    })
    return data
  },
}

// ─── Market Pool Service ──────────────────────────────────────────────────────

export const poolService = {
  /** Tüm universe tickerlarının anlık snapshot'ı */
  getSnapshot: async (period = '1y', assetClass?: string) => {
    const params: Record<string, string> = { period }
    if (assetClass) params.asset_class = assetClass
    const { data } = await api.get('/pool', { params })
    return data
  },

  /** Tek ticker'ın tam geçmişi + factor skoru */
  getTicker: async (ticker: string, period = '1y') => {
    const { data } = await api.get(`/pool/${ticker}`, { params: { period } })
    return data
  },

  /** Cache warmup tetikle */
  refresh: async () => {
    const { data } = await api.get('/pool/refresh')
    return data
  },
}

// ─── Admin Service ────────────────────────────────────────────────────────────

export const adminService = {
  getConfig: async () => {
    const { data } = await api.get('/admin/config')
    return data
  },

  updateConfig: async (config: unknown) => {
    const { data } = await api.put('/admin/config', config)
    return data
  },

  getUsers: async () => {
    const { data } = await api.get('/admin/users')
    return data
  },

  getCacheKeys: async () => {
    const { data } = await api.get('/admin/cache')
    return data
  },

  flushCache: async () => {
    await api.delete('/admin/cache')
  },
}

// ─── Auth service — artık AuthContext tarafından yönetiliyor ─────────────────

export const authService = {
  me: async () => {
    const { data } = await api.get('/auth/me')
    return data
  },
  login:    async () => { throw new Error('AuthContext kullan') },
  register: async () => { throw new Error('AuthContext kullan') },
  logout:   async () => { throw new Error('AuthContext kullan') },
}
