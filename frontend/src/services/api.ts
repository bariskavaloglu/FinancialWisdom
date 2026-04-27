/// <reference types="vite/client" />


import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

// Per-endpoint timeout overrides (ms)
const ENDPOINT_TIMEOUTS: Record<string, number> = {
  'POST /assessments': 180_000,  // parallel fetch ~10s, but give lots of headroom   // portfolio generation can take up to 60s
  'GET /instruments':  30_000,   // yfinance detail fetch
}

function resolveTimeout(config: AxiosRequestConfig): number {
  const key = `${(config.method || 'GET').toUpperCase()} ${config.url || ''}`
  for (const [pattern, ms] of Object.entries(ENDPOINT_TIMEOUTS)) {
    if (key.startsWith(pattern)) return ms
  }
  return 15_000  // default 15s
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// ── Request interceptor: attach access token + per-endpoint timeout ───────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  config.timeout = resolveTimeout(config)
  return config
})

// ── Response interceptor: handle 401 → refresh token ─────────────────────────
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // Surface backend `detail` as a proper Error message
    if (error.response?.data) {
      const detail = (error.response.data as { detail?: string }).detail
      if (detail) {
        ;(error as Error & { userMessage?: string }).userMessage = detail
      }
    }

    // Handle timeout with friendly message
    if (error.code === 'ECONNABORTED') {
      const timeoutError = new Error(
        'The request took too long. The server is still working — please wait a moment and try again.'
      ) as Error & { userMessage?: string; isTimeout?: boolean }
      timeoutError.userMessage = timeoutError.message
      timeoutError.isTimeout = true
      return Promise.reject(timeoutError)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        isRefreshing = false
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        })
        const newToken: string = data.accessToken
        localStorage.setItem('accessToken', newToken)
        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
