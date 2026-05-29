import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { useThemeLang } from '@/context/ThemeLanguageContext'

export default function NotFoundPage() {

  const navigate = useNavigate()
  const { language, t } = useThemeLang()

  useEffect(() => { document.title = `${t('page.notFound')} | Financial Wisdom` }, [language, t])
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="font-mono text-6xl font-bold text-stone-900/30 dark:text-stone-100/20 mb-4">404</p>
        <h1 className="font-display text-2xl text-stone-900 dark:text-stone-100 mb-2">
          {language === 'tr' ? 'Sayfa bulunamadı' : 'Page not found'}
        </h1>
        <p className="text-stone-500 text-sm mb-8">
          {language === 'tr' ? 'Aradığınız sayfa mevcut değil.' : 'The page you are looking for does not exist.'}
        </p>
        <Button onClick={() => navigate('/')}>
          {language === 'tr' ? 'Ana Sayfaya Dön' : 'Back to Home'}
        </Button>
      </div>
    </AppLayout>
  )
}
