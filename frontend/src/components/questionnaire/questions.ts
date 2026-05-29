import type { Language } from '@/context/ThemeLanguageContext'

export interface Question {
  id: number
  category: string
  categoryIndex: number // 0-4 (which of the 5 steps)
  text: string
  textTr: string
  helpText?: string
  helpTextTr?: string
  options: string[]
  optionsTr: string[]
}

export const CATEGORIES = [
  'Financial Goals',
  'Risk Tolerance',
  'Loss Tolerance',
  'Investment Horizon',
  'Liquidity',
]

export const CATEGORIES_TR = [
  'Finansal Hedefler',
  'Risk Toleransı',
  'Kayıp Toleransı',
  'Yatırım Vadesi',
  'Likidite',
]

export const QUESTIONS: Question[] = [
  // ── Financial Goals (Cat 0) ───────────────────────────────────
  {
    id: 1, category: 'Financial Goals', categoryIndex: 0,
    text: 'What is your primary objective for investing?',
    textTr: 'Yatırımınızdan temel amacınız nedir?',
    helpText: 'Your goal shapes the entire portfolio strategy.',
    helpTextTr: 'Hedefiniz tüm portföy stratejisini belirler.',
    options: [
      'Protect my savings from inflation',
      'Generate stable, regular income',
      'Build long-term wealth',
      'Aggressive growth and maximum returns',
    ],
    optionsTr: [
      'Birikimlerimi enflasyona karşı korumak',
      'İstikrarlı, düzenli gelir elde etmek',
      'Uzun vadeli servet oluşturmak',
      'Agresif büyüme ve maksimum getiri',
    ],
  },
  {
    id: 2, category: 'Financial Goals', categoryIndex: 0,
    text: 'What annual return do you realistically expect from your investments?',
    textTr: 'Yatırımlarınızdan gerçekçi olarak beklediğiniz yıllık getiri nedir?',
    options: [
      '0–5% (low risk, low return)',
      '5–10% (moderate risk, moderate return)',
      '10–20% (higher risk, higher return)',
      '20%+ (very high risk, maximum return)',
    ],
    optionsTr: [
      '%0–5 (düşük risk, düşük getiri)',
      '%5–10 (orta risk, orta getiri)',
      '%10–20 (yüksek risk, yüksek getiri)',
      '%20+ (çok yüksek risk, maksimum getiri)',
    ],
  },
  {
    id: 3, category: 'Financial Goals', categoryIndex: 0,
    text: 'What percentage of your total savings do you plan to invest through this platform?',
    textTr: 'Toplam birikimlerinizin yüzde kaçını bu platform üzerinden yatırmayı planlıyorsunuz?',
    options: [
      'Less than 10%',
      '10–25%',
      '25–50%',
      'More than 50%',
    ],
    optionsTr: [
      '%10\'dan az',
      '%10–25',
      '%25–50',
      '%50\'den fazla',
    ],
  },
  // ── Risk Tolerance (Cat 1) ────────────────────────────────────
  {
    id: 4, category: 'Risk Tolerance', categoryIndex: 1,
    text: 'How would you describe your overall attitude toward investing?',
    textTr: 'Yatırıma genel yaklaşımınızı nasıl tanımlarsınız?',
    options: [
      'Very cautious — I cannot afford to lose any principal',
      'Somewhat cautious — I can take some risk but want to minimise losses',
      'Moderate — I accept mid-level risk for better returns',
      'Aggressive — I am comfortable with high risk for maximum gains',
    ],
    optionsTr: [
      'Çok temkinli — Anaparamı kaybetmeyi göze alamam',
      'Biraz temkinli — Bir miktar risk alabilirim ama kayıpları minimize etmek isterim',
      'Orta düzey — Daha iyi getiri için orta düzey riski kabul ederim',
      'Agresif — Maksimum kazanç için yüksek riskle rahatım',
    ],
  },
  {
    id: 5, category: 'Risk Tolerance', categoryIndex: 1,
    text: 'What is your view on highly volatile assets such as cryptocurrency?',
    textTr: 'Kripto para gibi yüksek volatiliteli varlıklara bakış açınız nedir?',
    options: [
      'I would never invest — far too risky',
      'A small position is fine (up to 5%)',
      'It can form a meaningful part of my portfolio (10–20%)',
      'I would invest aggressively (20%+)',
    ],
    optionsTr: [
      'Asla yatırım yapmam — çok riskli',
      'Küçük bir pozisyon olabilir (en fazla %5)',
      'Portföyümün anlamlı bir parçası olabilir (%10–20)',
      'Agresif şekilde yatırım yapardım (%20+)',
    ],
  },
  {
    id: 6, category: 'Risk Tolerance', categoryIndex: 1,
    text: 'What is your level of experience with financial markets?',
    textTr: 'Finansal piyasalardaki deneyim düzeyiniz nedir?',
    options: [
      'Beginner — I do not follow markets',
      'Basic — I understand fundamental concepts',
      'Intermediate — I understand stocks and funds',
      'Advanced — I am familiar with technical analysis and derivatives',
    ],
    optionsTr: [
      'Başlangıç — Piyasaları takip etmiyorum',
      'Temel — Temel kavramları anlıyorum',
      'Orta — Hisse senetleri ve fonları anlıyorum',
      'İleri — Teknik analiz ve türevlere aşinayım',
    ],
  },
  // ── Loss Tolerance (Cat 2) ────────────────────────────────────
  {
    id: 7, category: 'Loss Tolerance', categoryIndex: 2,
    text: 'If your portfolio dropped 20% in a single month, what would you do?',
    textTr: 'Portföyünüz tek bir ayda %20 düşseydi ne yapardınız?',
    helpText: 'Loss tolerance is a key dimension of your risk profile.',
    helpTextTr: 'Kayıp toleransı, risk profilinizin temel bir boyutudur.',
    options: [
      'Sell everything immediately — I cannot bear further losses',
      'Wait and observe — markets usually recover',
      'Buy more at the lower price — I see it as an opportunity',
      'Not concerned — I only invest money I can afford to lose',
    ],
    optionsTr: [
      'Her şeyi hemen satarım — daha fazla kayba dayanamam',
      'Bekler ve izlerim — piyasalar genellikle toparlar',
      'Düşük fiyattan daha fazla alırım — fırsat olarak görürüm',
      'Endişelenmem — sadece kaybetmeyi göze aldığım parayı yatırıyorum',
    ],
  },
  {
    id: 8, category: 'Loss Tolerance', categoryIndex: 2,
    text: 'What is the maximum loss you could tolerate in your portfolio?',
    textTr: 'Portföyünüzde tolere edebileceğiniz maksimum kayıp nedir?',
    options: [
      'Up to 5%',
      '5–15%',
      '15–30%',
      '30%+ is acceptable over the long term',
    ],
    optionsTr: [
      '%5\'e kadar',
      '%5–15',
      '%15–30',
      'Uzun vadede %30+ kabul edilebilir',
    ],
  },
  {
    id: 9, category: 'Loss Tolerance', categoryIndex: 2,
    text: 'Have you experienced a significant investment loss in the past?',
    textTr: 'Geçmişte önemli bir yatırım kaybı yaşadınız mı?',
    options: [
      'No — and it would seriously concern me',
      'No — but I believe I could handle it',
      'Yes — recovery took time but I got through it',
      'Yes — I accept losses as part of how markets work',
    ],
    optionsTr: [
      'Hayır — ve bu beni ciddi şekilde endişelendirirdi',
      'Hayır — ama üstesinden gelebileceğime inanıyorum',
      'Evet — toparlanmak zaman aldı ama atlattım',
      'Evet — kayıpları piyasaların işleyişinin bir parçası olarak kabul ediyorum',
    ],
  },
  // ── Investment Horizon (Cat 3) ────────────────────────────────
  {
    id: 10, category: 'Investment Horizon', categoryIndex: 3,
    text: 'How long do you plan to hold the investments in this portfolio?',
    textTr: 'Bu portföydeki yatırımları ne kadar süre tutmayı planlıyorsunuz?',
    options: [
      'Less than 1 year (short term)',
      '1–5 years (medium term)',
      '5–10 years (long term)',
      'More than 10 years (very long term)',
    ],
    optionsTr: [
      '1 yıldan az (kısa vade)',
      '1–5 yıl (orta vade)',
      '5–10 yıl (uzun vade)',
      '10 yıldan fazla (çok uzun vade)',
    ],
  },
  {
    id: 11, category: 'Investment Horizon', categoryIndex: 3,
    text: 'How likely are you to need this money within the next 1–2 years?',
    textTr: 'Önümüzdeki 1–2 yıl içinde bu paraya ihtiyaç duyma olasılığınız nedir?',
    options: [
      'Very likely — I may need it soon',
      'Possible — maybe',
      'Unlikely — I have no plans to withdraw',
      'Not at all — this money is fully committed',
    ],
    optionsTr: [
      'Çok olası — yakında ihtiyacım olabilir',
      'Mümkün — belki',
      'Olası değil — çekme planım yok',
      'Hiç değil — bu para tamamen taahhüt edildi',
    ],
  },
  {
    id: 12, category: 'Investment Horizon', categoryIndex: 3,
    text: 'Which life stage best describes you?',
    textTr: 'Hangi yaşam evresi sizi en iyi tanımlar?',
    options: [
      'Near retirement — capital preservation is my priority',
      'Mid-career — I want both growth and stability',
      'Early career — I am growth-focused',
      'Young investor — I am targeting aggressive long-term growth',
    ],
    optionsTr: [
      'Emekliliğe yakın — sermaye koruma önceliğim',
      'Kariyerimin ortasında — hem büyüme hem istikrar istiyorum',
      'Kariyerimin başında — büyüme odaklıyım',
      'Genç yatırımcı — agresif uzun vadeli büyüme hedefliyorum',
    ],
  },
  // ── Liquidity (Cat 4) ─────────────────────────────────────────
  {
    id: 13, category: 'Liquidity', categoryIndex: 4,
    text: 'Do you have an emergency fund covering 3–6 months of expenses?',
    textTr: '3–6 aylık giderlerinizi karşılayan bir acil durum fonunuz var mı?',
    options: [
      'No emergency fund at all',
      'Partial — about 1–2 months of expenses',
      'Yes — I have a 3–6 month emergency fund',
      'Yes — and it is kept entirely separate from this investment',
    ],
    optionsTr: [
      'Hiç acil durum fonu yok',
      'Kısmen — yaklaşık 1–2 aylık gider',
      'Evet — 3–6 aylık acil durum fonu var',
      'Evet — ve bu yatırımdan tamamen ayrı tutulur',
    ],
  },
  {
    id: 14, category: 'Liquidity', categoryIndex: 4,
    text: 'How likely is it that you will need to withdraw from this portfolio on short notice?',
    textTr: 'Bu portföyden kısa vadede para çekmeniz ne kadar olası?',
    options: [
      'Likely — I may need liquidity at any time',
      'Possible — occasionally',
      'Unlikely — I have no planned withdrawals',
      'Not at all — this capital can be considered locked in',
    ],
    optionsTr: [
      'Olası — her an likiditeye ihtiyacım olabilir',
      'Mümkün — zaman zaman',
      'Olası değil — planlı çekim yok',
      'Hiç değil — bu sermaye kilitli sayılabilir',
    ],
  },
  {
    id: 15, category: 'Liquidity', categoryIndex: 4,
    text: 'Are you able to make regular monthly contributions to this portfolio?',
    textTr: 'Bu portföye düzenli aylık katkı yapabilir misiniz?',
    options: [
      'No — this is a one-time investment',
      'Maybe — depends on circumstances',
      'Yes — small but consistent additions',
      'Yes — I can contribute a meaningful amount each month',
    ],
    optionsTr: [
      'Hayır — bu tek seferlik bir yatırım',
      'Belki — koşullara bağlı',
      'Evet — küçük ama tutarlı eklemeler',
      'Evet — her ay anlamlı bir miktar katkıda bulunabilirim',
    ],
  },
]

/** Returns translated question text */
export function getQuestionText(q: Question, lang: Language): string {
  return lang === 'tr' ? q.textTr : q.text
}

/** Returns translated options */
export function getQuestionOptions(q: Question, lang: Language): string[] {
  return lang === 'tr' ? q.optionsTr : q.options
}

/** Returns translated category label */
export function getCategoryLabel(cat: string, lang: Language): string {
  if (lang !== 'tr') return cat
  const idx = CATEGORIES.indexOf(cat)
  return idx >= 0 ? CATEGORIES_TR[idx] : cat
}

/** Returns translated help text */
export function getHelpText(q: Question, lang: Language): string | undefined {
  return lang === 'tr' ? q.helpTextTr : q.helpText
}

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
