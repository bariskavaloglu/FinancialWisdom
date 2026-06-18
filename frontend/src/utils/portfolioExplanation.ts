import type { AssetClass, HorizonType, ProfileType } from '@/types'

// Backend _MIN_WEIGHT_THRESHOLD ile aynı (yüzde)
const MIN_WEIGHT = 5

const PROFILE_KEY: Record<ProfileType, string> = {
  conservative: 'profile.conservative',
  balanced:     'profile.balanced',
  aggressive:   'profile.aggressive',
}

const HORIZON_KEY: Record<HorizonType, string> = {
  short:  'horizon.shortLabel',
  medium: 'horizon.mediumLabel',
  long:   'horizon.longLabel',
}

const ASSET_KEY: Record<AssetClass, string> = {
  BIST_EQUITY:     'asset.BIST_EQUITY',
  SP500_EQUITY:    'asset.SP500_EQUITY',
  COMMODITY:       'asset.COMMODITY',
  CRYPTOCURRENCY:  'asset.CRYPTOCURRENCY',
  CASH_EQUIVALENT: 'asset.CASH_EQUIVALENT',
}

// Kanonik sıra — "hariç tutulanlar" listesi için
const ALL_CLASSES: AssetClass[] = [
  'BIST_EQUITY', 'SP500_EQUITY', 'COMMODITY', 'CRYPTOCURRENCY', 'CASH_EQUIVALENT',
]

type Alloc = { assetClass: AssetClass; targetWeight: number }

interface ExplanationInput {
  profileType: ProfileType
  horizonType: HorizonType
  /** Verilirse dağılım + hariç tutulan cümleleri de eklenir. */
  allocations?: Alloc[]
}

/**
 * Portföy açıklamasını aktif arayüz diline göre yapısal veriden üretir.
 * Backend'in sakladığı (İngilizce) açıklamayı geçersiz kılar; dil değiştikçe
 * yeniden hesaplanır ve eski portföylerde de doğru dilde görünür.
 */
export function buildPortfolioExplanation(
  { profileType, horizonType, allocations }: ExplanationInput,
  t: (k: string) => string,
  language: string,
): string {
  const isTr = language === 'tr'

  const profile = t(PROFILE_KEY[profileType] ?? 'profile.balanced')
  const horizon = t(HORIZON_KEY[horizonType] ?? 'horizon.mediumLabel')

  const pct = (n: number) => (isTr ? `%${n}` : `${n}%`)

  let text = t('why.intro')
    .replace('{profile}', profile)
    .replace('{horizon}', horizon)

  if (allocations && allocations.length) {
    const active = allocations
      .filter(a => a.targetWeight >= MIN_WEIGHT)
      .sort((a, b) => b.targetWeight - a.targetWeight)

    if (active.length) {
      const allocDesc = active
        .map(a => `${t(ASSET_KEY[a.assetClass] ?? a.assetClass)} (${pct(Math.round(a.targetWeight))})`)
        .join(', ')
      text += t('why.allocs').replace('{allocs}', allocDesc)
    }

    const activeSet = new Set(active.map(a => a.assetClass))
    const excluded = ALL_CLASSES
      .filter(c => !activeSet.has(c))
      .map(c => t(ASSET_KEY[c]))

    if (excluded.length) {
      text += t('why.excluded').replace('{excluded}', excluded.join(', '))
    }
  }

  return text
}

// ── "Neden seçildi?" gerekçeleri ────────────────────────────────────────────
// Backend gerekçeleri sabit İngilizce metin olarak üretir (instruments.py /
// portfolio_engine.py _why_selected). Bilinen tüm varyantları i18n anahtarına
// eşleyip aktif dile çeviririz; eşleşmezse ham metin gösterilir.
const WHY_SELECTED_KEY: Record<string, string> = {
  'Selected by rules-based portfolio algorithm.':         'why.sel.algo',
  'Strong price momentum (12-month return)':              'why.sel.momentum',
  'High quality score (strong ROE)':                      'why.sel.qualityRoe',
  'Consistent uptrend quality (Calmar-style score)':      'why.sel.qualityCalmar',
  'Low volatility — capital preservation':                'why.sel.volatility',
  'Attractive valuation (low P/B ratio)':                 'why.sel.valuePb',
  'Attractive entry point (below 52-week high)':          'why.sel.valueEntry',
  'Balanced factor profile — portfolio diversification':  'why.sel.balanced',
}

export function translateWhySelected(reason: string, t: (k: string) => string): string {
  const key = WHY_SELECTED_KEY[reason]
  return key ? t(key) : reason
}
