import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const { theme, language, toggleTheme, toggleLanguage, t } = useThemeLang()
  const navigate  = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => { await logout(); navigate('/') }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors duration-200 ${
      isActive
        ? 'text-stone-900 dark:text-stone-100 underline underline-offset-4'
        : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
    }`

  return (
    <header className="sticky top-0 z-50 bg-stone-100/90 dark:bg-stone-950/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <span className="text-xl">💰</span>
            <span className="font-display font-bold text-stone-900 dark:text-stone-100 text-lg">Financial Wisdom</span>
          </Link>

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

          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              title={language === 'en' ? 'Türkçeye geç' : 'Switch to English'}
            >
              {language === 'en' ? '🇹🇷 TR' : '🇬🇧 EN'}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {isAuthenticated ? (
              <>
                <span className="hidden sm:block text-sm text-stone-500 dark:text-stone-400 ml-1">{user?.fullName?.split(' ')[0]}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>{t('nav.logout')}</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>{t('nav.login')}</Button>
                <Button size="sm" onClick={() => navigate('/register')}>{t('nav.signup')}</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
