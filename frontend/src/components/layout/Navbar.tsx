import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => { await logout(); navigate('/') }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors duration-200 ${isActive ? 'text-stone-900 underline underline-offset-4' : 'text-stone-500 hover:text-stone-900'}`

  return (
    <header className="sticky top-0 z-50 bg-stone-100/90 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <span className="text-xl">💰</span>
            <span className="font-display font-bold text-stone-900 text-lg">Financial Wisdom</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard"     className={navLinkClass}>Dashboard</NavLink>
                <NavLink to="/pool"          className={navLinkClass}>Market Pool</NavLink>  {/* ← NEW */}
                <NavLink to="/questionnaire" className={navLinkClass}>Questionnaire</NavLink>
                <NavLink to="/compare"       className={navLinkClass}>Compare</NavLink>
                {user?.role === 'admin' && (
                  <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>
                )}
              </>
            ) : (
              <>
                <a href="#about"       className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">About</a>
                <a href="#how-it-works" className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">How It Works</a>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="hidden sm:block text-sm text-stone-500">{user?.fullName?.split(' ')[0]}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Login</Button>
                <Button size="sm" onClick={() => navigate('/register')}>Sign Up Free</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
