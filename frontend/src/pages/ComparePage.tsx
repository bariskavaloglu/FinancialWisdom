import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Disclaimer, Spinner, Alert } from '@/components/ui/index'
import { useApi } from '@/hooks/useApi'
import { portfolioService } from '@/services'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { Portfolio } from '@/types'

const ASSET_LABELS: Record<string, string> = {
  BIST_EQUITY: 'BIST', SP500_EQUITY: 'S&P500',
  COMMODITY: 'Emtia', CRYPTOCURRENCY: 'Kripto', CASH_EQUIVALENT: 'Nakit',
}

function PortfolioCard({ portfolio, label }: { portfolio: Portfolio; label: string }) {
  return (
    <div className="card space-y-3">
      <p className="text-xs text-stone-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-stone-900 capitalize">{portfolio.profileType}</span>
        <span className="text-stone-300">·</span>
        <span className="text-sm text-stone-500 capitalize">{portfolio.horizonType} vade</span>
      </div>
      <div className="space-y-2 pt-1">
        {portfolio.allocations.map((a) => (
          <div key={a.assetClass} className="flex items-center justify-between text-sm">
            <span className="text-stone-500">{ASSET_LABELS[a.assetClass] ?? a.assetClass}</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-stone-50 rounded-full">
                <div className="h-full bg-stone-900 rounded-full" style={{ width: `${a.targetWeight}%` }} />
              </div>
              <span className="text-stone-900 font-mono text-xs w-8 text-right">%{a.targetWeight}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-stone-200 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-stone-400">Portföy Skoru</p>
          <p className="text-stone-900 font-medium">{portfolio.portfolioScore?.toFixed(1) ?? '—'}</p>
        </div>
        <div>
          <p className="text-stone-400">Volatilite</p>
          <p className="text-stone-900 font-medium">%{portfolio.expectedVolatility?.toFixed(1) ?? '—'}</p>
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  const [selectedA, setSelectedA] = useState<string>('')
  const [selectedB, setSelectedB] = useState<string>('')
  const [compared, setCompared] = useState<[Portfolio, Portfolio] | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  const { data: portfolios, isLoading } = useApi(() => portfolioService.list())

  const handleCompare = async () => {
    if (!selectedA || !selectedB || selectedA === selectedB) return
    setComparing(true)
    setCompareError(null)
    try {
      const [a, b] = await Promise.all([
        portfolioService.getById(selectedA),
        portfolioService.getById(selectedB),
      ])
      setCompared([a, b])
    } catch {
      setCompareError('Karşılaştırma yüklenemedi.')
    } finally {
      setComparing(false)
    }
  }

  const radarData = compared
    ? ['BIST_EQUITY', 'SP500_EQUITY', 'COMMODITY', 'CRYPTOCURRENCY', 'CASH_EQUIVALENT'].map((cls) => ({
        subject: ASSET_LABELS[cls],
        A: compared[0].allocations.find((a) => a.assetClass === cls)?.targetWeight ?? 0,
        B: compared[1].allocations.find((a) => a.assetClass === cls)?.targetWeight ?? 0,
      }))
    : []

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900 mb-1">Senaryo Karşılaştırma</h1>
          <p className="text-stone-500 text-sm">İki portföyü yan yana karşılaştırın</p>
        </div>

        {/* Selector */}
        <div className="card space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : !portfolios?.length ? (
            <p className="text-stone-500 text-sm text-center py-4">Henüz portföy yok.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Senaryo A', value: selectedA, set: setSelectedA },
                { label: 'Senaryo B', value: selectedB, set: setSelectedB },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="label">{label}</label>
                  <select
                    className="input"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  >
                    <option value="">Portföy seçin…</option>
                    {portfolios.map((p) => (
                      <option key={p.portfolioId} value={p.portfolioId}>
                        {p.profileType} / {p.horizonType} · {new Date(p.generatedAt).toLocaleDateString('tr-TR')}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {compareError && <Alert variant="error">{compareError}</Alert>}

          <Button
            onClick={handleCompare}
            isLoading={comparing}
            disabled={!selectedA || !selectedB || selectedA === selectedB}
            className="w-full sm:w-auto"
          >
            Karşılaştır →
          </Button>
        </div>

        {/* Results */}
        {compared && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid md:grid-cols-2 gap-6">
              <PortfolioCard portfolio={compared[0]} label="Senaryo A" />
              <PortfolioCard portfolio={compared[1]} label="Senaryo B" />
            </div>

            {/* Radar chart */}
            <div className="card">
              <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">Dağılım Karşılaştırması</h3>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#78716c', fontSize: 12 }} />
                  <Radar name="Senaryo A" dataKey="A" stroke="#D4A853" fill="#D4A853" fillOpacity={0.2} />
                  <Radar name="Senaryo B" dataKey="B" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e7e5e4', borderRadius: 8 }}
                    formatter={(v: number) => [`%${v}`, '']} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2 text-xs text-stone-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-stone-900 inline-block" /> Senaryo A</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> Senaryo B</span>
              </div>
            </div>

            {/* Diff table */}
            <div className="card overflow-x-auto">
              <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">Fark Tablosu</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-stone-400 border-b border-stone-200">
                    <th className="text-left pb-2">Metrik</th>
                    <th className="text-right pb-2">Senaryo A</th>
                    <th className="text-right pb-2">Senaryo B</th>
                    <th className="text-right pb-2">Fark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {[
                    { label: 'Portföy Skoru', a: compared[0].portfolioScore, b: compared[1].portfolioScore, fmt: (v: number) => v.toFixed(1) },
                    { label: 'Beklenen Volatilite', a: compared[0].expectedVolatility, b: compared[1].expectedVolatility, fmt: (v: number) => `%${v.toFixed(1)}` },
                  ].map(({ label, a, b, fmt }) => {
                    if (a == null || b == null) return null
                    const diff = b - a
                    return (
                      <tr key={label}>
                        <td className="py-2.5 text-stone-500">{label}</td>
                        <td className="py-2.5 text-right text-stone-900">{fmt(a)}</td>
                        <td className="py-2.5 text-right text-stone-900">{fmt(b)}</td>
                        <td className={`py-2.5 text-right font-medium ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-stone-400'}`}>
                          {diff > 0 ? '+' : ''}{fmt(diff)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Disclaimer />
      </div>
    </AppLayout>
  )
}
