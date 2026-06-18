import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Disclaimer } from '@/components/ui/index'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import type { AssessmentResult } from '@/types'

export default function ProfileResultPage() {

  const navigate = useNavigate()
  const { t, language} = useThemeLang()

  useEffect(() => { document.title = `${t('page.profileResult')} | Financial Wisdom` }, [language, t])
  const location = useLocation()
  const result = (location.state as { result?: AssessmentResult })?.result

  const PROFILE_INFO = {
    conservative: { icon: '🛡', color: 'text-blue-400' },
    balanced:     { icon: '⚖', color: 'text-stone-900 dark:text-stone-100' },
    aggressive:   { icon: '🚀', color: 'text-red-400' },
  }

  if (!result) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto text-center py-24">
          <p className="text-stone-500 mb-4">{t('common.noData')}</p>
          <Button onClick={() => navigate('/questionnaire')}>{t('result.retake')}</Button>
        </div>
      </AppLayout>
    )
  }

  const profile = PROFILE_INFO[result.profileType]

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="card text-center space-y-4">
          <div className="text-5xl">{profile.icon}</div>
          <h1 className="font-display text-3xl text-stone-900 dark:text-stone-100">{t('banner.recommendation')}</h1>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className={`text-xl font-medium ${profile.color}`}>{t(`profile.${result.profileType}`)}</span>
            <span className="text-stone-300">+</span>
            <span className="text-stone-600 dark:text-stone-400">{t(`horizon.${result.investmentHorizon}Label`)}</span>
          </div>
          <p className="text-stone-500 text-sm max-w-sm mx-auto">{t(`profile.${result.profileType}Desc`)}</p>
        </div>

        <div className="card space-y-3">
          <p className="text-xs text-stone-400 uppercase tracking-widest">{t('result.scoreSummary')}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">{t('result.compositeScore')}</span>
              <span className="text-stone-900 dark:text-stone-100 font-mono">{result.compositeScore} / 100</span>
            </div>
            <div className="h-1.5 bg-stone-50 dark:bg-stone-700 rounded-full">
              <div className="h-full bg-stone-900 dark:bg-stone-100 rounded-full transition-all" style={{ width: `${result.compositeScore}%` }} />
            </div>
          </div>
        </div>

        {result.explanation && (
          <div className="card">
            <p className="text-xs text-stone-400 uppercase tracking-widest mb-2">{t('banner.whyThis')}</p>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">{result.explanation}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/questionnaire')}>
            {t('result.retake')}
          </Button>
          <Button className="flex-1" onClick={() => navigate('/dashboard')}>
            {t('result.viewPortfolio')}
          </Button>
        </div>

        <Disclaimer />
      </div>
    </AppLayout>
  )
}
