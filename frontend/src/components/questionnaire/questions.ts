export interface Question {
  id: number
  category: string
  categoryIndex: number // 0-4 (which of the 5 steps)
  text: string
  helpText?: string
  options: string[]
}

export const CATEGORIES = [
  'Financial Goals',
  'Risk Tolerance',
  'Loss Tolerance',
  'Investment Horizon',
  'Liquidity',
]

export const QUESTIONS: Question[] = [
  // ── Financial Goals (Cat 0) ───────────────────────────────────
  {
    id: 1, category: 'Financial Goals', categoryIndex: 0,
    text: 'What is your primary objective for investing?',
    helpText: 'Your goal shapes the entire portfolio strategy.',
    options: [
      'Protect my savings from inflation',
      'Generate stable, regular income',
      'Build long-term wealth',
      'Aggressive growth and maximum returns',
    ],
  },
  {
    id: 2, category: 'Financial Goals', categoryIndex: 0,
    text: 'What annual return do you realistically expect from your investments?',
    options: [
      '0–5% (low risk, low return)',
      '5–10% (moderate risk, moderate return)',
      '10–20% (higher risk, higher return)',
      '20%+ (very high risk, maximum return)',
    ],
  },
  {
    id: 3, category: 'Financial Goals', categoryIndex: 0,
    text: 'What percentage of your total savings do you plan to invest through this platform?',
    options: [
      'Less than 10%',
      '10–25%',
      '25–50%',
      'More than 50%',
    ],
  },
  // ── Risk Tolerance (Cat 1) ────────────────────────────────────
  {
    id: 4, category: 'Risk Tolerance', categoryIndex: 1,
    text: 'How would you describe your overall attitude toward investing?',
    options: [
      'Very cautious — I cannot afford to lose any principal',
      'Somewhat cautious — I can take some risk but want to minimise losses',
      'Moderate — I accept mid-level risk for better returns',
      'Aggressive — I am comfortable with high risk for maximum gains',
    ],
  },
  {
    id: 5, category: 'Risk Tolerance', categoryIndex: 1,
    text: 'What is your view on highly volatile assets such as cryptocurrency?',
    options: [
      'I would never invest — far too risky',
      'A small position is fine (up to 5%)',
      'It can form a meaningful part of my portfolio (10–20%)',
      'I would invest aggressively (20%+)',
    ],
  },
  {
    id: 6, category: 'Risk Tolerance', categoryIndex: 1,
    text: 'What is your level of experience with financial markets?',
    options: [
      'Beginner — I do not follow markets',
      'Basic — I understand fundamental concepts',
      'Intermediate — I understand stocks and funds',
      'Advanced — I am familiar with technical analysis and derivatives',
    ],
  },
  // ── Loss Tolerance (Cat 2) ────────────────────────────────────
  {
    id: 7, category: 'Loss Tolerance', categoryIndex: 2,
    text: 'If your portfolio dropped 20% in a single month, what would you do?',
    helpText: 'Loss tolerance is a key dimension of your risk profile.',
    options: [
      'Sell everything immediately — I cannot bear further losses',
      'Wait and observe — markets usually recover',
      'Buy more at the lower price — I see it as an opportunity',
      'Not concerned — I only invest money I can afford to lose',
    ],
  },
  {
    id: 8, category: 'Loss Tolerance', categoryIndex: 2,
    text: 'What is the maximum loss you could tolerate in your portfolio?',
    options: [
      'Up to 5%',
      '5–15%',
      '15–30%',
      '30%+ is acceptable over the long term',
    ],
  },
  {
    id: 9, category: 'Loss Tolerance', categoryIndex: 2,
    text: 'Have you experienced a significant investment loss in the past?',
    options: [
      'No — and it would seriously concern me',
      'No — but I believe I could handle it',
      'Yes — recovery took time but I got through it',
      'Yes — I accept losses as part of how markets work',
    ],
  },
  // ── Investment Horizon (Cat 3) ────────────────────────────────
  {
    id: 10, category: 'Investment Horizon', categoryIndex: 3,
    text: 'How long do you plan to hold the investments in this portfolio?',
    options: [
      'Less than 1 year (short term)',
      '1–5 years (medium term)',
      '5–10 years (long term)',
      'More than 10 years (very long term)',
    ],
  },
  {
    id: 11, category: 'Investment Horizon', categoryIndex: 3,
    text: 'How likely are you to need this money within the next 1–2 years?',
    options: [
      'Very likely — I may need it soon',
      'Possible — maybe',
      'Unlikely — I have no plans to withdraw',
      'Not at all — this money is fully committed',
    ],
  },
  {
    id: 12, category: 'Investment Horizon', categoryIndex: 3,
    text: 'Which life stage best describes you?',
    options: [
      'Near retirement — capital preservation is my priority',
      'Mid-career — I want both growth and stability',
      'Early career — I am growth-focused',
      'Young investor — I am targeting aggressive long-term growth',
    ],
  },
  // ── Liquidity (Cat 4) ─────────────────────────────────────────
  {
    id: 13, category: 'Liquidity', categoryIndex: 4,
    text: 'Do you have an emergency fund covering 3–6 months of expenses?',
    options: [
      'No emergency fund at all',
      'Partial — about 1–2 months of expenses',
      'Yes — I have a 3–6 month emergency fund',
      'Yes — and it is kept entirely separate from this investment',
    ],
  },
  {
    id: 14, category: 'Liquidity', categoryIndex: 4,
    text: 'How likely is it that you will need to withdraw from this portfolio on short notice?',
    options: [
      'Likely — I may need liquidity at any time',
      'Possible — occasionally',
      'Unlikely — I have no planned withdrawals',
      'Not at all — this capital can be considered locked in',
    ],
  },
  {
    id: 15, category: 'Liquidity', categoryIndex: 4,
    text: 'Are you able to make regular monthly contributions to this portfolio?',
    options: [
      'No — this is a one-time investment',
      'Maybe — depends on circumstances',
      'Yes — small but consistent additions',
      'Yes — I can contribute a meaningful amount each month',
    ],
  },
]

/** Returns score 0–3 for an answer (used to compute composite score) */
export function scoreAnswer(questionId: number, optionIndex: number): number {
  return optionIndex
}

/** Compute composite score 0–100 from all answers */
export function computeCompositeScore(answers: { questionId: number; selectedOption: number }[]): number {
  if (answers.length === 0) return 0
  const total = answers.reduce((sum, a) => sum + scoreAnswer(a.questionId, a.selectedOption), 0)
  const maxPossible = answers.length * 3
  return Math.round((total / maxPossible) * 100)
}
