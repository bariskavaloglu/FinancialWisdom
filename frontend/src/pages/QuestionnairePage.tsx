import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Alert, Spinner } from '@/components/ui/index'
import { QUESTIONS, CATEGORIES, computeCompositeScore } from '@/components/questionnaire/questions'
import { useSessionStorage } from '@/hooks/useSessionStorage'
import { assessmentService } from '@/services'
import type { QuestionnaireAnswer } from '@/types'

const QUESTIONS_PER_CATEGORY = 3 // 15 questions / 5 categories

export default function QuestionnairePage() {
  const navigate = useNavigate()

  // UC-03: Preserve partial answers on browser refresh (RAD requirement)
  const [answers, setAnswers, clearAnswers] = useSessionStorage<QuestionnaireAnswer[]>(
    'fw-questionnaire-answers', []
  )

  const [currentQ, setCurrentQ] = useState(() => {
    // Resume from last answered question
    return Math.min(answers.length, QUESTIONS.length - 1)
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const question = QUESTIONS[currentQ]
  const currentAnswer = answers.find((a) => a.questionId === question.id)
  const categoryStep = question.categoryIndex // 0–4
  const questionInCategory = currentQ - categoryStep * QUESTIONS_PER_CATEGORY + 1
  const progress = ((currentQ) / QUESTIONS.length) * 100

  const selectOption = (optionIndex: number) => {
    const updated = answers.filter((a) => a.questionId !== question.id)
    updated.push({ questionId: question.id, selectedOption: optionIndex })
    setAnswers(updated)
  }

  const goNext = () => {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1)
      setShowHelp(false)
    }
  }

  const goPrev = () => {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1)
      setShowHelp(false)
    }
  }

  const handleSubmit = async () => {
    if (answers.length < QUESTIONS.length) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const result = await assessmentService.submit({ answers })
      clearAnswers()
      navigate('/profile/result', { state: { result } })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Gönderim başarısız. Lütfen tekrar deneyin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLastQuestion = currentQ === QUESTIONS.length - 1
  const hasAnsweredCurrent = !!currentAnswer
  const allAnswered = answers.length === QUESTIONS.length

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">

        {/* ── Step progress bar ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {CATEGORIES.map((cat, i) => (
              <div key={cat} className="flex flex-col items-center gap-1.5 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                  i < categoryStep
                    ? 'bg-stone-900 border-stone-400 text-white'
                    : i === categoryStep
                    ? 'border-stone-400 text-stone-900 bg-stone-100'
                    : 'border-stone-200 text-stone-400 bg-transparent'
                }`}>
                  {i < categoryStep ? '✓' : i + 1}
                </div>
                <span className={`text-xs hidden sm:block text-center leading-tight ${
                  i === categoryStep ? 'text-stone-900' : i < categoryStep ? 'text-stone-500' : 'text-stone-300'
                }`}>
                  {cat}
                </span>
                {/* Connector line */}
                {i < CATEGORIES.length - 1 && (
                  <div className="absolute hidden" /> // handled via flex gap
                )}
              </div>
            ))}
          </div>
          {/* Linear progress */}
          <div className="h-1 bg-stone-50 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-900 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-stone-400 mt-2 text-right">
            Soru {currentQ + 1} / {QUESTIONS.length}
          </p>
        </div>

        {/* ── Question card ── */}
        <div className="card animate-slide-up" key={currentQ}>
          {/* Category label */}
          <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">
            {question.category} · Soru {questionInCategory} / {QUESTIONS_PER_CATEGORY}
          </p>

          {/* Question text */}
          <h2 className="text-xl font-medium text-stone-900 leading-snug mb-6">
            {question.text}
          </h2>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {question.options.map((option, i) => {
              const isSelected = currentAnswer?.selectedOption === i
              return (
                <button
                  key={i}
                  onClick={() => selectOption(i)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 group ${
                    isSelected
                      ? 'border-stone-400 bg-stone-100 text-stone-900'
                      : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:border-stone-300 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      isSelected ? 'border-stone-400 bg-stone-900' : 'border-white/30'
                    }`}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-stone-100" />}
                    </span>
                    <span className="text-sm leading-snug">{option}</span>
                    {isSelected && (
                      <span className="ml-auto text-xs font-medium text-stone-900 bg-stone-200 px-2 py-0.5 rounded-full">
                        Seçildi
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Help tooltip */}
          {question.helpText && (
            <div className="mb-4">
              <button
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-900 transition-colors"
                onClick={() => setShowHelp(!showHelp)}
              >
                <span>💡</span> Bu soru neden soruluyor?
              </button>
              {showHelp && (
                <div className="mt-2 px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-500 leading-relaxed animate-fade-in">
                  {question.helpText}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-stone-200">
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={currentQ === 0}
            >
              ← Önceki
            </Button>

            <span className="text-xs text-stone-300 font-mono">
              {answers.length}/{QUESTIONS.length} cevaplandı
            </span>

            {isLastQuestion ? (
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || isSubmitting}
                isLoading={isSubmitting}
              >
                Profili Hesapla →
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={!hasAnsweredCurrent}
              >
                Sonraki →
              </Button>
            )}
          </div>
        </div>

        {submitError && (
          <div className="mt-4">
            <Alert variant="error">{submitError}</Alert>
          </div>
        )}

        {/* Submitting overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-stone-100/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="card text-center space-y-4 w-64">
              <Spinner size="lg" />
              <div>
                <p className="text-stone-900 font-medium">Profiliniz hesaplanıyor</p>
                <p className="text-stone-500 text-sm mt-1">Portföy oluşturuluyor…</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
