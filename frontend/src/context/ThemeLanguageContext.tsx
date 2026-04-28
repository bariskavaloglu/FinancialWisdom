import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Theme    = 'light' | 'dark'
export type Language = 'en' | 'tr'

interface ThemeLanguageContextValue {
  theme:    Theme
  language: Language
  toggleTheme:    () => void
  toggleLanguage: () => void
  t: (key: string) => string
}

// ─── Translations ─────────────────────────────────────────────────────────────

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navbar
    'nav.dashboard':     'Dashboard',
    'nav.marketPool':    'Market Pool',
    'nav.questionnaire': 'Questionnaire',
    'nav.compare':       'Compare',
    'nav.admin':         'Admin',
    'nav.about':         'About',
    'nav.howItWorks':    'How It Works',
    'nav.login':         'Login',
    'nav.signup':        'Sign Up Free',
    'nav.logout':        'Logout',

    // Dashboard
    'dashboard.loading':           'Loading dashboard…',
    'dashboard.noPortfolio':       'No portfolio found',
    'dashboard.noPortfolioDesc':   'Complete the risk questionnaire to get your personalised portfolio.',
    'dashboard.startQuestionnaire':'Start Risk Questionnaire →',
    'dashboard.compareScenarios':  'Compare Scenarios',
    'dashboard.viewingHistory':    '📂 Viewing historical portfolio',
    'dashboard.backToCurrent':     '← Back to current',
    'dashboard.portfolioHistory':  'Portfolio History',
    'dashboard.takeNew':           '+ Take a new questionnaire →',
    'dashboard.selectPortfolio':   'Select a portfolio',

    // Profile Banner
    'banner.recommendation':    'Portfolio Recommendation',
    'banner.questionnaire':     'Questionnaire:',
    'banner.retake':            'Retake →',
    'banner.topAllocations':    'Top Allocations',
    'banner.keyMetrics':        'Key Metrics',
    'banner.expectedReturn':    'Expected Return',
    'banner.expectedVolatility':'Expected Volatility',
    'banner.instruments':       'Instruments',
    'banner.avgFactorProfile':  'Avg Factor Profile',
    'banner.riskScore':         'Risk score',
    'banner.whyThis':           'Why this portfolio?',
    'banner.noData':            'No data',

    // Stat Cards
    'stat.riskProfile':        'Risk Profile',
    'stat.portfolioScore':     'Portfolio Score',
    'stat.expectedVolatility': 'Expected Volatility',
    'stat.selectedAssets':     'Selected Assets',
    'stat.divIndex':           'Diversification index',
    'stat.annualised':         'Annualised std. dev.',
    'stat.assetClasses':       'asset classes',

    // Charts
    'chart.assetAllocation':      'Asset Allocation',
    'chart.factorScore':          'Factor Score Comparison (Top 8)',
    'chart.selectedInstruments':  'Selected Instruments',
    'chart.csvDownload':          '↓ CSV',
    'chart.instrument':           'Instrument',
    'chart.class':                'Class',
    'chart.weight':               'Weight',
    'chart.momentum':             'Momentum',
    'chart.score':                'Score',
    'chart.detail':               'Detail',
    'chart.generatedAt':          'Generated:',
    'chart.cacheNote':            'yfinance data (15 min cache)',

    // Profile types
    'profile.conservative': 'Conservative',
    'profile.balanced':     'Balanced',
    'profile.aggressive':   'Aggressive',
    'profile.conservativeDesc': 'Capital preservation priority. Stability over growth.',
    'profile.balancedDesc':     'Growth and security balanced. Diversified, moderate-risk approach.',
    'profile.aggressiveDesc':   'Growth is primary. Higher volatility accepted for superior returns.',

    // Horizon
    'horizon.short':  'Short-term',
    'horizon.medium': 'Medium-term',
    'horizon.long':   'Long-term',
    'horizon.shortSub':  '< 1 yr',
    'horizon.mediumSub': '1–5 yrs',
    'horizon.longSub':   '5+ yrs',
    'horizon.shortLabel':  'Short-term (0–1 yr)',
    'horizon.mediumLabel': 'Medium-term (1–5 yr)',
    'horizon.longLabel':   'Long-term (5+ yr)',

    // Asset classes
    'asset.BIST_EQUITY':     'BIST Equities',
    'asset.SP500_EQUITY':    'S&P 500 ETF',
    'asset.COMMODITY':       'Commodities',
    'asset.CRYPTOCURRENCY':  'Cryptocurrency',
    'asset.CASH_EQUIVALENT': 'Cash / Money Market',
    'asset.BIST_SHORT':      'BIST',
    'asset.SP500_SHORT':     'S&P500',
    'asset.COMMODITY_SHORT': 'Commodity',
    'asset.CRYPTO_SHORT':    'Crypto',
    'asset.CASH_SHORT':      'Cash',

    // Compare Page
    'compare.title':          'Scenario Comparison',
    'compare.subtitle':       'Compare two portfolios side by side',
    'compare.noPortfolios':   'No portfolios yet.',
    'compare.scenarioA':      'Scenario A',
    'compare.scenarioB':      'Scenario B',
    'compare.select':         'Select a portfolio…',
    'compare.compareBtn':     'Compare →',
    'compare.failed':         'Failed to load comparison.',
    'compare.radarTitle':     'Allocation Distribution Comparison',
    'compare.diffTable':      'Difference Table',
    'compare.metric':         'Metric',
    'compare.diff':           'Difference',
    'compare.portfolioScore': 'Portfolio Score',
    'compare.volatility':     'Expected Volatility',
    'compare.horizon':        'horizon',
    'compare.instruments':    'Instruments',
    'compare.winners':        'Winner Analysis',
    'compare.higher':         'Higher',
    'compare.lower':          'Lower',
    'compare.same':           'Same',
    'compare.betterScore':    'Better score',
    'compare.lowerRisk':      'Lower risk',
    'compare.allocationBreakdown': 'Full Allocation Breakdown',
    'compare.noComparison':   'Select two portfolios above to begin comparison',

    // Footer
    'footer.educational':    '⚠ For educational purposes only. Not financial advice.',
    'footer.disclaimer':     'These recommendations are for educational purposes only and do not constitute regulated financial advice.',
    'footer.stale':          'Market data may not be current. Loaded from cache.',

    // Common
    'common.loading':   'Loading…',
    'common.current':   'Current',
    'common.score':     'Score',
    // Settings
    'settings.profile':    'My Profile',
    'settings.preferences':'Preferences',
    'settings.darkMode':   'Dark Mode',
    'settings.lightMode':  'Light Mode',
    'settings.switchToEn': 'Switch to English',
    'settings.switchToTr': 'Switch to Turkish',

    // Profile page
    'profile.page.title':        'My Profile',
    'profile.page.subtitle':     'Manage your account information and security',
    'profile.page.info':         'Account Information',
    'profile.page.fullName':     'Full Name',
    'profile.page.email':        'Email Address',
    'profile.page.role':         'Account Type',
    'profile.page.memberSince':  'Member Since',
    'profile.page.editName':     'Edit Name',
    'profile.page.save':         'Save Changes',
    'profile.page.cancel':       'Cancel',
    'profile.page.saved':        'Changes saved successfully.',
    'profile.page.saveFailed':   'Failed to save changes.',
    'profile.page.security':     'Security',
    'profile.page.changePass':   'Change Password',
    'profile.page.currentPass':  'Current Password',
    'profile.page.newPass':      'New Password',
    'profile.page.confirmPass':  'Confirm New Password',
    'profile.page.updatePass':   'Update Password',
    'profile.page.passMismatch': 'Passwords do not match.',
    'profile.page.passSuccess':  'Password updated successfully.',
    'profile.page.passFailed':   'Failed to update password.',
    'profile.page.passShort':    'Password must be at least 8 characters.',
    'profile.page.investor':     'Investor',
    'profile.page.admin':        'Administrator',
    'profile.page.stats':        'Activity Summary',
    'profile.page.assessments':  'Assessments Taken',
    'profile.page.portfolios':   'Portfolios Generated',
    'profile.page.goToDashboard':'Go to Dashboard',
    'profile.page.goToQuest':    'Take New Questionnaire',
    'profile.page.noActivity':   'No activity yet.',
  },

  tr: {
    // Navbar
    'nav.dashboard':     'Panel',
    'nav.marketPool':    'Piyasa Havuzu',
    'nav.questionnaire': 'Anket',
    'nav.compare':       'Karşılaştır',
    'nav.admin':         'Yönetici',
    'nav.about':         'Hakkında',
    'nav.howItWorks':    'Nasıl Çalışır',
    'nav.login':         'Giriş Yap',
    'nav.signup':        'Ücretsiz Kayıt',
    'nav.logout':        'Çıkış',

    // Dashboard
    'dashboard.loading':           'Panel yükleniyor…',
    'dashboard.noPortfolio':       'Portföy bulunamadı',
    'dashboard.noPortfolioDesc':   'Kişiselleştirilmiş portföyünüzü almak için risk anketini doldurun.',
    'dashboard.startQuestionnaire':'Risk Anketini Başlat →',
    'dashboard.compareScenarios':  'Senaryoları Karşılaştır',
    'dashboard.viewingHistory':    '📂 Geçmiş portföy görüntüleniyor',
    'dashboard.backToCurrent':     '← Mevcut portföye dön',
    'dashboard.portfolioHistory':  'Portföy Geçmişi',
    'dashboard.takeNew':           '+ Yeni anket doldur →',
    'dashboard.selectPortfolio':   'Portföy seç',

    // Profile Banner
    'banner.recommendation':    'Portföy Önerisi',
    'banner.questionnaire':     'Anket:',
    'banner.retake':            'Tekrar Al →',
    'banner.topAllocations':    'Başlıca Dağılımlar',
    'banner.keyMetrics':        'Temel Metrikler',
    'banner.expectedReturn':    'Beklenen Getiri',
    'banner.expectedVolatility':'Beklenen Volatilite',
    'banner.instruments':       'Araç Sayısı',
    'banner.avgFactorProfile':  'Ort. Faktör Profili',
    'banner.riskScore':         'Risk skoru',
    'banner.whyThis':           'Neden bu portföy?',
    'banner.noData':            'Veri yok',

    // Stat Cards
    'stat.riskProfile':        'Risk Profili',
    'stat.portfolioScore':     'Portföy Skoru',
    'stat.expectedVolatility': 'Beklenen Volatilite',
    'stat.selectedAssets':     'Seçili Varlıklar',
    'stat.divIndex':           'Çeşitlendirme endeksi',
    'stat.annualised':         'Yıllıklandırılmış std. sapma',
    'stat.assetClasses':       'varlık sınıfı',

    // Charts
    'chart.assetAllocation':      'Varlık Dağılımı',
    'chart.factorScore':          'Faktör Skoru Karşılaştırması (İlk 8)',
    'chart.selectedInstruments':  'Seçili Araçlar',
    'chart.csvDownload':          '↓ CSV',
    'chart.instrument':           'Araç',
    'chart.class':                'Sınıf',
    'chart.weight':               'Ağırlık',
    'chart.momentum':             'Momentum',
    'chart.score':                'Skor',
    'chart.detail':               'Detay',
    'chart.generatedAt':          'Oluşturuldu:',
    'chart.cacheNote':            'yfinance verisi (15 dk önbellek)',

    // Profile types
    'profile.conservative': 'Muhafazakâr',
    'profile.balanced':     'Dengeli',
    'profile.aggressive':   'Agresif',
    'profile.conservativeDesc': 'Sermaye koruma önceliklidir. Büyüme yerine istikrar.',
    'profile.balancedDesc':     'Büyüme ve güvenlik dengeli. Çeşitlendirilmiş, orta risk.',
    'profile.aggressiveDesc':   'Büyüme önceliklidir. Üstün getiri için yüksek volatilite kabul edilir.',

    // Horizon
    'horizon.short':  'Kısa Vadeli',
    'horizon.medium': 'Orta Vadeli',
    'horizon.long':   'Uzun Vadeli',
    'horizon.shortSub':  '< 1 yıl',
    'horizon.mediumSub': '1–5 yıl',
    'horizon.longSub':   '5+ yıl',
    'horizon.shortLabel':  'Kısa Vadeli (0–1 yıl)',
    'horizon.mediumLabel': 'Orta Vadeli (1–5 yıl)',
    'horizon.longLabel':   'Uzun Vadeli (5+ yıl)',

    // Asset classes
    'asset.BIST_EQUITY':     'BIST Hisseleri',
    'asset.SP500_EQUITY':    'S&P 500 ETF',
    'asset.COMMODITY':       'Emtialar',
    'asset.CRYPTOCURRENCY':  'Kripto Para',
    'asset.CASH_EQUIVALENT': 'Nakit / Para Piyasası',
    'asset.BIST_SHORT':      'BIST',
    'asset.SP500_SHORT':     'S&P500',
    'asset.COMMODITY_SHORT': 'Emtia',
    'asset.CRYPTO_SHORT':    'Kripto',
    'asset.CASH_SHORT':      'Nakit',

    // Compare Page
    'compare.title':          'Senaryo Karşılaştırması',
    'compare.subtitle':       'İki portföyü yan yana karşılaştırın',
    'compare.noPortfolios':   'Henüz portföy yok.',
    'compare.scenarioA':      'Senaryo A',
    'compare.scenarioB':      'Senaryo B',
    'compare.select':         'Portföy seçin…',
    'compare.compareBtn':     'Karşılaştır →',
    'compare.failed':         'Karşılaştırma yüklenemedi.',
    'compare.radarTitle':     'Dağılım Karşılaştırması',
    'compare.diffTable':      'Fark Tablosu',
    'compare.metric':         'Metrik',
    'compare.diff':           'Fark',
    'compare.portfolioScore': 'Portföy Skoru',
    'compare.volatility':     'Beklenen Volatilite',
    'compare.horizon':        'vade',
    'compare.instruments':    'Araç Sayısı',
    'compare.winners':        'Kazanan Analizi',
    'compare.higher':         'Yüksek',
    'compare.lower':          'Düşük',
    'compare.same':           'Aynı',
    'compare.betterScore':    'Daha iyi skor',
    'compare.lowerRisk':      'Daha düşük risk',
    'compare.allocationBreakdown': 'Tam Dağılım Kırılımı',
    'compare.noComparison':   'Karşılaştırmaya başlamak için yukarıdan iki portföy seçin',

    // Footer
    'footer.educational':    '⚠ Yalnızca eğitim amaçlıdır. Finansal tavsiye değildir.',
    'footer.disclaimer':     'Bu öneriler yalnızca eğitim amaçlıdır ve düzenlenmiş finansal tavsiye niteliği taşımaz.',
    'footer.stale':          'Piyasa verileri güncel olmayabilir. Önbellekten yüklendi.',

    // Common
    'common.loading':   'Yükleniyor…',
    'common.current':   'Mevcut',
    'common.score':     'Skor',
    // Settings
    'settings.profile':    'Profilim',
    'settings.preferences':'Tercihler',
    'settings.darkMode':   'Karanlık Mod',
    'settings.lightMode':  'Açık Mod',
    'settings.switchToEn': "İngilizce'ye Geç",
    'settings.switchToTr': "Türkçe'ye Geç",

    // Profile page
    'profile.page.title':        'Profilim',
    'profile.page.subtitle':     'Hesap bilgilerinizi ve güvenliğinizi yönetin',
    'profile.page.info':         'Hesap Bilgileri',
    'profile.page.fullName':     'Ad Soyad',
    'profile.page.email':        'E-posta Adresi',
    'profile.page.role':         'Hesap Türü',
    'profile.page.memberSince':  'Üyelik Tarihi',
    'profile.page.editName':     'Adı Düzenle',
    'profile.page.save':         'Değişiklikleri Kaydet',
    'profile.page.cancel':       'İptal',
    'profile.page.saved':        'Değişiklikler kaydedildi.',
    'profile.page.saveFailed':   'Değişiklikler kaydedilemedi.',
    'profile.page.security':     'Güvenlik',
    'profile.page.changePass':   'Şifre Değiştir',
    'profile.page.currentPass':  'Mevcut Şifre',
    'profile.page.newPass':      'Yeni Şifre',
    'profile.page.confirmPass':  'Yeni Şifre Tekrar',
    'profile.page.updatePass':   'Şifreyi Güncelle',
    'profile.page.passMismatch': 'Şifreler eşleşmiyor.',
    'profile.page.passSuccess':  'Şifre başarıyla güncellendi.',
    'profile.page.passFailed':   'Şifre güncellenemedi.',
    'profile.page.passShort':    'Şifre en az 8 karakter olmalı.',
    'profile.page.investor':     'Yatırımcı',
    'profile.page.admin':        'Yönetici',
    'profile.page.stats':        'Aktivite Özeti',
    'profile.page.assessments':  'Tamamlanan Anket',
    'profile.page.portfolios':   'Oluşturulan Portföy',
    'profile.page.goToDashboard':'Panele Git',
    'profile.page.goToQuest':    'Yeni Anket Doldur',
    'profile.page.noActivity':   'Henüz aktivite yok.',
  },
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeLanguageContext = createContext<ThemeLanguageContextValue | null>(null)

export function ThemeLanguageProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme]       = useState<Theme>(() => (localStorage.getItem('fw-theme') as Theme) ?? 'light')
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('fw-lang') as Language) ?? 'tr')

  // Apply dark class to <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('fw-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('fw-lang', language)
  }, [language])

  const toggleTheme    = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  const toggleLanguage = () => setLanguage((l) => (l === 'en' ? 'tr' : 'en'))

  const t = (key: string): string => translations[language][key] ?? translations['en'][key] ?? key

  return (
    <ThemeLanguageContext.Provider value={{ theme, language, toggleTheme, toggleLanguage, t }}>
      {children}
    </ThemeLanguageContext.Provider>
  )
}

export function useThemeLang() {
  const ctx = useContext(ThemeLanguageContext)
  if (!ctx) throw new Error('useThemeLang must be used within ThemeLanguageProvider')
  return ctx
}
