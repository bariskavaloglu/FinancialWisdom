import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { useState, useRef, useEffect } from 'react'

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const { theme, language, toggleTheme, toggleLanguage, t } = useThemeLang()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setSettingsOpen(false)
    await logout()
    navigate('/')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors duration-200 ${
      isActive
        ? 'text-stone-900 dark:text-stone-100 underline underline-offset-4'
        : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
    }`

  const firstName = user?.fullName?.split(' ')[0] ?? ''
  const initials  = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-50 bg-stone-100/90 dark:bg-stone-950/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <span className="text-xl">💰</span>
            <span className="font-display font-bold text-stone-900 dark:text-stone-100 text-lg">
              Financial Wisdom
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-7">
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard"     className={navLinkClass}>{t('nav.dashboard')}</NavLink>
                <NavLink to="/pool"          className={navLinkClass}>{t('nav.marketPool')}</NavLink>
                <NavLink to="/questionnaire" className={navLinkClass}>{t('nav.questionnaire')}</NavLink>
                <NavLink to="/compare"       className={navLinkClass}>{t('nav.compare')}</NavLink>
                {user?.role === 'admin' && (
                  <NavLink to="/admin" className={navLinkClass}>{t('nav.admin')}</NavLink>
                )}
              </>
            ) : (
              <>
                <a href="#about"        className="text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">{t('nav.about')}</a>
                <a href="#how-it-works" className="text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">{t('nav.howItWorks')}</a>
              </>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              /* ─── User Settings Dropdown ─── */
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800/60 transition-colors group"
                >
                  {/* Avatar */}
                  <span className="w-8 h-8 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center text-xs font-bold shrink-0">
                    {initials}
                  </span>
                  <span className="hidden sm:block text-sm font-medium text-stone-700 dark:text-stone-300 max-w-[100px] truncate">
                    {firstName}
                  </span>
                  <span className={`text-stone-400 dark:text-stone-500 text-xs transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {/* Dropdown panel */}
                {settingsOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden animate-fade-in z-50">

                    {/* User info header */}
                    <div className="px-4 py-3.5 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center text-sm font-bold shrink-0">
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{user?.fullName}</p>
                          <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{user?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation items */}
                    <div className="py-1.5">
                      <button
                        onClick={() => { setSettingsOpen(false); navigate('/profile') }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left"
                      >
                        <span className="text-base">👤</span>
                        <span>{t('settings.profile')}</span>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-stone-100 dark:bg-stone-800 mx-3" />

                    {/* Preferences */}
                    <div className="py-1.5 px-2">
                      <p className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-2 py-1.5">
                        {t('settings.preferences')}
                      </p>

                      {/* Theme toggle */}
                      <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base">{theme === 'light' ? '🌙' : '☀️'}</span>
                          <span className="text-sm text-stone-700 dark:text-stone-300">
                            {theme === 'light' ? t('settings.darkMode') : t('settings.lightMode')}
                          </span>
                        </div>
                        {/* Toggle pill */}
                        <div className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 ${theme === 'dark' ? 'bg-stone-900 dark:bg-stone-100' : 'bg-stone-200 dark:bg-stone-700'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white dark:bg-stone-900 shadow transition-transform duration-200 ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </button>

                      {/* Language toggle */}
                      <button
                        onClick={toggleLanguage}
                        className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base">{language === 'tr' ? '🇬🇧' : '🇹🇷'}</span>
                          <span className="text-sm text-stone-700 dark:text-stone-300">
                            {language === 'tr' ? t('settings.switchToEn') : t('settings.switchToTr')}
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                          {language.toUpperCase()}
                        </span>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-stone-100 dark:bg-stone-800 mx-3" />

                    {/* Logout */}
                    <div className="py-1.5">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                      >
                        <span className="text-base">🚪</span>
                        <span>{t('nav.logout')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-ghost text-sm !px-4 !py-2"
                >
                  {t('nav.login')}
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="btn-primary text-sm !px-4 !py-2"
                >
                  {t('nav.signup')}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </header>
  )
}
