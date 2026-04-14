import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="font-mono text-6xl font-bold text-stone-900/30 mb-4">404</p>
        <h1 className="font-display text-2xl text-stone-900 mb-2">Sayfa bulunamadı</h1>
        <p className="text-stone-500 text-sm mb-8">Aradığınız sayfa mevcut değil.</p>
        <Button onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
      </div>
    </AppLayout>
  )
}
