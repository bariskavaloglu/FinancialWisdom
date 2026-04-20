import { useLocation, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Disclaimer } from '@/components/ui/index'
import type { AssessmentResult } from '@/types'

const PROFILE_INFO = {
  conservative: { icon: '🛡', label: 'Conservative', color: 'text-blue-400', desc: 'Capital preservation is your priority. Low-risk, liquid instruments are recommended.' },
  balanced:     { icon: '⚖', label: 'Balanced',     color: 'text-stone-900',  desc: 'You balance growth and capital protection.' },
  aggressive:   { icon: '🚀', label: 'Aggressive',   color: 'text-red-400',  desc: 'You target maximum growth with a high risk tolerance.' },
}

const HORIZON_LABEL = { short: 'Short-term (0–1 yr)', medium: 'Medium-term (1–5 yr)', long: 'Long-term (5+ yr)' }

export default function ProfileResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const result = (location.state as { result?: AssessmentResult })?.result

  if (!result) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto text-center py-24">
          <p className="text-stone-500 mb-4">No result found.</p>
          <Button onClick={() => navigate('/questionnaire')}>Retake Questionnaire</Button>
        </div>
      </AppLayout>
    )
  }

  const profile = PROFILE_INFO[result.profileType]

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Profile card */}
        <div className="card text-center space-y-4">
          <div className="text-5xl">{profile.icon}</div>
          <h1 className="font-display text-3xl text-stone-900">Your Investor Profile</h1>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className={`text-xl font-medium ${profile.color}`}>{profile.label}</span>
            <span className="text-stone-300">+</span>
            <span className="text-stone-600">{HORIZON_LABEL[result.investmentHorizon]}</span>
          </div>
          <p className="text-stone-500 text-sm max-w-sm mx-auto">{profile.desc}</p>
        </div>

        {/* Score breakdown */}
        <div className="card space-y-3">
          <p className="text-xs text-stone-400 uppercase tracking-widest">Score Summary</p>
          {[
            { label: 'Composite Score', value: result.compositeScore },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">{label}</span>
                <span className="text-stone-900 font-mono">{value} / 100</span>
              </div>
              <div className="h-1.5 bg-stone-50 rounded-full">
                <div className="h-full bg-stone-900 rounded-full transition-all" style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Explanation */}
        {result.explanation && (
          <div className="card">
            <p className="text-xs text-stone-400 uppercase tracking-widest mb-2">Explanation</p>
            <p className="text-stone-600 text-sm leading-relaxed">{result.explanation}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => navigate('/questionnaire')}>
            Retake Questionnaire
          </Button>
          <Button className="flex-1" onClick={() => navigate('/dashboard')}>
            View My Portfolio →
          </Button>
        </div>

        <Disclaimer />
      </div>
    </AppLayout>
  )
}
