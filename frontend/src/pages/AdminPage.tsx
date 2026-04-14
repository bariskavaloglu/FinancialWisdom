import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Alert, Spinner } from '@/components/ui/index'
import { useApi, useMutation } from '@/hooks/useApi'
import { adminService } from '@/services'
import type { SystemConfig } from '@/types'

export default function AdminPage() {
  const { data, isLoading, error, refetch } = useApi(() => adminService.getConfig())
  const [form, setForm] = useState<Partial<SystemConfig> | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  const { mutate: save, isLoading: saving, error: saveError } = useMutation(
    (cfg: Partial<SystemConfig>) => adminService.updateConfig(cfg),
    { onSuccess: () => { setSaved(true); refetch(); setTimeout(() => setSaved(false), 3000) } }
  )

  if (isLoading) return <AppLayout><div className="flex justify-center py-24"><Spinner size="lg" /></div></AppLayout>
  if (error || !form) return <AppLayout><div className="max-w-lg mx-auto py-24"><Alert variant="error">{error ?? 'Konfigürasyon yüklenemedi.'}</Alert></div></AppLayout>

  const fw = form.factorWeights ?? { momentum: 0.3, value: 0.25, quality: 0.25, lowVolatility: 0.2 }
  const fwSum = Object.values(fw).reduce((s, v) => s + v, 0)

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900 mb-1">Sistem Konfigürasyonu</h1>
          <p className="text-stone-500 text-sm">Faktör ağırlıkları ve tahsisat kuralları</p>
        </div>

        {saved && <Alert variant="success">Konfigürasyon kaydedildi.</Alert>}
        {saveError && <Alert variant="error">{saveError}</Alert>}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Factor weights */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest">Faktör Ağırlıkları (Katman 2)</h3>
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${Math.abs(fwSum - 1) < 0.01 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                Toplam: {fwSum.toFixed(2)} {Math.abs(fwSum - 1) < 0.01 ? '✓' : '✗'}
              </span>
            </div>
            {(['momentum', 'value', 'quality', 'lowVolatility'] as const).map((key) => {
              const labels = { momentum: 'Momentum', value: 'Değer', quality: 'Kalite', lowVolatility: 'Düşük Volatilite' }
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">{labels[key]}</span>
                    <span className="text-stone-900 font-mono">{fw[key].toFixed(2)}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05"
                    value={fw[key]}
                    onChange={(e) => setForm({ ...form, factorWeights: { ...fw, [key]: parseFloat(e.target.value) } })}
                    className="w-full accent-stone-900"
                  />
                </div>
              )
            })}
          </div>

          {/* Data source config */}
          <div className="card space-y-4">
            <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest">Veri Kaynağı</h3>
            {[
              { label: 'yfinance Önbellek TTL (dakika)', key: 'yfinanceCacheTtlMinutes' as const, min: 1, max: 60 },
              { label: 'Min. Veri Tamlığı (%)', key: 'minDataCompleteness' as const, min: 50, max: 100 },
              { label: 'Sınıf Başına Max Enstrüman', key: 'maxInstrumentsPerClass' as const, min: 1, max: 20 },
            ].map(({ label, key, min, max }) => (
              <div key={key} className="space-y-1.5">
                <label className="label">{label}</label>
                <input type="number" min={min} max={max}
                  className="input"
                  value={(form as SystemConfig)[key] ?? ''}
                  onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) })}
                />
              </div>
            ))}
            <div className="space-y-2">
              {[
                { label: 'Redis önbelleğini etkinleştir', key: 'enableRedisCache' as const },
                { label: 'API hatasında fallback kullan', key: 'useFallbackOnApiFailure' as const },
              ].map(({ label, key }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox"
                    className="w-4 h-4 accent-stone-900"
                    checked={(form as SystemConfig)[key] ?? false}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  />
                  <span className="text-sm text-stone-600">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Allocation matrix */}
        {form.allocationMatrix && (
          <div className="card overflow-x-auto">
            <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">Katman 1 — Tahsisat Matrisi</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-400 border-b border-stone-200">
                  {['Profil', 'Vade', 'Hisse %', 'Kripto %', 'Emtia %', 'Nakit %'].map((h) => (
                    <th key={h} className="text-left pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {form.allocationMatrix.map((row, i) => (
                  <tr key={i} className="hover:bg-stone-50/20">
                    <td className="py-2.5 pr-4 text-stone-900 capitalize">{row.profile}</td>
                    <td className="py-2.5 pr-4 text-stone-500 capitalize">{row.horizon}</td>
                    {(['equityPct', 'cryptoPct', 'commodityPct', 'cashPct'] as const).map((col) => (
                      <td key={col} className="py-2.5 pr-4">
                        <input type="number" min="0" max="100"
                          className="w-16 px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 text-xs text-center focus:outline-none focus:border-stone-400/50"
                          value={row[col]}
                          onChange={(e) => {
                            const updated = [...form.allocationMatrix!]
                            updated[i] = { ...row, [col]: parseInt(e.target.value) || 0 }
                            setForm({ ...form, allocationMatrix: updated })
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setForm(data!)}>İptal</Button>
          <Button onClick={() => save(form)} isLoading={saving}>Kaydet</Button>
        </div>
      </div>
    </AppLayout>
  )
}
