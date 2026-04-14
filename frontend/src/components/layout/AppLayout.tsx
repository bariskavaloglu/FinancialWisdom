import { Navbar } from './Navbar'

interface AppLayoutProps {
  children: React.ReactNode
  fullWidth?: boolean
}

export function AppLayout({ children, fullWidth = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      <Navbar />
      <main className={`flex-1 py-8 px-4 sm:px-6 lg:px-8 ${fullWidth ? '' : 'max-w-7xl mx-auto w-full'}`}>
        {children}
      </main>
      <footer className="border-t border-stone-200 py-6 px-4 bg-stone-100">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-stone-400">
          <span>© 2026 Financial Wisdom · Şile Işık Üniversitesi</span>
          <span>⚠ For educational purposes only. Not financial advice.</span>
        </div>
      </footer>
    </div>
  )
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      <Navbar />
      <main className="flex-1 flex items-start justify-center px-4 py-12">
        {children}
      </main>
    </div>
  )
}
