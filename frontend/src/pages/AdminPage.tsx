import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Alert, Spinner } from '@/components/ui/index'
import { useApi, useMutation } from '@/hooks/useApi'
import { adminService } from '@/services'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import type { SystemConfig, UserWithOverrides, AdminOverride, AssetClass } from '@/types'

// ─── Sabitler ────────────────────────────────────────────────────────────────

const ASSET_CLASSES: AssetClass[] = [
  'BIST_EQUITY', 'SP500_EQUITY', 'COMMODITY', 'CRYPTOCURRENCY', 'CASH_EQUIVALENT',
]

function getAssetLabels(language: string): Record<AssetClass, string> {
  return language === 'tr' ? {
    BIST_EQUITY:     'BIST Hisseleri',
    SP500_EQUITY:    'S&P 500 ETF',
    COMMODITY:       'Emtialar',
    CRYPTOCURRENCY:  'Kripto Para',
    CASH_EQUIVALENT: 'Nakit / Para Piyasası',
  } : {
    BIST_EQUITY:     'BIST Equities',
    SP500_EQUITY:    'S&P 500 ETF',
    COMMODITY:       'Commodities',
    CRYPTOCURRENCY:  'Cryptocurrency',
    CASH_EQUIVALENT: 'Cash / Money Market',
  }
}

const ASSET_COLORS: Record<AssetClass, string> = {
  BIST_EQUITY:     'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  SP500_EQUITY:    'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  COMMODITY:       'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  CRYPTOCURRENCY:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  CASH_EQUIVALENT: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
}

// ─── Tab tipi ─────────────────────────────────────────────────────────────────

type Tab = 'overrides' | 'config' | 'cache'

// ─── Override Formu ───────────────────────────────────────────────────────────

interface OverrideFormState {
  userId: string
  assetClass: AssetClass
  minWeight: string
  maxWeight: string
  reason: string
}

const emptyForm = (): OverrideFormState => ({
  userId: '',
  assetClass: 'CRYPTOCURRENCY',
  minWeight: '',
  maxWeight: '',
  reason: '',
})

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function AdminPage() {

  const { t, language} = useThemeLang()

  useEffect(() => { document.title = `${t('nav.admin')} | Financial Wisdom` }, [language, t])
  const [tab, setTab] = useState<Tab>('overrides')

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Başlık */}
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900 dark:text-stone-100 mb-1">
            {t('admin.title')}
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-stone-100 dark:bg-stone-800/50 rounded-xl w-fit">
          {([
            { key: 'overrides', label: t('admin.tabOverrides') },
            { key: 'config',    label: t('admin.tabConfig') },
            { key: 'cache',     label: t('admin.tabCache') },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'overrides' && <OverridesTab />}
        {tab === 'config'    && <ConfigTab />}
        {tab === 'cache'     && <CacheTab />}
      </div>
    </AppLayout>
  )
}

// ─── Kısıtlar Tab'ı ───────────────────────────────────────────────────────────

function OverridesTab() {
  const { t, language } = useThemeLang()
  const ASSET_LABELS = getAssetLabels(language)
  const { data: users, isLoading, error, refetch } = useApi<UserWithOverrides[]>(
    () => adminService.getUsers()
  )

  const [selectedUser, setSelectedUser] = useState<UserWithOverrides | null>(null)
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState<OverrideFormState>(emptyForm())
  const [formError, setFormError]       = useState<string | null>(null)
  const [formSuccess, setFormSuccess]   = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')

  const { mutate: createOverride, isLoading: creating } = useMutation(
    (payload: Parameters<typeof adminService.createOverride>[0]) =>
      adminService.createOverride(payload),
    {
      onSuccess: () => {
        setFormSuccess(true)
        setForm(emptyForm())
        setShowForm(false)
        refetch()
        setTimeout(() => setFormSuccess(false), 3000)
      },
    }
  )

  const { mutate: deleteOverride } = useMutation(
    (id: string) => adminService.deleteOverride(id),
    { onSuccess: refetch }
  )

  const handleSubmit = () => {
    setFormError(null)
    if (!form.userId) { setFormError(t('admin.userSelect')); return }
    if (!form.reason.trim() || form.reason.length < 5) {
      setFormError(language === 'tr' ? 'Sebep en az 5 karakter olmalı.' : 'Reason must be at least 5 characters.'); return
    }
    const min = form.minWeight !== '' ? parseFloat(form.minWeight) : null
    const max = form.maxWeight !== '' ? parseFloat(form.maxWeight) : null
    if (min === null && max === null) {
      setFormError(language === 'tr' ? 'En az bir kısıt (min veya max) girilmeli.' : 'At least one constraint (min or max) is required.'); return
    }
    if (min !== null && max !== null && min > max) {
      setFormError(language === 'tr' ? 'Min değer, max değerden büyük olamaz.' : 'Min value cannot be greater than max value.'); return
    }
    createOverride({
      user_id: form.userId,
      asset_class: form.assetClass,
      min_weight: min,
      max_weight: max,
      reason: form.reason.trim(),
    })
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  if (error) return <Alert variant="error">{error}</Alert>

  const investors = (users ?? []).filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Tüm aktif override'lar
  const allOverrides: (AdminOverride & { userEmail: string; userName: string })[] =
    (users ?? []).flatMap(u =>
      (u.activeOverrides ?? []).map(ov => ({
        ...ov,
        userEmail: u.email,
        userName: u.fullName,
      }))
    )

  return (
    <div className="space-y-6">
      {formSuccess && <Alert variant="success">language === 'tr' ? 'Kısıt başarıyla oluşturuldu.' : 'Override created successfully.'</Alert>}

      {/* Aktif override'lar özet */}
      {allOverrides.length > 0 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
            {language === 'tr' ? `Aktif Kısıtlar (${allOverrides.length})` : `Active Overrides (${allOverrides.length})`}
          </h3>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {allOverrides.map(ov => (
              <div key={ov.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                      {ov.userName}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500 truncate">{ov.userEmail}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ASSET_COLORS[ov.asset_class as AssetClass] ?? 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300'}`}>
                      {ASSET_LABELS[ov.asset_class as AssetClass] ?? ov.asset_class}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {ov.min_weight !== null && <span>Min: <strong className="text-stone-700 dark:text-stone-300">%{ov.min_weight}</strong></span>}
                    {ov.max_weight !== null && <span>Max: <strong className="text-stone-700 dark:text-stone-300">%{ov.max_weight}</strong></span>}
                    <span className="truncate" title={ov.reason}>— {ov.reason}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(t('admin.confirmRemove'))) {
                      deleteOverride(ov.id)
                    }
                  }}
                  className="shrink-0 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {t('common.delete')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yeni override formu */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
            {t('admin.newOverride')}
          </h3>
          {!showForm && (
            <Button
              variant="secondary"
              onClick={() => { setShowForm(true); setFormError(null) }}
            >
              {t('admin.addOverride')}
            </Button>
          )}
        </div>

        {showForm && (
          <div className="space-y-4 pt-2 border-t border-stone-100 dark:border-stone-800">
            {formError && <Alert variant="error">{formError}</Alert>}

            {/* Kullanıcı arama */}
            <div>
              <label className="label">{t('admin.selectUser')}</label>
              <input
                type="text"
                className="input mb-2"
                placeholder={language === 'tr' ? 'E-posta veya isimle ara…' : 'Search by email or name…'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-800">
                {investors.length === 0 && (
                  <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">{t('admin.userNotFound')}</p>
                )}
                {investors.map(u => (
                  <button
                    key={u.userId}
                    onClick={() => {
                      setForm(f => ({ ...f, userId: u.userId }))
                      setSelectedUser(u)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      form.userId === u.userId
                        ? 'bg-stone-100 dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <span className="font-medium">{u.fullName}</span>
                    <span className="text-stone-400 dark:text-stone-500 ml-2 text-xs">{u.email}</span>
                    {u.overrideCount > 0 && (
                      <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                        {u.overrideCount} {t('admin.activeConstraints')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Varlık sınıfı */}
            <div>
              <label className="label">{t('admin.assetClass')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ASSET_CLASSES.map(ac => (
                  <button
                    key={ac}
                    onClick={() => setForm(f => ({ ...f, assetClass: ac }))}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                      form.assetClass === ac
                        ? 'border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                    }`}
                  >
                    {ASSET_LABELS[ac]}
                  </button>
                ))}
              </div>
            </div>

            {/* Min / Max */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Min % <span className="text-stone-400 font-normal">(opsiyonel)</span></label>
                <input
                  type="number" min="0" max="100" step="1"
                  className="input"
                  placeholder={language === 'tr' ? 'ör: 10' : 'e.g. 10'}
                  value={form.minWeight}
                  onChange={e => setForm(f => ({ ...f, minWeight: e.target.value }))}
                />
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{t('admin.minWeightDesc')}</p>
              </div>
              <div>
                <label className="label">Max % <span className="text-stone-400 font-normal">(opsiyonel)</span></label>
                <input
                  type="number" min="0" max="100" step="1"
                  className="input"
                  placeholder={language === 'tr' ? 'ör: 5' : 'e.g. 5'}
                  value={form.maxWeight}
                  onChange={e => setForm(f => ({ ...f, maxWeight: e.target.value }))}
                />
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{t('admin.maxWeightDesc')}</p>
              </div>
            </div>

            {/* Sebep */}
            <div>
              <label className="label">{t('admin.reason')} <span className="text-red-500">*</span></label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder={t('admin.reasonPlaceholder')}
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>

            {/* Algoritma notu */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <span className="text-blue-500 dark:text-blue-400 text-sm shrink-0">ℹ️</span>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                {t('admin.overrideNote')}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => { setShowForm(false); setForm(emptyForm()); setSearchQuery('') }}
              >
                {t('profile.page.cancel')}
              </Button>
              <Button onClick={handleSubmit} isLoading={creating}>
                {t('admin.saveOverride')}
              </Button>
            </div>
          </div>
        )}

        {!showForm && allOverrides.length === 0 && (
          <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-6">
            {t('admin.noOverrides')}
          </p>
        )}
      </div>

      {/* Kullanıcı listesi özet */}
      <div className="card">
        <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
          {language === 'tr' ? `Tüm Kullanıcılar (${(users ?? []).length})` : `All Users (${(users ?? []).length})`}
        </h3>
        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {(users ?? []).map(u => (
            <div key={u.userId} className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-stone-900 dark:text-stone-100">{u.fullName}</span>
                <span className="text-xs text-stone-400 dark:text-stone-500 ml-2">{u.email}</span>
                {u.role === 'admin' && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                    admin
                  </span>
                )}
              </div>
              {u.overrideCount > 0 && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  {u.overrideCount} {t('admin.activeConstraints')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sistem Konfigürasyonu Tab'ı ─────────────────────────────────────────────

function ConfigTab() {
  const { t, language } = useThemeLang()
  const { data, isLoading, error, refetch } = useApi<SystemConfig>(() => adminService.getConfig())
  const [form, setForm] = useState<Partial<SystemConfig> | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])

  const { mutate: save, isLoading: saving, error: saveError } = useMutation(
    (cfg: Partial<SystemConfig>) => adminService.updateConfig(cfg),
    { onSuccess: () => { setSaved(true); refetch(); setTimeout(() => setSaved(false), 3000) } }
  )

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  if (error || !form) return <Alert variant="error">{error ?? (language === 'tr' ? 'Konfigürasyon yüklenemedi.' : 'Failed to load config.')}</Alert>

  const fw = form.factorWeights ?? { momentum: 0.35, value: 0.20, quality: 0.20, lowVolatility: 0.25 }
  const fwSum = Object.values(fw).reduce((s, v) => s + v, 0)

  return (
    <div className="space-y-6">
      {saved && <Alert variant="success">language === 'tr' ? 'Konfigürasyon kaydedildi.' : 'Configuration saved.'</Alert>}
      {saveError && <Alert variant="error">{saveError}</Alert>}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Factor weights */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
              {language === 'tr' ? 'Factor Weights (Katman 2)' : 'Factor Weights (Layer 2)'}
            </h3>
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${
              Math.abs(fwSum - 1) < 0.01
                ? 'text-green-600 dark:text-green-400 bg-green-500/10'
                : 'text-red-600 dark:text-red-400 bg-red-500/10'
            }`}>
              {language === 'tr' ? 'Toplam' : 'Total'}: {fwSum.toFixed(2)} {Math.abs(fwSum - 1) < 0.01 ? '✓' : '✗'}
            </span>
          </div>
          {(['momentum', 'value', 'quality', 'lowVolatility'] as const).map((key) => {
            const labels = {
              momentum: t('admin.momentum'), value: t('admin.value'),
              quality: t('admin.quality'), lowVolatility: t('admin.lowVolatility'),
            }
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">{labels[key]}</span>
                  <span className="text-stone-900 dark:text-stone-100 font-mono">{fw[key].toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={fw[key]}
                  onChange={(e) =>
                    setForm({ ...form, factorWeights: { ...fw, [key]: parseFloat(e.target.value) } })
                  }
                  className="w-full accent-stone-900 dark:accent-stone-300"
                />
              </div>
            )
          })}
        </div>

        {/* Veri kaynağı */}
        <div className="card space-y-4">
          <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
            {language === 'tr' ? 'Veri Kaynağı' : 'Data Source'}
          </h3>
          {([
            { label: language === 'tr' ? 'yfinance Önbellek TTL (dakika)' : 'yfinance Cache TTL (minutes)', key: 'yfinanceCacheTtlMinutes' as const, min: 1, max: 60 },
            { label: language === 'tr' ? 'Min. Veri Tamlığı' : 'Min. Data Completeness', key: 'minDataCompleteness' as const, min: 0, max: 1 },
            { label: t('admin.maxInstruments'), key: 'maxInstrumentsPerClass' as const, min: 1, max: 20 },
          ]).map(({ label, key, min, max }) => (
            <div key={key} className="space-y-1.5">
              <label className="label">{label}</label>
              <input
                type="number" min={min} max={max}
                className="input"
                value={(form as SystemConfig)[key] ?? ''}
                onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) })}
              />
            </div>
          ))}
          <div className="space-y-2">
            {([
              { label: language === 'tr' ? 'Redis önbelleğini etkinleştir' : 'Enable Redis cache', key: 'enableRedisCache' as const },
              { label: language === 'tr' ? 'API başarısız olunca fallback kullan' : 'Use fallback on API failure', key: 'useFallbackOnApiFailure' as const },
            ]).map(({ label, key }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-stone-900 dark:accent-stone-300"
                  checked={(form as SystemConfig)[key] ?? false}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                <span className="text-sm text-stone-600 dark:text-stone-400">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setForm(data!)}>{t('profile.page.cancel')}</Button>
        <Button onClick={() => save(form!)} isLoading={saving}>{t('admin.save')}</Button>
      </div>
    </div>
  )
}

// ─── Önbellek Tab'ı ───────────────────────────────────────────────────────────

function CacheTab() {
  const { t: _t, language } = useThemeLang()
  const { data, isLoading, error, refetch } = useApi(() => adminService.getCacheKeys())
  const [flushed, setFlushed] = useState(false)

  const { mutate: flush, isLoading: flushing } = useMutation(
    () => adminService.flushCache(),
    {
      onSuccess: () => {
        setFlushed(true)
        refetch()
        setTimeout(() => setFlushed(false), 3000)
      },
    }
  )

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  if (error) return <Alert variant="error">{error}</Alert>

  const keys: Record<string, { ttl_seconds: number }> = data?.keys ?? {}
  const totalKeys: number = data?.total_keys ?? 0

  return (
    <div className="space-y-6">
      {flushed && <Alert variant="success">language === 'tr' ? 'Önbellek temizlendi.' : 'Cache cleared.'</Alert>}

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
              {language === 'tr' ? 'Redis Önbelleği' : 'Redis Cache'}
            </h3>
            <p className="text-2xl font-display font-medium text-stone-900 dark:text-stone-100 mt-1">
              {totalKeys} <span className="text-base font-sans text-stone-500 dark:text-stone-400">{language === 'tr' ? 'anahtar' : 'keys'}</span>
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm(language === 'tr' ? 'Tüm önbelleği temizlemek istediğinizden emin misiniz?' : 'Are you sure you want to flush the entire cache?')) flush(undefined)
            }}
            isLoading={flushing}
          >
            language === 'tr' ? 'Önbelleği Temizle' : 'Flush Cache'
          </Button>
        </div>

        {totalKeys > 0 && (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-800">
                  <th className="text-left pb-2 font-medium">{language === 'tr' ? 'Anahtar' : 'Key'}</th>
                  <th className="text-right pb-2 font-medium">TTL ({language === 'tr' ? 'sn' : 's'})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50 dark:divide-stone-800/50">
                {Object.entries(keys).map(([key, val]) => (
                  <tr key={key} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                    <td className="py-1.5 font-mono text-stone-600 dark:text-stone-400 truncate max-w-xs">
                      {key}
                    </td>
                    <td className="py-1.5 text-right text-stone-500 dark:text-stone-500 font-mono">
                      {val.ttl_seconds}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        onClick={() => refetch()}
        className="text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
      >
        language === 'tr' ? '↻ Yenile' : '↻ Refresh'
      </button>
    </div>
  )
}