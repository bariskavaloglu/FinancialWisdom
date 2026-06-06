/**
 * BacktestPage — Portfolio Validation via Questionnaire Simulation
 *
 * Doğru flow:
 *  1. Kullanıcının anket geçmişi listelenir → birini seçer.
 *  2. Kullanıcı bir yıl seçer (örn. 2025).
 *  3. Seçilen anketin cevapları + "YYYY-06-30" (H1 sonu) tarihi ile
 *     /assessments/simulate çağrılır → o tarihe göre portföy inşa edilir.
 *  4. O simüle portföyün varlıklarına ait H2 (Tem–Ara) gerçek fiyat
 *     verileri yfinance üzerından çekilir.
 *  5. H2 getiri, Sharpe, max-drawdown hesaplanır ve gösterilir.
 *
 * H1 dönemi gösterilmez — portföy henüz o dönemde yoktu.
 * Gösterilen tek performans: H2 (portföyün tutulduğu dönem).
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner, Disclaimer, EmptyState } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { assessmentService, poolService } from '@/services'
import type { AssessmentListItem } from '@/types'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricePoint { date: string; close: number }

interface HoldingResult {
  ticker:        string
  name:          string
  assetClass:    string
  weight:        number
  entryPrice:    number   // H2 başlangıç fiyatı (1 Temmuz)
  exitPrice:     number   // H2 bitiş fiyatı (31 Aralık)
  h2Return:      number
  contribution:  number
  monthlyH2:     number[]
}

interface SimulatedPortfolio {
  profileType:        string
  horizonType:        string
  portfolioScore:     number
  expectedReturn:     number
  expectedVolatility: number
  explanation:        string
  allocations: Array<{
    assetClass:   string
    targetWeight: number
    instruments:  Array<{ ticker: string; name: string }>
  }>
}

interface BacktestResult {
  simPortfolio:     SimulatedPortfolio
  year:             number
  asOfDate:         string
  holdings:         HoldingResult[]
  totalH2:          number
  maxDrawdown:      number
  sharpe:           number
  winRate:          number
  cumulativeSeries: number[]
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

/** Yalnızca H2 (Temmuz–Aralık) dilimini döner */
function sliceH2(prices: PricePoint[], year: number): PricePoint[] {
  const h2Start = `${year}-07-01`
  const h2End   = `${year + 1}-01-01`
  return prices.filter((p) => p.date >= h2Start && p.date < h2End)
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const navigate   = useNavigate()
  const { theme, t, language } = useThemeLang()
  useEffect(() => { document.title = `${t('backtest.title')} | Financial Wisdom` }, [language, t])

  const currentYear = new Date().getFullYear()
  const availableYears = [currentYear - 1, currentYear - 2].filter(y => y >= 2024)

  // ── State ──────────────────────────────────────────────────────────────────
  const [assessments,    setAssessments   ] = useState<AssessmentListItem[]>([])
  const [loadingList,    setLoadingList   ] = useState(true)
  const [selectedAsmtId, setSelectedAsmtId] = useState<string>('')
  const [year,           setYear          ] = useState(currentYear - 1)
  const [loading,        setLoading       ] = useState(false)
  const [softErr,        setSoftErr       ] = useState<string | null>(null)
  const [fatalErr,       setFatalErr      ] = useState<string | null>(null)
  const [result,         setResult        ] = useState<BacktestResult | null>(null)
  const abortRef  = useRef<AbortController | null>(null)
  // Önbellek: "assessmentId_year" → BacktestResult
  const cacheRef   = useRef<Map<string, BacktestResult>>(new Map())

  const isDark    = theme === 'dark'
  const gridColor = isDark ? '#292524' : '#f5f5f4'
  const tickColor = isDark ? '#78716c' : '#a8a29e'
  const tipStyle  = { background: isDark ? '#1c1917' : '#fff', border: `1px solid ${isDark ? '#44403c' : '#e7e5e4'}`, borderRadius: 8 }

  const CLASS_LABELS: Record<string, string> = {
    BIST_EQUITY:     language === 'tr' ? 'BIST Hisse'  : 'BIST Equity',
    SP500_EQUITY:    'S&P 500',
    COMMODITY:       language === 'tr' ? 'Emtia'       : 'Commodity',
    CRYPTOCURRENCY:  language === 'tr' ? 'Kripto'      : 'Crypto',
    CASH_EQUIVALENT: language === 'tr' ? 'Nakit'       : 'Cash',
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

  // asOfDate = 30 Haziran — portföy bu tarihteki veriye göre oluşturulur
  const asOfDate = `${year}-06-30`

  // 1. Anket listesi
  useEffect(() => {
    assessmentService.listAll()
      .then((list) => {
        setAssessments(list)
        if (list.length > 0) setSelectedAsmtId(list[0].assessmentId)
        setLoadingList(false)
      })
      .catch(() => setLoadingList(false))
  }, [])

  const selectedAsmt = assessments.find(a => a.assessmentId === selectedAsmtId) ?? null

  // ── Backtest core ──────────────────────────────────────────────────────────
  const runBacktest = useCallback(async () => {
    if (!selectedAsmtId) return

    // Önbellekte varsa anında göster, API çağrısı yapma
    const cacheKey = `${selectedAsmtId}_${year}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setResult(cached)
      setSoftErr(null)
      setFatalErr(null)
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true); setSoftErr(null); setFatalErr(null); setResult(null)

    try {
      // 1. Anket cevaplarını çek
      const answersData = await assessmentService.getAnswers(selectedAsmtId)

      // 2. O tarihe göre portföy simüle et
      const simPortfolio: SimulatedPortfolio = await assessmentService.simulate(
        answersData.answers,
        asOfDate,
      )

      // 3. Varlık listesini düzleştir
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

      // 4. Her varlık için yalnızca H2 fiyat verisi çek
      const holdings: HoldingResult[] = []

      for (const inst of instruments) {
        try {
          const data   = await poolService.getTicker(inst.ticker, '2y')
          const prices: PricePoint[] = (data.history ?? data.prices ?? data.chart ?? []).map(
            (p: { date: string; close: number }) => ({ date: p.date, close: p.close })
          )
          const h2 = sliceH2(prices, year)

          if (h2.length < 2) {
            setSoftErr(`${inst.ticker}: ${language === 'tr' ? 'H2 fiyat verisi yok' : 'no H2 price data'}`)
            continue
          }

          const entryPrice = h2[0].close
          const exitPrice  = h2[h2.length - 1].close
          const h2Return   = (exitPrice - entryPrice) / entryPrice
          const monthly    = monthlyH2Returns(h2)

          holdings.push({
            ticker:       inst.ticker,
            name:         inst.name,
            assetClass:   inst.assetClass,
            weight:       inst.weight,
            entryPrice,
            exitPrice,
            h2Return,
            contribution: inst.weight * h2Return,
            monthlyH2:    monthly,
          })
        } catch {
          setSoftErr(`${inst.ticker}: ${language === 'tr' ? 'veri alınamadı' : 'data unavailable'}`)
        }
      }

      if (holdings.length === 0) {
        setFatalErr(language === 'tr' ? 'Hiçbir varlık için veri alınamadı.' : 'No data available for any asset.')
        setLoading(false); return
      }

      const monthly    = portfolioMonthly(holdings)
      const cumSeries  = toCumulative(monthly)
      const totalH2    = holdings.reduce((s, h) => s + h.contribution, 0)

      const newResult: BacktestResult = {
        simPortfolio,
        year,
        asOfDate,
        holdings,
        totalH2,
        maxDrawdown: calcMaxDrawdown(cumSeries),
        sharpe:      calcSharpe(monthly),
        winRate:     holdings.filter(h => h.h2Return > 0).length / holdings.length,
        cumulativeSeries: cumSeries,
      }
      cacheRef.current.set(cacheKey, newResult)
      setResult(newResult)
    } catch {
      setFatalErr(language === 'tr' ? 'Beklenmeyen bir hata oluştu.' : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [selectedAsmtId, year, language, asOfDate])

  // Chart data
  const cumulChartData = result?.cumulativeSeries.map((v, i) => ({
    month:  H2_MONTHS[i],
    getiri: parseFloat((v * 100).toFixed(2)),
  })) ?? []

  const barData = result?.holdings.map(h => ({
    ticker: h.ticker,
    getiri: parseFloat((h.h2Return * 100).toFixed(2)),
  })) ?? []

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loadingList) {
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

  if (assessments.length === 0) {
    return (
      <AppLayout>
        <EmptyState
          title={t('backtest.noAssessments')}
          description={t('backtest.noAssessmentsDesc')}
          action={<Button onClick={() => navigate('/questionnaire')}>{t('backtest.goToQuest')}</Button>}
        />
      </AppLayout>
    )
  }

  const profileLabel    = selectedAsmt ? (PROFILE_LABELS[selectedAsmt.profileType] ?? selectedAsmt.profileType) : ''
  const horizonLabel    = selectedAsmt ? (HORIZON_LABELS[selectedAsmt.investmentHorizon] ?? selectedAsmt.investmentHorizon) : ''
  const simProfileLabel = result ? (PROFILE_LABELS[result.simPortfolio.profileType] ?? result.simPortfolio.profileType) : ''

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-medium text-stone-900 dark:text-stone-100">
              {t('backtest.title')}
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {t('backtest.simulationInfo')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Anket seçici */}
            <select
              value={selectedAsmtId}
              onChange={e => { setSelectedAsmtId(e.target.value); setResult(null) }}
              className="text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
            >
              {assessments.map(a => (
                <option key={a.assessmentId} value={a.assessmentId}>
                  {PROFILE_LABELS[a.profileType] ?? a.profileType}
                  {' · '}
                  {HORIZON_LABELS[a.investmentHorizon] ?? a.investmentHorizon}
                  {' · '}
                  {new Date(a.completedAt).toLocaleDateString(
                    language === 'tr' ? 'tr-TR' : 'en-GB',
                    { day: '2-digit', month: 'short', year: 'numeric' },
                  )}
                </option>
              ))}
            </select>

            {/* H2 badge */}
            <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 text-xs">
              <span className="px-3 py-2 bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 font-medium">
                {language === 'tr' ? 'Portföy kuruluşu' : 'Portfolio built'}: {asOfDate}
              </span>
              <span className="px-2 py-2 bg-stone-100 dark:bg-stone-800 text-stone-400">→</span>
              <span className="px-3 py-2 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-medium">
                {t('backtest.julDec')} {year}
              </span>
            </div>

            {/* Yıl seçici */}
            <select
              value={year}
              onChange={e => { setYear(parseInt(e.target.value)); setResult(null) }}
              className="text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={runBacktest}
              disabled={loading || !selectedAsmtId}
              className="btn-primary text-sm !px-5 !py-2 !rounded-xl"
            >
              {loading ? <Spinner size="sm" /> : t('backtest.calculate')}
            </button>
          </div>
        </div>

        {/* ── Seçilen anket kartı ── */}
        {selectedAsmt && (
          <div className={`rounded-2xl border p-5 space-y-2 ${
            selectedAsmt.profileType === 'conservative'
              ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
              : selectedAsmt.profileType === 'balanced'
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                : 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20'
          }`}>
            <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest">
              {t('backtest.selectAssessment')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-medium text-stone-900 dark:text-stone-100">
                {profileLabel} {t('backtest.profile')}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                {horizonLabel}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-500">
                · {new Date(selectedAsmt.completedAt).toLocaleDateString(
                  language === 'tr' ? 'tr-TR' : 'en-GB',
                  { day: '2-digit', month: 'long', year: 'numeric' },
                )}
              </span>
            </div>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {t('backtest.asOfDate')}: <span className="font-mono font-medium text-stone-600 dark:text-stone-300">{asOfDate}</span>
              {' '}
              <span className="opacity-60">
                {language === 'tr'
                  ? '— bu tarihte mevcut piyasa verisiyle portföy inşa edilir, Tem–Ara performansı ölçülür'
                  : '— portfolio built with data available at this date, then Jul–Dec performance measured'}
              </span>
            </p>
          </div>
        )}

        {/* ── Yükleniyor ── */}
        {loading && (
          <div className="card flex flex-col items-center gap-3 py-10 justify-center text-stone-500 dark:text-stone-400">
            <Spinner size="md" />
            <span className="text-sm">{t('backtest.simulating')}</span>
            <span className="text-xs opacity-60">
              {language === 'tr'
                ? `${year} H2 yfinance verisi çekiliyor…`
                : `Fetching ${year} H2 yfinance data…`}
            </span>
          </div>
        )}

        {/* ── Uyarılar ── */}
        {softErr && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">⚠ {softErr}</p>
          </div>
        )}
        {fatalErr && !loading && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">⚠ {fatalErr}</p>
          </div>
        )}

        {/* ── Sonuçlar ── */}
        {result && !loading && (
          <>
            {/* Simüle portföy kartı */}
            <div className={`rounded-2xl border p-5 space-y-3 ${
              result.simPortfolio.profileType === 'conservative'
                ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                : result.simPortfolio.profileType === 'balanced'
                  ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                  : 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20'
            }`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                    {t('backtest.simulatedPortfolio')} · {result.asOfDate}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-medium text-stone-900 dark:text-stone-100">
                      {simProfileLabel} {t('backtest.profile')}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                      {HORIZON_LABELS[result.simPortfolio.horizonType] ?? result.simPortfolio.horizonType}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      · {result.holdings.length} {t('backtest.assets')}
                    </span>
                  </div>
                  {result.simPortfolio.explanation && (
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 max-w-xl leading-relaxed">
                      {result.simPortfolio.explanation.slice(0, 160)}
                      {result.simPortfolio.explanation.length > 160 ? '…' : ''}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-stone-400 dark:text-stone-500 space-y-0.5">
                  <p>{t('backtest.expectedReturn')} <span className="font-medium text-stone-700 dark:text-stone-300">
                    {result.simPortfolio.expectedReturn >= 0 ? '+' : ''}{result.simPortfolio.expectedReturn.toFixed(1)}%
                  </span></p>
                  <p>{t('backtest.volatility')} <span className="font-medium text-stone-700 dark:text-stone-300">
                    {result.simPortfolio.expectedVolatility.toFixed(1)}%
                  </span></p>
                  <p>{t('backtest.score')} <span className="font-medium text-stone-700 dark:text-stone-300">
                    {result.simPortfolio.portfolioScore.toFixed(1)}
                  </span></p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.simPortfolio.allocations
                  .filter(a => a.targetWeight > 0)
                  .sort((a, b) => b.targetWeight - a.targetWeight)
                  .map(a => (
                    <span
                      key={a.assetClass}
                      className="text-xs px-2.5 py-1 rounded-full border font-medium"
                      style={{
                        color:       CLASS_COLORS[a.assetClass] ?? '#888',
                        borderColor: `${CLASS_COLORS[a.assetClass] ?? '#888'}40`,
                        background:  `${CLASS_COLORS[a.assetClass] ?? '#888'}15`,
                      }}
                    >
                      {CLASS_LABELS[a.assetClass] ?? a.assetClass} {a.targetWeight}%
                    </span>
                  ))}
              </div>
            </div>

            {/* Stat cards — H2 odaklı, H1 YOK */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label={`${t('backtest.h2Return')} (${result.year})`}
                value={fmtPct(result.totalH2)}
                sub={language === 'tr' ? `Tem–Ara ${result.year} gerçek getiri` : `Jul–Dec ${result.year} actual return`}
                positive={result.totalH2 >= 0}
              />
              <StatCard
                label={language === 'tr' ? 'Beklenen vs Gerçek' : 'Expected vs Actual'}
                value={fmtPct(result.totalH2 - result.simPortfolio.expectedReturn / 100)}
                sub={language === 'tr'
                  ? `Beklenen: ${result.simPortfolio.expectedReturn >= 0 ? '+' : ''}${result.simPortfolio.expectedReturn.toFixed(1)}%`
                  : `Expected: ${result.simPortfolio.expectedReturn >= 0 ? '+' : ''}${result.simPortfolio.expectedReturn.toFixed(1)}%`}
                positive={(result.totalH2 - result.simPortfolio.expectedReturn / 100) >= 0}
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
              {/* Kümülatif getiri */}
              <div className="card">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                  {t('backtest.cumReturn')} · {t('backtest.julDec')} {result.year}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cumulChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      axisLine={false} tickLine={false}
                    />
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

              {/* Varlık bazında H2 getirisi */}
              <div className="card">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                  {language === 'tr' ? `Varlık Bazlı Getiri · Tem–Ara ${result.year}` : `Asset Returns · Jul–Dec ${result.year}`}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="ticker" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => `${v}%`}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tipStyle}
                      formatter={(v: number) => [
                        `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
                        language === 'tr' ? 'H2 Getiri' : 'H2 Return',
                      ]}
                    />
                    <ReferenceLine y={0} stroke={isDark ? '#57534e' : '#d6d3d1'} />
                    <Bar dataKey="getiri" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.getiri >= 0 ? '#639922' : '#E24B4A'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3 text-xs text-stone-400 dark:text-stone-500">
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

            {/* Varlık tablosu — H1 kolonları YOK */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                  {t('backtest.assetDetail')}
                </h3>
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  yfinance · {result.year} H2 · {result.holdings.length} {t('backtest.assets')}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wider border-b border-stone-200 dark:border-stone-700">
                      <th className="text-left pb-3 pr-4">{t('backtest.assetCol')}</th>
                      <th className="text-left pb-3 pr-4">{t('backtest.classCol')}</th>
                      <th className="text-right pb-3 pr-4">{t('backtest.weightCol')}</th>
                      <th className="text-right pb-3 pr-4">
                        {language === 'tr' ? 'Giriş Fiyatı (1 Tem)' : 'Entry Price (1 Jul)'}
                      </th>
                      <th className="text-right pb-3 pr-4">
                        {language === 'tr' ? 'Çıkış Fiyatı (31 Ara)' : 'Exit Price (31 Dec)'}
                      </th>
                      <th className="text-right pb-3 pr-4">{t('backtest.h2ReturnCol')}</th>
                      <th className="text-right pb-3">{t('backtest.contribution')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {[...result.holdings]
                      .sort((a, b) => b.h2Return - a.h2Return)
                      .map(h => {
                        const clr = CLASS_COLORS[h.assetClass] ?? '#888'
                        return (
                          <tr key={h.ticker} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-stone-900 dark:text-stone-100 font-mono text-xs">{h.ticker}</p>
                              {h.name !== h.ticker && (
                                <p className="text-xs text-stone-400 dark:text-stone-500 truncate max-w-[140px]">{h.name}</p>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full border font-medium"
                                style={{ color: clr, borderColor: `${clr}40`, background: `${clr}15` }}
                              >
                                {CLASS_LABELS[h.assetClass] ?? h.assetClass}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right text-stone-700 dark:text-stone-300 font-medium text-xs">
                              {(h.weight * 100).toFixed(1)}%
                            </td>
                            <td className="py-3 pr-4 text-right text-stone-400 dark:text-stone-500 font-mono text-xs">
                              {h.entryPrice.toFixed(2)}
                            </td>
                            <td className="py-3 pr-4 text-right text-stone-400 dark:text-stone-500 font-mono text-xs">
                              {h.exitPrice.toFixed(2)}
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
                    .replace('{profile}', simProfileLabel)
                    .replace('{year}', String(result.year))}
                </p>
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                  {result.totalH2 >= 0.08
                    ? (language === 'tr'
                        ? `${asOfDate} tarihinde kurulan portföy H2 ${result.year}'de ${fmtPct(result.totalH2)} getiri sağladı — beklenen getiri (${result.simPortfolio.expectedReturn.toFixed(1)}%) ile karşılaştırıldığında güçlü bir sonuç.`
                        : `Portfolio built on ${asOfDate} returned ${fmtPct(result.totalH2)} in H2 ${result.year} — strong result vs expected ${result.simPortfolio.expectedReturn.toFixed(1)}%.`)
                    : result.totalH2 >= 0
                      ? (language === 'tr'
                          ? `${asOfDate} tarihinde kurulan portföy H2 ${result.year}'de ${fmtPct(result.totalH2)} getiri sağladı — pozitif ama mütevazı bir sonuç.`
                          : `Portfolio built on ${asOfDate} returned ${fmtPct(result.totalH2)} in H2 ${result.year} — positive but modest.`)
                      : (language === 'tr'
                          ? `${asOfDate} tarihinde kurulan portföy H2 ${result.year}'de ${fmtPct(result.totalH2)} getiri sağladı — dönem zorlu geçti.`
                          : `Portfolio built on ${asOfDate} returned ${fmtPct(result.totalH2)} in H2 ${result.year} — a difficult period.`)}
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
