import { useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'

const FEATURES = [
  { icon: '📊', title: 'Risk Questionnaire', desc: '15 questions assess your risk tolerance and investment horizon independently.' },
  { icon: '🔍', title: 'Factor-Based Selection', desc: 'Instruments ranked by momentum, value, quality & volatility factors.' },
  { icon: '💡', title: 'Explainable Decisions', desc: 'Every allocation comes with a plain-language reason. No black boxes.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      <Navbar />

      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center px-6 py-20 max-w-4xl mx-auto w-full">
        <div className="animate-slide-up space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-stone-300 bg-white text-stone-600 text-sm font-medium">
            <span>✦</span> Personalized Investment Intelligence
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-stone-900 leading-tight">
            Build a Portfolio That<br />
            Matches Your Risk Profile
          </h1>
          <p className="text-lg text-stone-500 max-w-xl leading-relaxed">
            Answer 15 questions. Get a personalized, explainable portfolio recommendation
            across stocks, crypto, commodities & more. No black boxes.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Button size="lg" onClick={() => navigate('/register')}>Get Started Free →</Button>
            <Button size="lg" variant="secondary" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              See How It Works
            </Button>
          </div>
          <div className="flex items-center gap-6 text-sm text-stone-400 pt-1">
            <span>✓ Free</span>
            <span>✓ No trading required</span>
            <span>✓ Explainable recommendations</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="px-6 pb-16 max-w-4xl mx-auto w-full">
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="card-hover">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-stone-900 mb-2">{f.title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bar */}
      <section className="mx-6 mb-10 max-w-4xl mx-auto w-full px-6">
        <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-stone-900">Ready to build your personalized portfolio?</p>
            <p className="text-sm text-stone-400 mt-0.5">Takes less than 5 minutes. No account required to explore.</p>
          </div>
          <Button onClick={() => navigate('/register')} className="flex-shrink-0">Create My Portfolio →</Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-5 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between text-xs text-stone-400 gap-1">
          <span>© 2026 Financial Wisdom · Şile Işık Üniversitesi</span>
          <span>⚠ For educational purposes only. Not financial advice.</span>
        </div>
      </footer>
    </div>
  )
}
