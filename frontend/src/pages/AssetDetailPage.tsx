import { useParams, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Spinner, StalenessWarning } from '@/components/ui/index'
import { useApi } from '@/hooks/useApi'
import { instrumentService } from '@/services'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useState } from 'react'

const RANGES = ['1M', '3M', '1Y'] as const
type Range = typeof RANGES[number]

export default function AssetDetailPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('3M')

  const { data, isLoading, isStale } = useApi(
    () => instrumentService.getDetail(ticker!)
  )

  if (isLoading) return (
    <AppLayout>
      <div className="flex justify-center py-24"><Spinner size="lg" /></div>
    </AppLayout>
  )

  if (!data) return (
    <AppLayout>
      <div className="max-w-lg mx-auto text-center py-24 space-y-4">
        <p className="text-stone-500">Varlık bulunamadı: {ticker}</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>← Geri</Button>
      </div>
    </AppLayout>
  )

  const chartData = data.priceHistory?.slice(
    range === '1M' ? -30 : range === '3M' ? -90 : -365
  ).map((p) => ({ date: p.date, fiyat: p.close })) ?? []

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {isStale && <StalenessWarning />}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <button onClick={() => navigate(-1)} className="text-sm text-stone-400 hover:text-stone-900 mb-2 transition-colors">
              ← Dashboard
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-medium text-stone-900">{data.ticker}</h1>
              <span className="text-xs px-2 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-500">
                {data.assetClass.replace('_', ' ')}
              </span>
              {data.isStale && <StalenessWarning />}
            </div>
            <p className="text-stone-500 text-sm mt-1">{data.name} · {data.exchange}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono font-medium text-stone-900">
              {data.currentPrice?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Price chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest">Fiyat Geçmişi</h3>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${range === r ? 'bg-stone-900 text-white font-medium' : 'text-stone-400 hover:text-stone-900 hover:bg-stone-50'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e7e5e4', borderRadius: 8 }}
                formatter={(v: number) => [v.toFixed(2), 'Fiyat']} />
              <Line type="monotone" dataKey="fiyat" stroke="#D4A853" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Factor scores + metrics */}
        <div className="grid md:grid-cols-2 gap-6">
          {data.factorScore && (
            <div className="card space-y-3">
              <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest">Faktör Skorları</h3>
              {[
                { label: 'Momentum', value: data.factorScore.momentum },
                { label: 'Değer (P/B)', value: data.factorScore.value },
                { label: 'Kalite (ROE)', value: data.factorScore.quality },
                { label: 'Düşük Volatilite', value: data.factorScore.volatility },
                { label: 'Kompozit', value: data.factorScore.composite },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">{label}</span>
                    <span className="text-stone-900 font-mono">{value} / 100</span>
                  </div>
                  <div className="h-1 bg-stone-50 rounded-full">
                    <div className="h-full bg-stone-900 rounded-full" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.metrics && (
            <div className="card">
              <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-3">Temel Metrikler</h3>
              <div className="grid grid-cols-2 gap-y-3">
                {[
                  { label: 'F/K Oranı', value: data.metrics.peRatio?.toFixed(1) },
                  { label: 'P/B Oranı', value: data.metrics.pbRatio?.toFixed(2) },
                  { label: 'ROE', value: data.metrics.roe ? `%${data.metrics.roe.toFixed(1)}` : undefined },
                  { label: '52H Yüksek', value: data.metrics.week52High?.toFixed(2) },
                  { label: '52H Düşük', value: data.metrics.week52Low?.toFixed(2) },
                  { label: '1A Getiri', value: data.metrics.momentum1M ? `%${data.metrics.momentum1M.toFixed(1)}` : undefined },
                ].filter((m) => m.value).map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-stone-400">{label}</p>
                    <p className="text-sm font-medium text-stone-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {data.whySelected && data.whySelected.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-3">Neden Seçildi?</h3>
            <ul className="space-y-2">
              {data.whySelected.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-stone-500">
                  <span className="text-green-400 mt-0.5">✓</span> {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
