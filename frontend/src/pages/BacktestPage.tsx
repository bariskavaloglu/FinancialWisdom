/**
 * BacktestPage — Portföy Validasyonu
 *
 * Akış:
 *  1. Kullanıcının aktif portföyü portfolioService.getLatest() ile çekilir.
 *  2. Portföydeki her ticker ve ağırlık otomatik alınır — profil dropdown'u yoktur.
 *  3. Kullanıcı sadece hangi YIL için backtest istediğini seçer.
 *  4. Her ticker için poolService.getTicker(ticker, '2y') ile gerçek yfinance fiyatı çekilir.
 *  5. H1 (Oca–Haz): portföy analiz/oluşturma dönemi.
 *     H2 (Tem–Ara): gerçek performans validasyonu.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner, Disclaimer, EmptyState } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { portfolioService, poolService } from '@/services'
import type { Portfolio } from '@/types'
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
  portfolio:        Portfolio
  year:             number
  holdings:         HoldingResult[]
  totalH2:          number
  totalH1:          number
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

const CLASS_LABELS: Record<string, string> = {
  BIST_EQUITY:     'BIST Hisse',
  SP500_EQUITY:    'S&P 500',
  COMMODITY:       'Emtia',
  CRYPTOCURRENCY:  'Kripto',
  CASH_EQUIVALENT: 'Nakit',
}

const PROFILE_LABELS: Record<string, string> = {
  conservative: 'Muhafazakâr',
  balanced:     'Dengeli',
  aggressive:   'Agresif',
}

const HORIZON_LABELS: Record<string, string> = {
  short:  'Kısa Vade',
  medium: 'Orta Vade',
  long:   'Uzun Vade',
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const navigate    = useNavigate()
  const { theme }   = useThemeLang()
  const currentYear = new Date().getFullYear()

  const [portfolio,        setPortfolio       ] = useState<Portfolio | null>(null)
  const [loadingPortfolio, setLoadingPortfolio] = useState(true)
  const [portfolioError,   setPortfolioError  ] = useState<string | null>(null)

  const [year,    setYear   ] = useState(currentYear - 1)
  const [loading, setLoading] = useState(false)
  const [softErr, setSoftErr] = useState<string | null>(null)
  const [fatalErr,setFatalErr] = useState<string | null>(null)
  const [result,  setResult ] = useState<BacktestResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const availableYears = [currentYear - 1, currentYear - 2, currentYear - 3].filter(
    (y) => y >= 2022,
  )

  // 1. Kullanıcının portföyünü yükle
  useEffect(() => {
    portfolioService.getLatest()
      .then((p) => { setPortfolio(p); setLoadingPortfolio(false) })
      .catch(() => { setPortfolioError('Portföy yüklenemedi.'); setLoadingPortfolio(false) })
  }, [])

  // 2. Backtest hesapla
  const runBacktest = useCallback(async () => {
    if (!portfolio) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setSoftErr(null)
    setFatalErr(null)
    setResult(null)

    try {
      // Portföydeki ticker + ağırlık çiftleri
      const tickerWeights: Array<{
        ticker: string; name: string; assetClass: string; weight: number
      }> = []

      for (const alloc of portfolio.allocations) {
        const instruments = alloc.instruments ?? []
        if (!instruments.length) continue
        const perInst = (alloc.targetWeight / 100) / instruments.length
        for (const inst of instruments) {
          tickerWeights.push({
            ticker:     inst.ticker,
            name:       inst.name ?? inst.ticker,
            assetClass: (inst.assetClass ?? alloc.assetClass) as string,
            weight:     perInst,
          })
        }
      }

      if (!tickerWeights.length) {
        setFatalErr('Portföyde varlık bulunamadı.')
        return
      }

      const holdings: HoldingResult[] = []
      let fetchFailed = 0

      for (const tw of tickerWeights) {
        try {
          const data = await poolService.getTicker(tw.ticker, '2y')

          // pool endpoint "history" key ile döndürüyor (pool.py kontrol edildi)
          const rawHistory: Array<{ date: string; close?: number; Close?: number }> =
            data.history ?? data.priceHistory ?? []

          const prices: PricePoint[] = rawHistory
            .filter((p) => p.date && (p.close ?? p.Close ?? 0) > 0)
            .map((p) => ({ date: p.date, close: p.close ?? p.Close ?? 0 }))
            .sort((a, b) => a.date.localeCompare(b.date))

          const { h1, h2 } = splitHalves(prices, year)
          if (h1.length < 5 || h2.length < 5) { fetchFailed++; continue }

          const priceH1Start = h1[0].close
          const priceH1End   = h1[h1.length - 1].close
          const priceH2End   = h2[h2.length - 1].close
          const h1Return     = (priceH1End - priceH1Start) / priceH1Start
          const h2Return     = (priceH2End - priceH1End)   / priceH1End
          const monthlyH2Arr = monthlyH2Returns(h2)

          holdings.push({
            ticker: tw.ticker, name: tw.name,
            assetClass: tw.assetClass, weight: tw.weight,
            priceH1Start, priceH1End, priceH2End,
            h1Return, h2Return,
            contribution: tw.weight * h2Return,
            monthlyH2: monthlyH2Arr,
          })
        } catch {
          fetchFailed++
        }
      }

      if (!holdings.length) {
        setFatalErr(
          `${year} için hiçbir varlıktan veri alınamadı. ` +
          'yfinance önbelleği boş olabilir — lütfen Market Havuzu sayfasından yenileyin.',
        )
        return
      }

      if (fetchFailed > 0) {
        setSoftErr(
          `${fetchFailed} varlık için ${year} verisi bulunamadı ve hesaba dahil edilmedi.`,
        )
      }

      const monthlyPort   = portfolioMonthly(holdings)
      const cumulSeries   = toCumulative(monthlyPort)
      const totalH2       = holdings.reduce((s, h) => s + h.contribution, 0)
      const totalH1       = holdings.reduce((s, h) => s + h.weight * h.h1Return, 0)
      const winRate       = holdings.filter((h) => h.h2Return > 0).length / holdings.length

      setResult({
        portfolio, year, holdings,
        totalH2, totalH1, winRate,
        maxDrawdown:      calcMaxDrawdown(cumulSeries),
        sharpe:           calcSharpe(monthlyPort),
        cumulativeSeries: cumulSeries,
      })
    } catch (err: unknown) {
      setFatalErr(`Backtest hatası: ${(err as Error).message ?? 'Bilinmeyen hata'}`)
    } finally {
      setLoading(false)
    }
  }, [portfolio, year])

  // Portföy yüklenince otomatik çalıştır
  useEffect(() => {
    if (portfolio) runBacktest()
  }, [portfolio, runBacktest])

  // Chart renkleri
  const isDark     = theme === 'dark'
  const gridColor  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
  const tickColor  = isDark ? '#a8a29e' : '#78716c'
  const tipStyle   = {
    background: isDark ? '#1c1917' : '#fff',
    border:     isDark ? '1px solid #44403c' : '1px solid #e7e5e4',
    borderRadius: 8,
  }

  const monthLabels = ['Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'].map((m) => `${m} ${year}`)

  const cumulChartData = result?.cumulativeSeries.map((v, i) => ({
    month:  monthLabels[i],
    getiri: parseFloat((v * 100).toFixed(2)),
  })) ?? []

  const barData = result
    ? [...result.holdings]
        .sort((a, b) => b.h2Return - a.h2Return)
        .map((h) => ({
          ticker: h.ticker.replace('.IS', '').replace('-USD', ''),
          h1: parseFloat((h.h1Return * 100).toFixed(2)),
          h2: parseFloat((h.h2Return * 100).toFixed(2)),
        }))
    : []

  // ── Portföy yüklenirken ──────────────────────────────────────────────────────
  if (loadingPortfolio) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-stone-500 dark:text-stone-400 text-sm">Portföy yükleniyor…</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ── Portföy bulunamadı ───────────────────────────────────────────────────────
  if (portfolioError || !portfolio) {
    return (
      <AppLayout>
        <EmptyState
          title="Portföy bulunamadı"
          description="Validasyon için önce risk anketini doldurmanız gerekiyor. Anket sonucunda oluşturulan portföy otomatik olarak buraya yüklenir."
          action={<Button onClick={() => navigate('/questionnaire')}>Ankete git →</Button>}
        />
      </AppLayout>
    )
  }

  const totalInstruments = portfolio.allocations.reduce(
    (s, a) => s + (a.instruments?.length ?? 0), 0,
  )
  const profileLabel = PROFILE_LABELS[portfolio.profileType] ?? portfolio.profileType
  const horizonLabel = HORIZON_LABELS[portfolio.horizonType] ?? portfolio.horizonType

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-medium text-stone-900 dark:text-stone-100">
              Portföy Validasyonu
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Gerçek yfinance verisi · İlk 6 ay analiz penceresi → Son 6 ay gerçek performans
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 text-xs">
              <span className="px-3 py-2 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium">
                Oca–Haz {year} analiz
              </span>
              <span className="px-2 py-2 bg-stone-100 dark:bg-stone-800 text-stone-400">→</span>
              <span className="px-3 py-2 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-medium">
                Tem–Ara {year} validasyon
              </span>
            </div>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={runBacktest}
              disabled={loading}
              className="btn-primary text-sm !px-5 !py-2 !rounded-xl"
            >
              {loading ? <Spinner size="sm" /> : 'Hesapla'}
            </button>
          </div>
        </div>

        {/* ── Portföy kimlik kartı ── */}
        <div className={`rounded-2xl border p-5 space-y-3 ${
          portfolio.profileType === 'conservative'
            ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
            : portfolio.profileType === 'balanced'
              ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
              : 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20'
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                Portföyünüz
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-medium text-stone-900 dark:text-stone-100">
                  {profileLabel} profil
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                  {horizonLabel}
                </span>
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  · {totalInstruments} varlık
                </span>
              </div>
              {portfolio.explanation && (
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 max-w-xl leading-relaxed">
                  {portfolio.explanation.slice(0, 160)}{portfolio.explanation.length > 160 ? '…' : ''}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-stone-400 dark:text-stone-500 space-y-0.5">
              <p>Beklenen getiri: <span className="font-medium text-stone-700 dark:text-stone-300">
                {portfolio.expectedReturn >= 0 ? '+' : ''}{portfolio.expectedReturn.toFixed(1)}%
              </span></p>
              <p>Volatilite: <span className="font-medium text-stone-700 dark:text-stone-300">
                {portfolio.expectedVolatility.toFixed(1)}%
              </span></p>
              <p>Portföy skoru: <span className="font-medium text-stone-700 dark:text-stone-300">
                {portfolio.portfolioScore.toFixed(1)}
              </span></p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {portfolio.allocations
              .filter((a) => a.targetWeight > 0)
              .sort((a, b) => b.targetWeight - a.targetWeight)
              .map((a) => (
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

        {/* ── Yükleniyor ── */}
        {loading && (
          <div className="card flex items-center gap-3 py-8 justify-center text-stone-500 dark:text-stone-400">
            <Spinner size="md" />
            <span className="text-sm">
              {year} yfinance verisi çekiliyor ({totalInstruments} varlık)…
            </span>
          </div>
        )}

        {/* ── Soft hata ── */}
        {softErr && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">⚠ {softErr}</p>
          </div>
        )}

        {/* ── Fatal hata ── */}
        {fatalErr && !loading && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">⚠ {fatalErr}</p>
          </div>
        )}

        {/* ── Sonuçlar ── */}
        {result && !loading && (
          <>
            {/* Stat kartları */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label={`H2 getirisi (${result.year})`}
                value={fmtPct(result.totalH2)}
                sub="Tem–Ara gerçek fiyatlar"
                positive={result.totalH2 >= 0}
              />
              <StatCard
                label={`H1 sinyali (${result.year})`}
                value={fmtPct(result.totalH1)}
                sub="Oca–Haz analiz dönemi"
                positive={result.totalH1 >= 0}
              />
              <StatCard
                label="Kazanan varlıklar"
                value={`${Math.round(result.winRate * 100)}%`}
                sub={`${result.holdings.filter((h) => h.h2Return > 0).length} / ${result.holdings.length} varlık`}
                positive={result.winRate >= 0.5}
              />
              <StatCard
                label="Sharpe (yaklaşık)"
                value={result.sharpe.toFixed(2)}
                sub={`Max düşüş: ${fmtPct(-result.maxDrawdown)}`}
                positive={result.sharpe >= 0.5}
              />
            </div>

            {/* Grafikler */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Kümülatif getiri */}
              <div className="card">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                  Kümülatif getiri · Tem–Ara {year}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cumulChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} contentStyle={tipStyle} />
                    <ReferenceLine y={0} stroke={isDark ? '#57534e' : '#d6d3d1'} strokeDasharray="4 4" />
                    <Line
                      type="monotone" dataKey="getiri" name="Portföy"
                      stroke={result.totalH2 >= 0 ? '#639922' : '#E24B4A'}
                      strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* H1 sinyal vs H2 gerçek */}
              <div className="card">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                  H1 sinyal → H2 gerçek getiri
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={12} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="ticker" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tipStyle}
                      formatter={(v: number, name: string) => [
                        `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
                        name === 'h1' ? 'H1 analiz' : 'H2 gerçek',
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
                    H1 analiz dönemi
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-green-600" />
                    H2 pozitif
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    H2 negatif
                  </span>
                </div>
              </div>
            </div>

            {/* Varlık tablosu */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                  Varlık bazlı detay
                </h3>
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  yfinance · {year} · {result.holdings.length} varlık
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wider border-b border-stone-200 dark:border-stone-700">
                      <th className="text-left pb-3 pr-4">Varlık</th>
                      <th className="text-left pb-3 pr-4">Sınıf</th>
                      <th className="text-right pb-3 pr-4">Ağırlık</th>
                      <th className="text-right pb-3 pr-4">H1 başlangıç fiyat</th>
                      <th className="text-right pb-3 pr-4">H1 getiri</th>
                      <th className="text-right pb-3 pr-4">H2 getiri</th>
                      <th className="text-right pb-3">Portföye katkı</th>
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
                              <p className="font-medium text-stone-900 dark:text-stone-100 font-mono text-xs">{h.ticker}</p>
                              {h.name !== h.ticker && (
                                <p className="text-xs text-stone-400 dark:text-stone-500 truncate max-w-[140px]">{h.name}</p>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full border font-medium"
                                style={{ color: clrCls, borderColor: `${clrCls}40`, background: `${clrCls}15` }}
                              >
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
                        Toplam portföy H2 getirisi
                      </td>
                      <td className={`pt-3 text-right font-bold text-base ${result.totalH2 >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmtPct(result.totalH2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Validasyon kararı */}
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
                  Validasyon sonucu — {profileLabel} portföy, {result.year}
                </p>
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                  {result.totalH2 >= 0.08
                    ? `Portföyünüz ${result.year} H2'de gerçek fiyatlarla ${fmtPct(result.totalH2)} getiri sağladı. ` +
                      `H1 analiz sinyali (${fmtPct(result.totalH1)}) ile tutarlı — model başarıyla doğrulandı.`
                    : result.totalH2 >= 0
                      ? `Portföyünüz ${result.year} H2'de ${fmtPct(result.totalH2)} pozitif getiri sağladı. ` +
                        `Hedef eşiğin (%8) altında kaldı. H1 sinyali: ${fmtPct(result.totalH1)}.`
                      : `Portföyünüz ${result.year} H2'de ${fmtPct(result.totalH2)} negatif getiri yaşadı. ` +
                        `H1 sinyali (${fmtPct(result.totalH1)}) yeterli koruma sağlayamadı. ` +
                        'Profil ağırlıkları veya risk toleransı gözden geçirilebilir.'}
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
