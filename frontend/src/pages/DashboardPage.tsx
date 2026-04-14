import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { ProfileBadge, HorizonBadge, StalenessWarning, Disclaimer, EmptyState, Spinner } from '@/components/ui/index'
import { useApi } from '@/hooks/useApi'
import { portfolioService } from '@/services'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { AssetClass, Portfolio } from '@/types'

// ─── Asset class display config ───────────────────────────────────────────────

const ASSET_CONFIG: Record<AssetClass, { label: string; color: string }> = {
  BIST_EQUITY:    { label: 'BIST Hisseleri',    color: '#1c1917' },
  SP500_EQUITY:   { label: 'S&P 500 ETF',        color: '#3B82F6' },
  COMMODITY:      { label: 'Emtialar',            color: '#22C55E' },
  CRYPTOCURRENCY: { label: 'Kripto Para',         color: '#A78BFA' },
  CASH_EQUIVALENT:{ label: 'Nakit / Para Piyasası', color: '#6B7280' },
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-display font-medium text-stone-900">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function AllocationPie({ portfolio }: { portfolio: Portfolio }) {
  const data = portfolio.allocations.map((a) => ({
    name: ASSET_CONFIG[a.assetClass]?.label ?? a.assetClass,
    value: a.targetWeight,
    color: ASSET_CONFIG[a.assetClass]?.color ?? '#888',
  }))

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">
        Varlık Dağılımı
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e7e5e4', borderRadius: 8 }}
              labelStyle={{ color: '#fff' }}
              formatter={(v: number) => [`%${v}`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 flex-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-sm text-stone-900/70">{d.name}</span>
              </div>
              <span className="text-sm font-medium text-stone-900">%{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function InstrumentTable({ portfolio }: { portfolio: Portfolio }) {
  const navigate = useNavigate()
  const instruments = portfolio.allocations.flatMap((a) =>
    (a.instruments ?? []).map((inst) => ({ ...inst, assetClass: a.assetClass }))
  )

  if (!instruments.length) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest">
          Seçilen Enstrümanlar
        </h3>
        <button className="text-xs text-amber-700 hover:text-amber-700-light transition-colors">
          CSV İndir
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 uppercase tracking-wider border-b border-stone-200">
              <th className="text-left pb-3 pr-4">Enstrüman</th>
              <th className="text-left pb-3 pr-4">Sınıf</th>
              <th className="text-right pb-3 pr-4">Ağırlık</th>
              <th className="text-right pb-3 pr-4">Momentum</th>
              <th className="text-right pb-3">Faktör Skoru</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {instruments.map((inst) => {
              const cfg = ASSET_CONFIG[inst.assetClass]
              const score = inst.factorScore?.composite ?? 0
              return (
                <tr key={inst.ticker} className="hover:bg-stone-50/30 transition-colors">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-stone-900">{inst.ticker}</p>
                    <p className="text-xs text-stone-400 truncate max-w-[120px]">{inst.name}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                      style={{ color: cfg?.color, borderColor: `${cfg?.color}40`, background: `${cfg?.color}15` }}>
                      {cfg?.label ?? inst.assetClass}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-stone-900/70">—</td>
                  <td className="py-3 pr-4 text-right">
                    {inst.factorScore ? (
                      <span className={`text-xs font-medium ${inst.factorScore.momentum >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {inst.factorScore.momentum >= 0 ? '▲' : '▼'} {Math.abs(inst.factorScore.momentum).toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 bg-stone-50 rounded-full overflow-hidden">
                        <div className="h-full bg-stone-900 rounded-full" style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-xs text-stone-500 w-6 text-right">{score}</span>
                    </div>
                  </td>
                  <td className="py-3 pl-2">
                    <button
                      onClick={() => navigate(`/assets/${inst.ticker}`)}
                      className="text-xs text-amber-700 hover:text-amber-700-light transition-colors px-2 py-1 border border-fw-gold/30 rounded-lg hover:bg-stone-900/10"
                    >
                      Detay
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FactorScoreChart({ portfolio }: { portfolio: Portfolio }) {
  const instruments = portfolio.allocations
    .flatMap((a) => a.instruments ?? [])
    .filter((i) => i.factorScore)
    .slice(0, 5)
    .map((i) => ({ name: i.ticker, score: i.factorScore!.composite }))

  if (!instruments.length) return null

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">
        Faktör Skoru Karşılaştırması (İlk 5)
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={instruments} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis dataKey="name" tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #e7e5e4', borderRadius: 8 }}
            formatter={(v: number) => [v, 'Kompozit Skor']}
          />
          <Bar dataKey="score" fill="#1c1917" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: portfolio, isLoading, error, isStale } = useApi(
    () => portfolioService.getLatest()
  )

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-stone-500 text-sm">Dashboard yükleniyor…</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !portfolio) {
    return (
      <AppLayout>
        <EmptyState
          title="Portföy bulunamadı"
          description="Henüz bir portföy öneriniz yok. Risk anketini tamamlayarak başlayın."
          action={
            <Button onClick={() => navigate('/questionnaire')}>
              Risk Anketini Başlat →
            </Button>
          }
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Staleness warning — SDD requirement */}
        {isStale && <StalenessWarning />}

        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <ProfileBadge profile={portfolio.profileType} />
            <HorizonBadge horizon={portfolio.horizonType} />
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/compare')}>
            Senaryo Karşılaştır
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Risk Profili" value={
            { conservative: 'Muhafazakâr', balanced: 'Dengeli', aggressive: 'Agresif' }[portfolio.profileType]
          } sub={`${portfolio.profileType}`} />
          <StatCard label="Portföy Skoru" value={portfolio.portfolioScore?.toFixed(1) ?? '—'} sub="Çeşitlendirme endeksi" />
          <StatCard label="Beklenen Volatilite" value={`%${portfolio.expectedVolatility?.toFixed(1) ?? '—'}`} sub="Yıllık std. sapma" />
          <StatCard label="Seçilen Varlık" value={
            String(portfolio.allocations.reduce((s, a) => s + (a.instruments?.length ?? 0), 0))
          } sub={`${portfolio.allocations.length} varlık sınıfı`} />
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-2 gap-6">
          <AllocationPie portfolio={portfolio} />
          <FactorScoreChart portfolio={portfolio} />
        </div>

        {/* Instrument table */}
        <InstrumentTable portfolio={portfolio} />

        {/* Disclaimer — RAD legal requirement: visible on every portfolio page */}
        <Disclaimer />

        {/* Generation info */}
        <p className="text-xs text-stone-300 text-center">
          Oluşturulma: {new Date(portfolio.generatedAt).toLocaleString('tr-TR')} · yfinance verisi (15 dk önbellek)
        </p>
      </div>
    </AppLayout>
  )
}
