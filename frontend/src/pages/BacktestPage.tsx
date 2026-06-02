/**
 * BacktestPage — Portfolio Validation + True Simulation
 *
 * İki mod:
 *  A) Mevcut Portföy Backtesti (eski davranış):
 *     Kullanıcının kayıtlı portföyü seçilen yıla taşınır.
 *     H1 (Jan–Jun) = sinyal, H2 (Jul–Dec) = gerçek performans.
 *
 *  B) Gerçek Simülasyon (yeni):
 *     Kullanıcı anketten bir tarih seçer.
 *     Backend, o tarih itibarıyla factor scoring yaparak portföy oluşturur
 *     (lookahead bias yok). Oluşan portföy H2 gerçek verisiyle karşılaştırılır.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner, Disclaimer, EmptyState } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { portfolioService, poolService, assessmentService } from '@/services'
import type { Portfolio, AssessmentListItem } from '@/types'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricePoint { date: string; close: number }

interface HoldingResult {
  ticker:       string
  name:         string
  assetClass:   string
  weight:       number
  priceH1Start: number
  priceH1End:   number
  priceH2End:   number
  h1Return:     number
  h2Return:     number
  contribution: number
  monthlyH2:    number[]
}

interface BacktestResult {
  portfolio:        Portfolio | SimPortfolio
  year:             number
  holdings:         HoldingResult[]
  totalH2:          number
  totalH1:          number
  maxDrawdown:      number
  sharpe:           number
  winRate:          number
  cumulativeSeries: number[]
  isSimulation?:    boolean
  simulatedAsOf?:   string
}

// Simülasyon modu portföy tipi (DB'ye kayıtlı değil)
interface SimPortfolio {
  simulated:          true
  asOfDate:           string
  profileType:        string
  horizonType:        string
  portfolioScore:     number
  expectedReturn:     number
  expectedVolatility: number
  explanation:        string
  allocations: Array<{
    assetClass:   string
    targetWeight: number
    instruments:  Array<{ ticker: string; name: string; assetClass: string }>
  }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASS_COLORS: Record<string, string> = {
  BIST_EQUITY:     '#378ADD',
  SP500_EQUITY:    '#1D9E75',
  COMMODITY:       '#BA7517',
  CRYPTOCURRENCY:  '#7F77DD',
  CASH_EQUIVALENT: '#888780',
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function fmtPct(v: number, d = 2) {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`
}

function splitHalves(prices: PricePoint[], year: number) {
  const h1Cut     = `${year}-07-01`
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year + 1}-01-01`
  return {
    h1: prices.filter((p) => p.date >= yearStart && p.date < h1Cut),
    h2: prices.filter((p) => p.date >= h1Cut    && p.date < yearEnd),
  }
}

function monthlyH2Returns(h2: PricePoint[]): number[] {
  const buckets: Record<number, PricePoint[]> = {}
  h2.forEach((p) => {
    const m = new Date(p.date).getMonth()
    if (!buckets[m]) buckets[m] = []
    buckets[m].push(p)
  })
  return Array.from({ length: 6 }, (_, i) => {
    const pts = buckets[6 + i] ?? []
    if (pts.length < 2) return 0
    return (pts[pts.length - 1].close - pts[0].close) / pts[0].close
  })
}

function toCumulative(monthly: number[]): number[] {
  let cum = 0
  return monthly.map((m) => { cum += m; return cum })
}

function portfolioMonthly(holdings: HoldingResult[]): number[] {
  return Array.from({ length: 6 }, (_, i) =>
    holdings.reduce((s, h) => s + h.weight * (h.monthlyH2[i] ?? 0), 0),
  )
}

function calcMaxDrawdown(series: number[]): number {
  let peak = 0, maxDD = 0
  series.forEach((v) => {
    if (v > peak) peak = v
    const dd = peak - v
    if (dd > maxDD) maxDD = dd
  })
  return maxDD
}

function calcSharpe(monthly: number[]): number {
  if (!monthly.length) return 0
  const mean = monthly.reduce((s, v) => s + v, 0) / monthly.length
  const std  = Math.sqrt(monthly.reduce((s, v) => s + (v - mean) ** 2, 0) / monthly.length)
  return std === 0 ? 0 : (mean / std) * Math.sqrt(12)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean | null
}) {
  const clr = positive == null
    ? 'text-stone-900 dark:text-stone-100'
    : positive ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  return (
    <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4">
      <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-display font-medium ${clr}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="text-stone-500 dark:text-stone-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#888' }} className="font-medium">
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value.toFixed(2)}%
        </p>
      ))}
    </div>
  )
}

// ─── Ana yardımcı: herhangi bir portföy (normal veya sim) için backtest yap ──

async function runBacktestForPortfolio(
  instruments: { ticker: string; name: string; assetClass: string; weight: number }[],
  year: number,
  language: string,
  onSoftErr: (msg: string) => void,
): Promise<HoldingResult[]> {
  const holdings: HoldingResult[] = []

  for (const inst of instruments) {
    try {
      const data   = await poolService.getTicker(inst.ticker, '2y')
      const prices: PricePoint[] = (data.history ?? data.prices ?? data.chart ?? []).map(
        (p: { date: string; close: number }) => ({ date: p.date, close: p.close })
      )
      const { h1, h2 } = splitHalves(prices, year)

      if (h1.length < 2 || h2.length < 2) {
        onSoftErr(`${inst.ticker}: ${language === 'tr' ? 'yeterli fiyat verisi yok' : 'insufficient price data'}`)
        continue
      }

      const h1Return = (h1[h1.length - 1].close - h1[0].close) / h1[0].close
      const h2Return = (h2[h2.length - 1].close - h2[0].close) / h2[0].close
      const monthly  = monthlyH2Returns(h2)

      holdings.push({
        ticker:       inst.ticker,
        name:         inst.name,
        assetClass:   inst.assetClass,
        weight:       inst.weight,
        priceH1Start: h1[0].close,
        priceH1End:   h1[h1.length - 1].close,
        priceH2End:   h2[h2.length - 1].close,
        h1Return,
        h2Return,
        contribution: inst.weight * h2Return,
        monthlyH2:    monthly,
      })
    } catch {
      onSoftErr(`${inst.ticker}: ${language === 'tr' ? 'veri alınamadı' : 'data unavailable'}`)
    }
  }
  return holdings
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const navigate    = useNavigate()
  const { theme, t, language } = useThemeLang()
  useEffect(() => { document.title = `${t('page.backtest')} | Financial Wisdom` }, [language, t])
  const currentYear = new Date().getFullYear()

  // Mod: 'portfolio' = mevcut portföy, 'simulation' = gerçek simülasyon
  const [mode, setMode] = useState<'portfolio' | 'simulation'>('portfolio')

  // ── Portfolio mode state ───────────────────────────────────────────────────
  const [portfolio,        setPortfolio       ] = useState<Portfolio | null>(null)
  const [allPortfolios,    setAllPortfolios    ] = useState<Portfolio[]>([])
  const [loadingPortfolio, setLoadingPortfolio ] = useState(true)
  const [portfolioError,   setPortfolioError  ] = useState<string | null>(null)

  // ── Simulation mode state ──────────────────────────────────────────────────
  const [assessments,        setAssessments       ] = useState<AssessmentListItem[]>([])
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentListItem | null>(null)
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  const [simAsOfDate,        setSimAsOfDate       ] = useState('')  // "YYYY-MM-DD"

  // ── Shared state ───────────────────────────────────────────────────────────
  const [year,     setYear    ] = useState(currentYear - 1)
  const [loading,  setLoading ] = useState(false)
  const [softErr,  setSoftErr ] = useState<string | null>(null)
  const [fatalErr, setFatalErr] = useState<string | null>(null)
  const [result,   setResult  ] = useState<BacktestResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const availableYears = [currentYear - 1, currentYear - 2, currentYear - 3].filter(y => y >= 2022)

  const isDark    = theme === 'dark'
  const gridColor = isDark ? '#292524' : '#f5f5f4'
  const tickColor = isDark ? '#78716c' : '#a8a29e'
  const tipStyle  = { background: isDark ? '#1c1917' : '#fff', border: `1px solid ${isDark ? '#44403c' : '#e7e5e4'}`, borderRadius: 8 }

  const CLASS_LABELS: Record<string, string> = {
    BIST_EQUITY:     language === 'tr' ? 'BIST Hisse' : 'BIST Equity',
    SP500_EQUITY:    'S&P 500',
    COMMODITY:       language === 'tr' ? 'Emtia'      : 'Commodity',
    CRYPTOCURRENCY:  language === 'tr' ? 'Kripto'     : 'Crypto',
    CASH_EQUIVALENT: language === 'tr' ? 'Nakit'      : 'Cash',
  }

  const PROFILE_LABELS: Record<string, string> = {
    conservative: t('profile.conservative'),
    balanced:     t('profile.balanced'),
    aggressive:   t('profile.aggressive'),
  }

  const HORIZON_LABELS: Record<string, string> = {
    short:  t('horizon.short'),
    medium: t('horizon.medium'),
    long:   t('horizon.long'),
  }

  const H2_MONTHS = language === 'tr'
    ? ['Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    : ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // 1. Load portfolios
  useEffect(() => {
    portfolioService.list()
      .then((ps: Portfolio[]) => {
        if (ps.length === 0) { setPortfolioError('no_portfolio'); setLoadingPortfolio(false); return }
        setAllPortfolios(ps)
        setPortfolio(ps[0])
        setLoadingPortfolio(false)
      })
      .catch(() => { setPortfolioError('no_portfolio'); setLoadingPortfolio(false) })
  }, [])

  // 2. Load assessments for simulation mode
  useEffect(() => {
    if (mode !== 'simulation') return
    setLoadingAssessments(true)
    assessmentService.listAll()
      .then((list) => {
        setAssessments(list)
        if (list.length > 0) setSelectedAssessment(list[0])
        setLoadingAssessments(false)
      })
      .catch(() => setLoadingAssessments(false))
  }, [mode])

  // ── Portfolio mode backtest ────────────────────────────────────────────────
  const runPortfolioBacktest = useCallback(async () => {
    if (!portfolio) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true); setSoftErr(null); setFatalErr(null); setResult(null)

    try {
      const instruments: { ticker: string; name: string; assetClass: string; weight: number }[] = []
      for (const alloc of portfolio.allocations) {
        const insts = alloc.instruments ?? []
        if (!insts.length) continue
        const perInst = (alloc.targetWeight / 100) / insts.length
        for (const inst of insts) {
          instruments.push({ ticker: inst.ticker, name: inst.name ?? inst.ticker, assetClass: alloc.assetClass, weight: perInst })
        }
      }

      if (instruments.length === 0) {
        setFatalErr(language === 'tr' ? 'Portföyde varlık bulunamadı.' : 'No assets found in portfolio.')
        setLoading(false); return
      }

      const holdings = await runBacktestForPortfolio(instruments, year, language, (msg) => setSoftErr(msg))

      if (holdings.length === 0) {
        setFatalErr(language === 'tr' ? 'Hiçbir varlık için veri alınamadı.' : 'No data available for any asset.')
        setLoading(false); return
      }

      const monthly       = portfolioMonthly(holdings)
      const cumSeries     = toCumulative(monthly)
      const totalH2       = holdings.reduce((s, h) => s + h.contribution, 0)
      const totalH1       = holdings.reduce((s, h) => s + h.weight * h.h1Return, 0)

      setResult({ portfolio, year, holdings, totalH2, totalH1, maxDrawdown: calcMaxDrawdown(cumSeries), sharpe: calcSharpe(monthly), winRate: holdings.filter(h => h.h2Return > 0).length / holdings.length, cumulativeSeries: cumSeries })
    } catch {
      setFatalErr(language === 'tr' ? 'Beklenmeyen bir hata oluştu.' : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [portfolio, year, language])

  // ── Simulation mode backtest ───────────────────────────────────────────────
  const runSimulation = useCallback(async () => {
    if (!selectedAssessment || !simAsOfDate) {
      setFatalErr(language === 'tr' ? 'Anket ve tarih seçmelisiniz.' : 'Please select an assessment and date.')
      return
    }

    // as_of_date yılı ile backtest yılı tutarlı olmalı
    const asOfYear = parseInt(simAsOfDate.split('-')[0])
    const asOfMonth = parseInt(simAsOfDate.split('-')[1])
    // Simülasyon için otomatik yıl: tarih H1'deyse aynı yıl, H2'deyse sonraki yıl
    const autoYear = asOfMonth <= 6 ? asOfYear : asOfYear + 1
    const backtestYear = Math.max(2022, Math.min(currentYear - 1, autoYear))

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true); setSoftErr(null); setFatalErr(null); setResult(null)

    try {
      // 1. Backend'den o tarihe göre portföy oluştur
      // Assessment answers'ını çek
      const answersResp = await fetch(`/api/v1/assessments/${selectedAssessment.assessmentId}/answers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('fw_token') ?? ''}` }
      })
      if (!answersResp.ok) {
        throw new Error(language === 'tr'
          ? 'Anket cevapları alınamadı. Anketi yeniden doldurun.'
          : 'Could not fetch assessment answers. Please re-submit the questionnaire.')
      }
      const answersData = await answersResp.json()

      const simPortfolio: SimPortfolio = await assessmentService.simulate(answersData.answers, simAsOfDate)

      // 2. Simüle portföyden instrument listesi çıkar
      const instruments: { ticker: string; name: string; assetClass: string; weight: number }[] = []
      for (const alloc of simPortfolio.allocations) {
        const insts = alloc.instruments ?? []
        if (!insts.length) continue
        const perInst = (alloc.targetWeight / 100) / insts.length
        for (const inst of insts) {
          instruments.push({ ticker: inst.ticker, name: inst.name ?? inst.ticker, assetClass: alloc.assetClass, weight: perInst })
        }
      }

      if (instruments.length === 0) {
        setFatalErr(language === 'tr' ? 'Simüle portföyde varlık bulunamadı.' : 'No assets in simulated portfolio.')
        setLoading(false); return
      }

      // 3. H2 gerçek verisiyle karşılaştır
      const holdings = await runBacktestForPortfolio(instruments, backtestYear, language, (msg) => setSoftErr(msg))

      if (holdings.length === 0) {
        setFatalErr(language === 'tr' ? 'Hiçbir varlık için veri alınamadı.' : 'No price data available.')
        setLoading(false); return
      }

      const monthly   = portfolioMonthly(holdings)
      const cumSeries = toCumulative(monthly)
      const totalH2   = holdings.reduce((s, h) => s + h.contribution, 0)
      const totalH1   = holdings.reduce((s, h) => s + h.weight * h.h1Return, 0)

      setYear(backtestYear)
      setResult({
        portfolio:    simPortfolio as unknown as Portfolio,
        year:         backtestYear,
        holdings,
        totalH2,
        totalH1,
        maxDrawdown:      calcMaxDrawdown(cumSeries),
        sharpe:           calcSharpe(monthly),
        winRate:          holdings.filter(h => h.h2Return > 0).length / holdings.length,
        cumulativeSeries: cumSeries,
        isSimulation:     true,
        simulatedAsOf:    simAsOfDate,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setFatalErr(language === 'tr' ? `Simülasyon hatası: ${msg}` : `Simulation error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [selectedAssessment, simAsOfDate, language, currentYear])

  // Auto-run portfolio backtest on load
  useEffect(() => {
    if (portfolio && mode === 'portfolio') runPortfolioBacktest()
  }, [portfolio]) // eslint-disable-line

  const cumulChartData = result?.cumulativeSeries.map((v, i) => ({
    month: H2_MONTHS[i],
    getiri: parseFloat((v * 100).toFixed(2)),
  })) ?? []

  const barData = result?.holdings.map((h) => ({
    ticker: h.ticker.replace('.IS', '').replace('-USD', ''),
    h1: parseFloat((h.h1Return * 100).toFixed(2)),
    h2: parseFloat((h.h2Return * 100).toFixed(2)),
  })) ?? []

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loadingPortfolio) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-stone-500 dark:text-stone-400 text-sm">{t('backtest.loading')}</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (portfolioError || !portfolio) {
    return (
      <AppLayout>
        <EmptyState
          title={t('backtest.notFound')}
          description={t('backtest.notFoundDesc')}
          action={<Button onClick={() => navigate('/questionnaire')}>{t('backtest.goToQuest')}</Button>}
        />
      </AppLayout>
    )
  }

  const profileLabel = PROFILE_LABELS[result ? (result.portfolio as SimPortfolio).profileType ?? (result.portfolio as Portfolio).profileType : portfolio.profileType] ?? portfolio.profileType
  const horizonLabel = HORIZON_LABELS[result ? (result.portfolio as SimPortfolio).horizonType ?? (result.portfolio as Portfolio).horizonType : portfolio.horizonType] ?? portfolio.horizonType

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-medium text-stone-900 dark:text-stone-100">
              {t('backtest.title')}
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {t('backtest.subtitle')}
            </p>
          </div>

          {/* Mod seçici */}
          <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 text-xs font-medium">
            <button
              onClick={() => { setMode('portfolio'); setResult(null) }}
              className={`px-4 py-2 transition-colors ${mode === 'portfolio'
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                : 'bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
            >
              {language === 'tr' ? 'Mevcut Portföy' : 'Current Portfolio'}
            </button>
            <button
              onClick={() => { setMode('simulation'); setResult(null) }}
              className={`px-4 py-2 transition-colors border-l border-stone-200 dark:border-stone-700 ${mode === 'simulation'
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                : 'bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
            >
              {language === 'tr' ? '🔬 Gerçek Simülasyon' : '🔬 True Simulation'}
            </button>
          </div>
        </div>

        {/* ── MOD A: Mevcut portföy kontrolleri ──────────────────────────────── */}
        {mode === 'portfolio' && (
          <div className="card">
            <div className="flex flex-wrap items-center gap-3">
              {allPortfolios.length > 1 && (
                <select
                  value={portfolio?.portfolioId ?? ''}
                  onChange={(e) => {
                    const selected = allPortfolios.find(p => p.portfolioId === e.target.value)
                    if (selected) { setPortfolio(selected); setResult(null) }
                  }}
                  className="text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                >
                  {allPortfolios.map((p) => (
                    <option key={p.portfolioId} value={p.portfolioId}>
                      {PROFILE_LABELS[p.profileType] ?? p.profileType} · {HORIZON_LABELS[p.horizonType] ?? p.horizonType} · {new Date(p.generatedAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 text-xs">
                <span className="px-3 py-2 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium">
                  {t('backtest.janJun')} {year}
                </span>
                <span className="px-2 py-2 bg-stone-100 dark:bg-stone-800 text-stone-400">→</span>
                <span className="px-3 py-2 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-medium">
                  {t('backtest.julDec')} {year}
                </span>
              </div>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
              >
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={runPortfolioBacktest} disabled={loading} className="btn-primary text-sm !px-5 !py-2 !rounded-xl">
                {loading ? <Spinner size="sm" /> : t('backtest.calculate')}
              </button>
            </div>
          </div>
        )}

        {/* ── MOD B: Simülasyon kontrolleri ──────────────────────────────────── */}
        {mode === 'simulation' && (
          <div className="card space-y-4">
            <div>
              <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                {language === 'tr' ? 'Simülasyon Nasıl Çalışır?' : 'How Simulation Works'}
              </p>
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                {language === 'tr'
                  ? 'Bir anket ve tarih seçin. Sistem, o tarih itibarıyla piyasa verilerini kullanarak portföy oluşturur — gelecek bilgisi kullanılmaz. Ardından oluşturulan portföyün gerçek H2 performansı hesaplanır.'
                  : 'Select an assessment and date. The system builds a portfolio using only market data available up to that date — no lookahead. Then real H2 performance is calculated for the generated portfolio.'}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              {/* Anket seçici */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1 block">
                  {language === 'tr' ? 'Anket Seç' : 'Select Assessment'}
                </label>
                {loadingAssessments ? (
                  <div className="flex items-center gap-2 text-sm text-stone-400"><Spinner size="sm" /> Yükleniyor…</div>
                ) : assessments.length === 0 ? (
                  <p className="text-sm text-red-500">{language === 'tr' ? 'Anket bulunamadı.' : 'No assessments found.'}</p>
                ) : (
                  <select
                    value={selectedAssessment?.assessmentId ?? ''}
                    onChange={(e) => {
                      const a = assessments.find(x => x.assessmentId === e.target.value)
                      if (a) setSelectedAssessment(a)
                    }}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                  >
                    {assessments.map((a) => (
                      <option key={a.assessmentId} value={a.assessmentId}>
                        {PROFILE_LABELS[a.profileType] ?? a.profileType} · {HORIZON_LABELS[a.investmentHorizon] ?? a.investmentHorizon} · {new Date(a.completedAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Simülasyon tarihi */}
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1 block">
                  {language === 'tr' ? 'Simülasyon Tarihi' : 'Simulation Date'}
                </label>
                <input
                  type="date"
                  value={simAsOfDate}
                  max={`${currentYear - 1}-12-31`}
                  min="2022-01-01"
                  onChange={(e) => setSimAsOfDate(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                />
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                  {language === 'tr'
                    ? 'Bu tarih itibarıyla portföy oluşturulur. H2 performansı otomatik hesaplanır.'
                    : 'Portfolio is built as of this date. H2 performance is calculated automatically.'}
                </p>
              </div>

              <button
                onClick={runSimulation}
                disabled={loading || !simAsOfDate || !selectedAssessment}
                className="btn-primary text-sm !px-5 !py-2 !rounded-xl self-end"
              >
                {loading ? <Spinner size="sm" /> : (language === 'tr' ? 'Simülasyonu Çalıştır' : 'Run Simulation')}
              </button>
            </div>
          </div>
        )}

        {/* ── Simülasyon bilgi banner'ı ──────────────────────────────────────── */}
        {result?.isSimulation && (
          <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-3 flex items-start gap-3">
            <span className="text-lg">🔬</span>
            <div>
              <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
                {language === 'tr' ? 'Gerçek Simülasyon Sonucu' : 'True Simulation Result'}
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                {language === 'tr'
                  ? `Portföy ${result.simulatedAsOf} tarihi itibarıyla oluşturuldu — o tarihe kadarki piyasa verisi kullanıldı. ${result.year} H2 performansı gerçek fiyatlarla hesaplandı.`
                  : `Portfolio was built as of ${result.simulatedAsOf} using only data available up to that date. ${result.year} H2 performance calculated from real prices.`}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="card flex items-center gap-3 py-8 justify-center text-stone-500 dark:text-stone-400">
            <Spinner size="md" />
            <span className="text-sm">
              {mode === 'simulation'
                ? (language === 'tr' ? 'Simülasyon çalışıyor — factor scoring + fiyat verisi…' : 'Running simulation — factor scoring + price data…')
                : `${year} yfinance ${language === 'tr' ? 'verisi çekiliyor' : 'data fetching'}…`}
            </span>
          </div>
        )}

        {/* Soft error */}
        {softErr && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">⚠ {softErr}</p>
          </div>
        )}

        {/* Fatal error */}
        {fatalErr && !loading && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">⚠ {fatalErr}</p>
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────────────── */}
        {result && !loading && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label={`${t('backtest.h2Return')} (${result.year})`}
                value={fmtPct(result.totalH2)}
                sub={t('backtest.h2Sub')}
                positive={result.totalH2 >= 0}
              />
              <StatCard
                label={`${t('backtest.h1Signal')} (${result.year})`}
                value={fmtPct(result.totalH1)}
                sub={t('backtest.h1Sub')}
                positive={result.totalH1 >= 0}
              />
              <StatCard
                label={t('backtest.winners')}
                value={`${Math.round(result.winRate * 100)}%`}
                sub={`${result.holdings.filter(h => h.h2Return > 0).length} / ${result.holdings.length} ${t('backtest.assets')}`}
                positive={result.winRate >= 0.5}
              />
              <StatCard
                label={t('backtest.sharpe')}
                value={result.sharpe.toFixed(2)}
                sub={`${t('backtest.maxDrawdown')} ${fmtPct(-result.maxDrawdown)}`}
                positive={result.sharpe >= 0.5}
              />
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                  {t('backtest.cumReturn')} · {t('backtest.julDec')} {result.year}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cumulChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} contentStyle={tipStyle} />
                    <ReferenceLine y={0} stroke={isDark ? '#57534e' : '#d6d3d1'} strokeDasharray="4 4" />
                    <Line
                      type="monotone" dataKey="getiri"
                      name={language === 'tr' ? 'Portföy' : 'Portfolio'}
                      stroke={result.totalH2 >= 0 ? '#639922' : '#E24B4A'}
                      strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                  {t('backtest.h1vsH2')}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={12} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="ticker" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tipStyle}
                      formatter={(v: number, name: string) => [
                        `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
                        name === 'h1' ? t('backtest.h1Period') : t('backtest.h2ReturnCol'),
                      ]}
                    />
                    <ReferenceLine y={0} stroke={isDark ? '#57534e' : '#d6d3d1'} />
                    <Bar dataKey="h1" name="h1" fill={isDark ? '#44403c' : '#d6d3d1'} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="h2" name="h2" radius={[3, 3, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.h2 >= 0 ? '#639922' : '#E24B4A'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3 text-xs text-stone-400 dark:text-stone-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: isDark ? '#44403c' : '#d6d3d1' }} />
                    {t('backtest.h1Period')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-green-600" />
                    {t('backtest.h2Positive')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    {t('backtest.h2Negative')}
                  </span>
                </div>
              </div>
            </div>

            {/* Asset table */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                  {t('backtest.assetDetail')}
                  {result.isSimulation && (
                    <span className="ml-2 text-xs normal-case px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                      {language === 'tr' ? 'simüle portföy' : 'simulated portfolio'}
                    </span>
                  )}
                </h3>
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  yfinance · {result.year} · {result.holdings.length} {t('backtest.assets')}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wider border-b border-stone-200 dark:border-stone-700">
                      <th className="text-left pb-3 pr-4">{t('backtest.assetCol')}</th>
                      <th className="text-left pb-3 pr-4">{t('backtest.classCol')}</th>
                      <th className="text-right pb-3 pr-4">{t('backtest.weightCol')}</th>
                      <th className="text-right pb-3 pr-4">{t('backtest.h1StartPrice')}</th>
                      <th className="text-right pb-3 pr-4">{t('backtest.h1Return')}</th>
                      <th className="text-right pb-3 pr-4">{t('backtest.h2ReturnCol')}</th>
                      <th className="text-right pb-3">{t('backtest.contribution')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {[...result.holdings]
                      .sort((a, b) => b.h2Return - a.h2Return)
                      .map((h) => {
                        const clrCls = CLASS_COLORS[h.assetClass] ?? '#888'
                        return (
                          <tr key={h.ticker} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-stone-900 dark:text-stone-100 font-mono text-xs">{h.ticker.replace('.IS', '').replace('-USD', '')}</p>
                              {h.name !== h.ticker && (
                                <p className="text-xs text-stone-400 dark:text-stone-500 truncate max-w-[140px]">{h.name}</p>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-xs px-2 py-0.5 rounded-full border font-medium" style={{ color: clrCls, borderColor: `${clrCls}40`, background: `${clrCls}15` }}>
                                {CLASS_LABELS[h.assetClass] ?? h.assetClass}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right text-stone-700 dark:text-stone-300 font-medium text-xs">
                              {(h.weight * 100).toFixed(1)}%
                            </td>
                            <td className="py-3 pr-4 text-right text-stone-400 dark:text-stone-500 font-mono text-xs">
                              {h.priceH1Start.toFixed(2)}
                            </td>
                            <td className={`py-3 pr-4 text-right text-xs font-medium ${h.h1Return >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {fmtPct(h.h1Return)}
                            </td>
                            <td className={`py-3 pr-4 text-right font-medium ${h.h2Return >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {fmtPct(h.h2Return)}
                            </td>
                            <td className={`py-3 text-right text-xs ${h.contribution >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {fmtPct(h.contribution)}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-200 dark:border-stone-600">
                      <td colSpan={6} className="pt-3 text-sm font-medium text-stone-700 dark:text-stone-300">
                        {t('backtest.totalH2')}
                      </td>
                      <td className={`pt-3 text-right font-bold text-base ${result.totalH2 >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmtPct(result.totalH2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Verdict */}
            <div className={`card flex gap-4 items-start ${
              result.totalH2 >= 0.08
                ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20'
                : result.totalH2 >= 0
                  ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20'
                  : 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                result.totalH2 >= 0.08
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                  : result.totalH2 >= 0
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
              }`}>
                {result.totalH2 >= 0.08 ? '✓' : result.totalH2 >= 0 ? '~' : '✕'}
              </div>
              <div>
                <p className={`text-sm font-medium mb-1.5 ${
                  result.totalH2 >= 0.08 ? 'text-green-800 dark:text-green-300'
                    : result.totalH2 >= 0 ? 'text-amber-800 dark:text-amber-300'
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {t('backtest.validResult')
                    .replace('{profile}', profileLabel)
                    .replace('{year}', String(result.year))}
                </p>
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                  {result.totalH2 >= 0.08
                    ? t('backtest.resultGood').replace('{ret}', fmtPct(result.totalH2)).replace('{year}', String(result.year)).replace('{h1}', fmtPct(result.totalH1))
                    : result.totalH2 >= 0
                      ? t('backtest.resultOk').replace('{ret}', fmtPct(result.totalH2)).replace('{year}', String(result.year)).replace('{h1}', fmtPct(result.totalH1))
                      : t('backtest.resultBad').replace('{ret}', fmtPct(result.totalH2)).replace('{year}', String(result.year)).replace('{h1}', fmtPct(result.totalH1))}
                </p>
              </div>
            </div>

            <Disclaimer />
          </>
        )}
      </div>
    </AppLayout>
  )
}
