import {useState, useEffect} from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Alert, Spinner } from '@/components/ui/index'
import {
  QUESTIONS, CATEGORIES, CATEGORIES_TR,
  computeCompositeScore,
  getQuestionText, getQuestionOptions, getCategoryLabel, getHelpText,
} from '@/components/questionnaire/questions'
import { useSessionStorage } from '@/hooks/useSessionStorage'
import { assessmentService } from '@/services'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import type { QuestionnaireAnswer } from '@/types'

const QUESTIONS_PER_CATEGORY = 3 // 15 questions / 5 categories

export default function QuestionnairePage() {

  const { t, language } = useThemeLang()

  useEffect(() => { document.title = `${t('page.questionnaire')} | Financial Wisdom` }, [language, t])
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

  const categories = language === 'tr' ? CATEGORIES_TR : CATEGORIES

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
      setSubmitError(err instanceof Error ? err.message : t('common.loading').replace('…', '') + ' failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLastQuestion = currentQ === QUESTIONS.length - 1
  const hasAnsweredCurrent = !!currentAnswer
  const allAnswered = answers.length === QUESTIONS.length

  const questionText = getQuestionText(question, language)
  const options = getQuestionOptions(question, language)
  const helpText = getHelpText(question, language)
  const categoryLabel = getCategoryLabel(question.category, language)

  // i18n strings
  const lblQuestion      = language === 'tr' ? 'Soru' : 'Question'
  const lblOf            = language === 'tr' ? '/'    : 'of'
  const lblAnswered      = language === 'tr' ? 'yanıtlandı' : 'answered'
  const lblWhyAsked      = language === 'tr' ? 'Bu soru neden soruluyor?' : 'Why is this question asked?'
  const lblSelected      = language === 'tr' ? 'Seçildi' : 'Selected'
  const lblPrev          = language === 'tr' ? '← Önceki' : '← Previous'
  const lblNext          = language === 'tr' ? 'İleri →' : 'Next →'
  const lblCalc          = language === 'tr' ? 'Profili Hesapla →' : 'Calculate Profile →'
  const lblCalculating   = language === 'tr' ? 'Profiliniz hesaplanıyor' : 'Calculating your profile'
  const lblBuilding      = language === 'tr' ? 'Portföyünüz oluşturuluyor…' : 'Building your portfolio…'

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">

        {/* ── Step progress bar ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {categories.map((cat, i) => (
              <div key={cat} className="flex flex-col items-center gap-1.5 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                  i < categoryStep
                    ? 'bg-stone-900 border-stone-400 text-white'
                    : i === categoryStep
                    ? 'border-stone-400 dark:border-stone-500 text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-700'
                    : 'border-stone-200 text-stone-400 bg-transparent'
                }`}>
                  {i < categoryStep ? '✓' : i + 1}
                </div>
                <span className={`text-xs hidden sm:block text-center leading-tight ${
                  i === categoryStep ? 'text-stone-900 dark:text-stone-100' : i < categoryStep ? 'text-stone-500 dark:text-stone-400' : 'text-stone-300 dark:text-stone-600'
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
          <div role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress: question ${currentQ + 1} of ${QUESTIONS.length}`} className="h-1 bg-stone-50 dark:bg-stone-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-900 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-stone-400 mt-2 text-right">
            {lblQuestion} {currentQ + 1} {lblOf} {QUESTIONS.length}
          </p>
        </div>

        {/* ── Question card ── */}
        <div className="card animate-slide-up" key={currentQ}>
          {/* Category label */}
          <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">
            {categoryLabel} · {lblQuestion} {questionInCategory} {lblOf} {QUESTIONS_PER_CATEGORY}
          </p>

          {/* Question text */}
          <h2 className="text-xl font-medium text-stone-900 dark:text-stone-100 leading-snug mb-6">
            {questionText}
          </h2>

          {/* Options */}
              {/* aria-label on each option button is applied below via aria-pressed */}
          <div role="radiogroup" aria-label={questionText} className="space-y-3 mb-6">
            {options.map((option, i) => {
              const isSelected = currentAnswer?.selectedOption === i
              return (
                <button
                  key={i}
                  onClick={() => selectOption(i)}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={option}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 group ${
                    isSelected
                      ? 'border-stone-400 dark:border-stone-500 bg-stone-100 dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                      : 'border-stone-200 dark:border-stone-600 bg-stone-50/50 dark:bg-stone-800/50 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800'
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
                      <span className="ml-auto text-xs font-medium text-stone-900 dark:text-stone-100 bg-stone-200 dark:bg-stone-600 px-2 py-0.5 rounded-full">
                        {lblSelected}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Help tooltip */}
          {helpText && (
            <div className="mb-4">
              <button
                className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                onClick={() => setShowHelp(!showHelp)}
                aria-expanded={showHelp}
                aria-label="Why is this question asked?"
              >
                <span>💡</span> {lblWhyAsked}
              </button>
              {showHelp && (
                <div className="mt-2 px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-500 leading-relaxed animate-fade-in">
                  {helpText}
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
              {lblPrev}
            </Button>

            <span className="text-xs text-stone-300 font-mono">
              {answers.length} {lblOf} {QUESTIONS.length} {lblAnswered}
            </span>

            {isLastQuestion ? (
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || isSubmitting}
                isLoading={isSubmitting}
              >
                {lblCalc}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={!hasAnsweredCurrent}
              >
                {lblNext}
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
                <p className="text-stone-900 font-medium">{lblCalculating}</p>
                <p className="text-stone-500 text-sm mt-1">{lblBuilding}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
