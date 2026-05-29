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

// ─── Sistem tercihlerinden başlangıç değerlerini belirle ──────────────────────

/**
 * İlk ziyarette (localStorage yoksa) cihaz/sistem tercihlerine bak:
 *   - Tema  : window.matchMedia('(prefers-color-scheme: dark)')
 *   - Dil   : navigator.language — 'tr' ile başlıyorsa Türkçe, değilse İngilizce
 *
 * Kullanıcı daha önce manuel seçim yaptıysa localStorage önceliklidir.
 */
function getInitialTheme(): Theme {
  const stored = localStorage.getItem('fw-theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  // İlk ziyaret → sistem teması
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('fw-lang') as Language | null
  if (stored === 'en' || stored === 'tr') return stored
  // İlk ziyaret → tarayıcı/sistem dili
  const lang = (navigator.language || navigator.languages?.[0] || 'en').toLowerCase()
  return lang.startsWith('tr') ? 'tr' : 'en'
}

// ─── Translations ─────────────────────────────────────────────────────────────

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navbar
    'nav.dashboard':     'Dashboard',
    'nav.marketPool':    'Market Pool',
    'nav.questionnaire': 'Questionnaire',
    'nav.compare':       'Compare',
    'nav.backtest':      'Backtest',
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
    'common.yes':       'Yes',
    'common.no':        'No',
    'common.delete':    'Delete',
    'common.close':     'Close',
    'common.noData':    'No data available',
    'common.period':    'period',
    'pool.period.1m': '1 Month',
    'pool.period.3m': '3 Months',
    'pool.period.1y': '1 Year',
    'pool.period.2y': '2 Years',

    // Market Pool
    'pool.title':            'Market Data Pool',
    'pool.totalInstruments': 'Total Instruments',
    'pool.gainersLosers':    'Gainers / Losers',
    'pool.dailyChange':      'Daily change',
    'pool.avgFactorScore':   'Avg Factor Score',
    'pool.composite':        'Composite (0–100)',
    'pool.totalDataPoints':  'Total Data Points',
    'pool.cachedRows':       'Cached OHLCV rows',
    'pool.fetching':         'Fetching market pool…',
    'pool.error':            'Could not load market data. Check backend connection.',
    'pool.footer':           'Data via Yahoo Finance · 15 min Redis cache · Prices in USD',
    'pool.allInstruments':   'All Instruments',
    'pool.csvDownload':      '↓ CSV',
    'pool.searchPlaceholder':'Search ticker or name…',
    'pool.price':            'Price',
    'pool.dailyChg':         '1d Chg',
    'pool.range52w':         '52W Range',
    'pool.data':             'Data',
    'pool.factor':           'Factor',
    'pool.priceLast90':      'Price (last 90d)',
    'pool.factorScores':     'Factor Scores',
    'pool.range52wTitle':    '52-Week Range',
    'pool.dataPoints':       'data points',
    'pool.noData':           'No data available',
    'pool.fullDetail':       'Full Detail Page →',
    'pool.deletePortfolio':  'Delete portfolio',
    'pool.compositeName':    'Composite',
    'pool.exchange':         'Exchange',

    // Dashboard delete
    'dash.deletePortfolio':  'Delete portfolio',
    'dash.compositeScore':   'Composite Score',
    'dash.lowVol':           'Low Vol',
    'dash.momentum':         'Momentum',
    'dash.value':            'Value',
    'dash.quality':          'Quality',

    // Profile Result
    'result.scoreSummary':   'Score Summary',
    'result.compositeScore': 'Composite Score',
    'result.retake':         'Retake Questionnaire',
    'result.viewPortfolio':  'View My Portfolio →',

    // Auth / Forgot password
    'auth.forgotPassword':   'Forgot Password',
    'auth.forgotDesc':       "Enter your email and we'll send you a reset link.",
    'auth.sendResetLink':    'Send Reset Link',
    'auth.rememberedIt':     'remembered it?',
    'auth.backToLogin':      'Back to Login',
    'auth.checkEmail':       'Check Your Email',
    'auth.checkEmailDesc':   "If an account exists for",
    'auth.checkEmailDesc2':  ', we sent a password reset link. Check your inbox and spam folder.',
    'auth.resetSteps':       'Next steps',
    'auth.resetStep1':       'Open the reset email from Financial Wisdom',
    'auth.resetStep2':       'Click "Reset My Password"',
    'auth.resetStep3':       'Set your new password (link valid 1 hour)',
    'auth.resetPassword':    'Reset Password',
    'auth.resetDesc':        'Enter your new password below.',
    'auth.newPassword':      'New Password',
    'auth.confirmNewPass':   'Confirm New Password',
    'auth.resetBtn':         'Reset Password',
    'auth.passwordUpdated':  'Password Updated',
    'auth.passwordUpdatedDesc': 'Your password has been reset successfully. You can now sign in with your new password.',
    'auth.signIn':           'Sign In →',
    'auth.invalidLink':      'This reset link is invalid or has expired.',
    'auth.passMin8':         'Password must be at least 8 characters.',
    'auth.passMismatch':     'Passwords do not match.',

    // Register page
    'register.createAccount':  'Create Account',
    'register.subtitle':       'Start building your personalised portfolio',
    'register.step1':          'Create your account',
    'register.step2':          'Verify your email address',
    'register.step3':          'Complete the risk questionnaire (15 questions)',
    'register.step4':          'View your personalised portfolio recommendation',
    'register.howItWorks':     'HOW IT WORKS',
    'register.alreadyHave':    'Already have an account?',
    'register.logIn':          'Log in',
    'register.acceptTerms':    'I accept the Terms of Service and Privacy Policy',
    'register.fullNameReq':    'Full name is required.',
    'register.emailReq':       'Email address is required.',
    'register.passMin8':       'Password must be at least 8 characters.',
    'register.passMismatch':   'Passwords do not match.',
    'register.termsReq':       'You must accept the terms to continue.',
    'register.verifyEmail':    'Verify Your Email',
    'register.verifyDesc':     'We sent a verification link to',
    'register.nextSteps':      'Next steps',
    'register.checkInbox':     'Check your inbox (also try your spam folder)',
    'register.clickVerify':    'Click the "Verify My Email" button in the email',
    'register.autoLogin':      'You will be logged in automatically',
    'register.didntReceive':   "Didn't receive it?",
    'register.resend':         'Resend',
    'register.backToLogin':    'Back to Login',
    'register.createBtn':      'Create Account →',

    // Login page
    'login.welcomeBack':  'Welcome back',
    'login.subtitle':     'Sign in to your account',
    'login.signIn':       'Sign In',
    'login.noAccount':    'no account yet?',
    'login.createFree':   'Create Free Account',
    'login.forgotPass':   'Forgot password?',
    'login.emailReq':     'Email is required.',
    'login.passReq':      'Password is required.',

    // Landing
    'landing.badge':      'Personalized Investment Intelligence',
    'landing.hero1':      'Build a Portfolio That',
    'landing.hero2':      'Matches Your Risk Profile',
    'landing.heroDesc':   'Answer 15 questions. Get a personalized, explainable portfolio recommendation across stocks, crypto, commodities & more. No black boxes.',
    'landing.getStarted': 'Get Started Free →',
    'landing.howItWorks': 'See How It Works',
    'landing.free':       '✓ Free',
    'landing.noTrading':  '✓ No trading required',
    'landing.explainable':'✓ Explainable recommendations',
    'landing.ctaTitle':   'Ready to build your personalized portfolio?',
    'landing.ctaDesc':    'Takes less than 5 minutes. No account required to explore.',
    'landing.ctaBtn':     'Create My Portfolio →',
    'landing.feat1Title': 'Risk Questionnaire',
    'landing.feat1Desc':  '15 questions assess your risk tolerance and investment horizon independently.',
    'landing.feat2Title': 'Factor-Based Selection',
    'landing.feat2Desc':  'Instruments ranked by momentum, value, quality & volatility factors.',
    'landing.feat3Title': 'Explainable Decisions',
    'landing.feat3Desc':  'Every allocation comes with a plain-language reason. No black boxes.',

    // Admin
    'admin.momentum':     'Momentum',
    'admin.value':        'Value',
    'admin.quality':      'Quality',
    'admin.lowVolatility':'Low Volatility',
    'admin.maxInstruments': 'Max Instruments Per Class',

    // Backtest Page
    'backtest.title':          'Portfolio Validation',
    'backtest.subtitle':       'Real yfinance data · H1 analysis window → H2 actual performance',
    'backtest.yourPortfolio':  'Your Portfolio',
    'backtest.profile':        'profile',
    'backtest.assets':         'assets',
    'backtest.expectedReturn': 'Expected return:',
    'backtest.volatility':     'Volatility:',
    'backtest.score':          'Portfolio score:',
    'backtest.loading':        'Portfolio loading…',
    'backtest.notFound':       'Portfolio not found',
    'backtest.notFoundDesc':   'You need to complete the risk questionnaire first. The portfolio created from the questionnaire will be loaded here automatically.',
    'backtest.goToQuest':      'Go to Questionnaire →',
    'backtest.calculate':      'Calculate',
    'backtest.h2Return':       'H2 Return',
    'backtest.h2Sub':          'Jul–Dec actual prices',
    'backtest.h1Signal':       'H1 Signal',
    'backtest.h1Sub':          'Jan–Jun analysis period',
    'backtest.winners':        'Winning assets',
    'backtest.sharpe':         'Sharpe (approx.)',
    'backtest.maxDrawdown':    'Max drawdown:',
    'backtest.h1Period':       'H1 analysis period',
    'backtest.h2Positive':     'H2 positive',
    'backtest.h2Negative':     'H2 negative',
    'backtest.assetDetail':    'Asset-level detail',
    'backtest.h1StartPrice':   'H1 start price',
    'backtest.h1Return':       'H1 return',
    'backtest.h2ReturnCol':    'H2 return',
    'backtest.contribution':   'Portfolio contribution',
    'backtest.totalH2':        'Total portfolio H2 return',
    'backtest.janJun':         'Jan–Jun analysis',
    'backtest.julDec':         'Jul–Dec validation',

    // Admin Page
    'admin.title':             'Admin Panel',
    'admin.subtitle':          'User portfolio overrides, system configuration and cache management',
    'admin.tabOverrides':      '👥 User Overrides',
    'admin.tabConfig':         '⚙️ System Config',
    'admin.tabCache':          '🗄️ Cache',
    'admin.newOverride':       'New Portfolio Override',
    'admin.addOverride':       '+ Add Override',
    'admin.selectUser':        'Select User',
    'admin.userNotFound':      'User not found',
    'admin.activeConstraints': 'active overrides',
    'admin.minWeight':         'Min Weight (%)',
    'admin.maxWeight':         'Max Weight (%)',
    'admin.minWeightDesc':     'Asset will occupy at least this share in the portfolio',
    'admin.maxWeightDesc':     'Asset will occupy at most this share in the portfolio',
    'admin.reason':            'Reason (audit log)',
    'admin.reasonPlaceholder': 'Explain the reason for adding this override (for audit log)…',
    'admin.overrideNote':      'This override does not change the portfolio algorithm. When the user next completes the questionnaire, the algorithm runs normally and the result is clamped to this range.',
    'admin.saveOverride':      'Save Override',
    'admin.noOverrides':       'No active portfolio overrides yet.',
    'admin.confirmRemove':     'Are you sure you want to remove this override?',
    'admin.userSelect':        'Select a user',
    'admin.save':              'Save',
    'admin.assetClass':        'Asset Class',
    'admin.selectAsset':       'Select asset class',

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
    'nav.backtest':      'Validasyon',
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
    'common.yes':       'Evet',
    'common.no':        'Hayır',
    'common.delete':    'Sil',
    'common.close':     'Kapat',
    'common.noData':    'Veri bulunamadı',
    'common.period':    'dönem',
    'pool.period.1m': '1 Ay',
    'pool.period.3m': '3 Ay',
    'pool.period.1y': '1 Yıl',
    'pool.period.2y': '2 Yıl',

    // Market Pool
    'pool.title':            'Piyasa Veri Havuzu',
    'pool.totalInstruments': 'Toplam Araç',
    'pool.gainersLosers':    'Yükselen / Düşen',
    'pool.dailyChange':      'Günlük değişim',
    'pool.avgFactorScore':   'Ort. Faktör Skoru',
    'pool.composite':        'Kompozit (0–100)',
    'pool.totalDataPoints':  'Toplam Veri Noktası',
    'pool.cachedRows':       'Önbellekteki OHLCV satırı',
    'pool.fetching':         'Piyasa havuzu yükleniyor…',
    'pool.error':            'Piyasa verisi yüklenemedi. Backend bağlantısını kontrol edin.',
    'pool.footer':           'Veri kaynağı: Yahoo Finance · 15 dk Redis önbelleği · Fiyatlar USD',
    'pool.allInstruments':   'Tüm Araçlar',
    'pool.csvDownload':      '↓ CSV',
    'pool.searchPlaceholder':'Ticker veya isim ara…',
    'pool.price':            'Fiyat',
    'pool.dailyChg':         'Günlük',
    'pool.range52w':         '52H Aralık',
    'pool.data':             'Veri',
    'pool.factor':           'Faktör',
    'pool.priceLast90':      'Fiyat (son 90 gün)',
    'pool.factorScores':     'Faktör Skorları',
    'pool.range52wTitle':    '52 Haftalık Aralık',
    'pool.dataPoints':       'veri noktası',
    'pool.noData':           'Veri bulunamadı',
    'pool.fullDetail':       'Tam Detay Sayfası →',
    'pool.deletePortfolio':  'Portföyü sil',
    'pool.compositeName':    'Kompozit',
    'pool.exchange':         'Borsa',

    // Dashboard delete
    'dash.deletePortfolio':  'Portföyü sil',
    'dash.compositeScore':   'Kompozit Skor',
    'dash.lowVol':           'Düşük Vol',
    'dash.momentum':         'Momentum',
    'dash.value':            'Değer',
    'dash.quality':          'Kalite',

    // Profile Result
    'result.scoreSummary':   'Skor Özeti',
    'result.compositeScore': 'Kompozit Skor',
    'result.retake':         'Anketi Tekrar Al',
    'result.viewPortfolio':  'Portföyümü Gör →',

    // Auth / Forgot password
    'auth.forgotPassword':   'Şifremi Unuttum',
    'auth.forgotDesc':       'E-postanızı girin, sıfırlama bağlantısı gönderelim.',
    'auth.sendResetLink':    'Sıfırlama Bağlantısı Gönder',
    'auth.rememberedIt':     'hatırladınız mı?',
    'auth.backToLogin':      'Girişe Dön',
    'auth.checkEmail':       'E-postanızı Kontrol Edin',
    'auth.checkEmailDesc':   'Eğer bu adres için hesap varsa',
    'auth.checkEmailDesc2':  ' adresine şifre sıfırlama bağlantısı gönderdik. Gelen kutunuzu ve spam klasörünüzü kontrol edin.',
    'auth.resetSteps':       'Sonraki adımlar',
    'auth.resetStep1':       'Financial Wisdom\'dan gelen sıfırlama e-postasını açın',
    'auth.resetStep2':       '"Şifremi Sıfırla" düğmesine tıklayın',
    'auth.resetStep3':       'Yeni şifrenizi belirleyin (bağlantı 1 saat geçerli)',
    'auth.resetPassword':    'Şifreyi Sıfırla',
    'auth.resetDesc':        'Yeni şifrenizi aşağıya girin.',
    'auth.newPassword':      'Yeni Şifre',
    'auth.confirmNewPass':   'Yeni Şifre Tekrar',
    'auth.resetBtn':         'Şifreyi Sıfırla',
    'auth.passwordUpdated':  'Şifre Güncellendi',
    'auth.passwordUpdatedDesc': 'Şifreniz başarıyla sıfırlandı. Artık yeni şifrenizle giriş yapabilirsiniz.',
    'auth.signIn':           'Giriş Yap →',
    'auth.invalidLink':      'Bu sıfırlama bağlantısı geçersiz veya süresi dolmuş.',
    'auth.passMin8':         'Şifre en az 8 karakter olmalıdır.',
    'auth.passMismatch':     'Şifreler eşleşmiyor.',

    // Register page
    'register.createAccount':  'Hesap Oluştur',
    'register.subtitle':       'Kişiselleştirilmiş portföyünüzü oluşturmaya başlayın',
    'register.step1':          'Hesabınızı oluşturun',
    'register.step2':          'E-posta adresinizi doğrulayın',
    'register.step3':          'Risk anketini doldurun (15 soru)',
    'register.step4':          'Kişiselleştirilmiş portföy önerinizi görüntüleyin',
    'register.howItWorks':     'NASIL ÇALIŞIR',
    'register.alreadyHave':    'Zaten hesabınız var mı?',
    'register.logIn':          'Giriş yap',
    'register.acceptTerms':    'Kullanım Koşullarını ve Gizlilik Politikasını kabul ediyorum',
    'register.fullNameReq':    'Ad soyad zorunludur.',
    'register.emailReq':       'E-posta adresi zorunludur.',
    'register.passMin8':       'Şifre en az 8 karakter olmalıdır.',
    'register.passMismatch':   'Şifreler eşleşmiyor.',
    'register.termsReq':       'Devam etmek için koşulları kabul etmelisiniz.',
    'register.verifyEmail':    'E-postanızı Doğrulayın',
    'register.verifyDesc':     'Doğrulama bağlantısı gönderildi:',
    'register.nextSteps':      'Sonraki adımlar',
    'register.checkInbox':     'Gelen kutunuzu kontrol edin (spam klasörüne de bakın)',
    'register.clickVerify':    '"E-postamı Doğrula" düğmesine tıklayın',
    'register.autoLogin':      'Otomatik olarak giriş yapılacak',
    'register.didntReceive':   'Gelmedi mi?',
    'register.resend':         'Tekrar Gönder',
    'register.backToLogin':    'Girişe Dön',
    'register.createBtn':      'Hesap Oluştur →',

    // Login page
    'login.welcomeBack':  'Tekrar hoş geldiniz',
    'login.subtitle':     'Hesabınıza giriş yapın',
    'login.signIn':       'Giriş Yap',
    'login.noAccount':    'henüz hesabınız yok mu?',
    'login.createFree':   'Ücretsiz Hesap Oluştur',
    'login.forgotPass':   'Şifremi unuttum?',
    'login.emailReq':     'E-posta zorunludur.',
    'login.passReq':      'Şifre zorunludur.',

    // Landing
    'landing.badge':      'Kişiselleştirilmiş Yatırım Zekası',
    'landing.hero1':      'Risk Profilinize Uygun',
    'landing.hero2':      'Portföy Oluşturun',
    'landing.heroDesc':   '15 soruyu yanıtlayın. Hisse, kripto, emtia ve daha fazlasını kapsayan kişiselleştirilmiş, açıklanabilir portföy önerisi alın. Kara kutu yok.',
    'landing.getStarted': 'Ücretsiz Başlayın →',
    'landing.howItWorks': 'Nasıl Çalışır',
    'landing.free':       '✓ Ücretsiz',
    'landing.noTrading':  '✓ İşlem gerekmez',
    'landing.explainable':'✓ Açıklanabilir öneriler',
    'landing.ctaTitle':   'Kişiselleştirilmiş portföyünüzü oluşturmaya hazır mısınız?',
    'landing.ctaDesc':    '5 dakikadan az sürer. Keşfetmek için hesap gerekmez.',
    'landing.ctaBtn':     'Portföyümü Oluştur →',
    'landing.feat1Title': 'Risk Anketi',
    'landing.feat1Desc':  '15 soru, risk toleransınızı ve yatırım vadenizi bağımsız olarak değerlendirir.',
    'landing.feat2Title': 'Faktör Tabanlı Seçim',
    'landing.feat2Desc':  'Araçlar momentum, değer, kalite ve volatilite faktörlerine göre sıralanır.',
    'landing.feat3Title': 'Açıklanabilir Kararlar',
    'landing.feat3Desc':  'Her dağılım için sade dilde bir gerekçe sunulur. Kara kutu yok.',

    // Admin
    'admin.momentum':     'Momentum',
    'admin.value':        'Değer',
    'admin.quality':      'Kalite',
    'admin.lowVolatility':'Düşük Volatilite',
    'admin.maxInstruments': 'Sınıf Başına Maks Araç',

    // Backtest Page
    'backtest.title':          'Portföy Validasyonu',
    'backtest.subtitle':       'Gerçek yfinance verisi · H1 analiz penceresi → H2 gerçek performans',
    'backtest.yourPortfolio':  'Portföyünüz',
    'backtest.profile':        'profil',
    'backtest.assets':         'varlık',
    'backtest.expectedReturn': 'Beklenen getiri:',
    'backtest.volatility':     'Volatilite:',
    'backtest.score':          'Portföy skoru:',
    'backtest.loading':        'Portföy yükleniyor…',
    'backtest.notFound':       'Portföy bulunamadı',
    'backtest.notFoundDesc':   'Validasyon için önce risk anketini doldurmanız gerekiyor. Anket sonucunda oluşturulan portföy otomatik olarak buraya yüklenir.',
    'backtest.goToQuest':      'Ankete git →',
    'backtest.calculate':      'Hesapla',
    'backtest.h2Return':       'H2 getirisi',
    'backtest.h2Sub':          'Tem–Ara gerçek fiyatlar',
    'backtest.h1Signal':       'H1 sinyali',
    'backtest.h1Sub':          'Oca–Haz analiz dönemi',
    'backtest.winners':        'Kazanan varlıklar',
    'backtest.sharpe':         'Sharpe (yaklaşık)',
    'backtest.maxDrawdown':    'Max düşüş:',
    'backtest.h1Period':       'H1 analiz dönemi',
    'backtest.h2Positive':     'H2 pozitif',
    'backtest.h2Negative':     'H2 negatif',
    'backtest.assetDetail':    'Varlık bazlı detay',
    'backtest.h1StartPrice':   'H1 başlangıç fiyat',
    'backtest.h1Return':       'H1 getiri',
    'backtest.h2ReturnCol':    'H2 getiri',
    'backtest.contribution':   'Portföye katkı',
    'backtest.totalH2':        'Toplam portföy H2 getirisi',
    'backtest.janJun':         'Oca–Haz analiz',
    'backtest.julDec':         'Tem–Ara validasyon',

    // Admin Page
    'admin.title':             'Admin Paneli',
    'admin.subtitle':          'Kullanıcı portföy kısıtları, sistem konfigürasyonu ve önbellek yönetimi',
    'admin.tabOverrides':      '👥 Kullanıcı Kısıtları',
    'admin.tabConfig':         '⚙️ Sistem Konfigürasyonu',
    'admin.tabCache':          '🗄️ Önbellek',
    'admin.newOverride':       'Yeni Portföy Kısıtı',
    'admin.addOverride':       '+ Kısıt Ekle',
    'admin.selectUser':        'Kullanıcı Seç',
    'admin.userNotFound':      'Kullanıcı bulunamadı',
    'admin.activeConstraints': 'aktif kısıt',
    'admin.minWeight':         'Min Ağırlık (%)',
    'admin.maxWeight':         'Maks Ağırlık (%)',
    'admin.minWeightDesc':     'Portföyde en az bu kadar yer alacak',
    'admin.maxWeightDesc':     'Portföyde en fazla bu kadar yer alacak',
    'admin.reason':            'Sebep (audit kaydı)',
    'admin.reasonPlaceholder': 'Bu kısıtı ekleme sebebinizi açıklayın (audit kaydı için)…',
    'admin.overrideNote':      'Bu kısıt portföy algoritmasını değiştirmez. Kullanıcı bir sonraki anket doldurduğunda algoritma normal çalışır ve sonuç bu kısıt bandına sıkıştırılır.',
    'admin.saveOverride':      'Kısıtı Kaydet',
    'admin.noOverrides':       'Henüz aktif bir portföy kısıtı yok.',
    'admin.confirmRemove':     'Bu kısıtı kaldırmak istediğinizden emin misiniz?',
    'admin.userSelect':        'Kullanıcı seçin',
    'admin.save':              'Kaydet',
    'admin.assetClass':        'Varlık Sınıfı',
    'admin.selectAsset':       'Varlık sınıfı seçin',

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
  const [theme, setTheme]       = useState<Theme>(getInitialTheme)
  const [language, setLanguage] = useState<Language>(getInitialLanguage)

  // Sistem teması değişirse (kullanıcı OS temasını değiştirirse) takip et
  // — ama sadece kullanıcı manuel seçim yapmamışsa
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem('fw-theme')
      if (!stored) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // dark class'ını <html>'e uygula
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
    // Update html lang attribute so CSS text-transform uses correct locale
    // (prevents Turkish İ/ı issue with uppercase CSS)
    document.documentElement.lang = language
  }, [language])

  const toggleTheme    = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  const toggleLanguage = () => setLanguage((l) => (l === 'en' ? 'tr' : 'en'))

  const t = (key: string): string =>
    translations[language][key] ?? translations['en'][key] ?? key

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
