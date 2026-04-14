export interface Question {
  id: number
  category: string
  categoryIndex: number // 0-4 (which of the 5 steps)
  text: string
  helpText?: string
  options: string[]
}

export const CATEGORIES = [
  'Finansal Hedefler',
  'Risk Toleransı',
  'Kayıp Toleransı',
  'Yatırım Ufku',
  'Likidite',
]

export const QUESTIONS: Question[] = [
  // ── Finansal Hedefler (Cat 0) ─────────────────────────────────
  {
    id: 1, category: 'Finansal Hedefler', categoryIndex: 0,
    text: 'Yatırım yapmanın birincil amacınız nedir?',
    options: [
      'Birikimlerimi enflasyondan korumak',
      'İstikrarlı bir gelir elde etmek',
      'Uzun vadeli servet oluşturmak',
      'Agresif büyüme ve yüksek getiri',
    ],
  },
  {
    id: 2, category: 'Finansal Hedefler', categoryIndex: 0,
    text: 'Yatırımlarınızdan beklediğiniz yıllık getiri hedefi nedir?',
    options: [
      '%0–5 (Düşük risk, düşük getiri)',
      '%5–10 (Orta risk, orta getiri)',
      '%10–20 (Yüksek risk, yüksek getiri)',
      '%20+ (Çok yüksek risk, maksimum getiri)',
    ],
  },
  {
    id: 3, category: 'Finansal Hedefler', categoryIndex: 0,
    text: 'Toplam tasarruflarınızın ne kadarını bu platforma yatırmayı planlıyorsunuz?',
    options: [
      '%10\'dan az',
      '%10–25',
      '%25–50',
      '%50\'den fazla',
    ],
  },
  // ── Risk Toleransı (Cat 1) ────────────────────────────────────
  {
    id: 4, category: 'Risk Toleransı', categoryIndex: 1,
    text: 'Yatırım konusundaki genel tutumunuzu nasıl tanımlarsınız?',
    options: [
      'Çok temkinliyim, anaparamı kaybetmek istemem',
      'Biraz risk alabilirim ama kayıpları minimumda tutmak isterim',
      'Daha yüksek getiri için orta düzey riski kabul ederim',
      'Maksimum getiri için yüksek risk almaya hazırım',
    ],
  },
  {
    id: 5, category: 'Risk Toleransı', categoryIndex: 1,
    text: 'Kripto para gibi yüksek volatiliteli varlıklara bakış açınız nedir?',
    options: [
      'Hiç almam, çok riskli',
      'Küçük bir pozisyon alabilirim (%5\'e kadar)',
      'Portföyümün önemli bir kısmını oluşturabilir (%10–20)',
      'Agresif şekilde yatırım yaparım (%20+)',
    ],
  },
  {
    id: 6, category: 'Risk Toleransı', categoryIndex: 1,
    text: 'Finansal piyasalar hakkındaki deneyim seviyeniz nedir?',
    options: [
      'Acemi — piyasaları takip etmiyorum',
      'Başlangıç — temel kavramları biliyorum',
      'Orta — hisse senedi ve fonları anlıyorum',
      'İleri — teknik analiz ve türevlere hakimim',
    ],
  },
  // ── Kayıp Toleransı (Cat 2) ───────────────────────────────────
  {
    id: 7, category: 'Kayıp Toleransı', categoryIndex: 2,
    text: 'Portföyünüz bir ayda %20 düşerse ne yaparsınız?',
    helpText: 'Kayıp toleransı, risk profilinizin belirleyici bir boyutudur.',
    options: [
      'Her şeyi hemen satarım, daha fazla kayıp istemem',
      'Bekler ve gözlemlerim, piyasalar genellikle toparlanır',
      'Düşük fiyattan alım yaparım, fırsat olarak görürüm',
      'Fark etmez, kaybetmeyi göze alabileceğim parayla yatırım yapıyorum',
    ],
  },
  {
    id: 8, category: 'Kayıp Toleransı', categoryIndex: 2,
    text: 'En fazla hangi oranda kayba katlanabilirsiniz?',
    options: [
      '%5\'e kadar kayıp kabul edilebilir',
      '%5–15 arası kayıp katlanılabilir',
      '%15–30 arası kayıp kısa vadede tolere edilebilir',
      '%30+ kayıp dahi uzun vadede telafi edilebilir',
    ],
  },
  {
    id: 9, category: 'Kayıp Toleransı', categoryIndex: 2,
    text: 'Geçmişte yatırımlarınızda önemli bir kayıp yaşadınız mı?',
    options: [
      'Hayır ve böyle bir durum ciddi şekilde endişelendirir',
      'Hayır ama kontrol altında tutabileceğimi düşünüyorum',
      'Evet, toparlanmak zaman aldı ama üstesinden geldim',
      'Evet, bunun piyasaların doğasında olduğunu kabul ediyorum',
    ],
  },
  // ── Yatırım Ufku (Cat 3) ─────────────────────────────────────
  {
    id: 10, category: 'Yatırım Ufku', categoryIndex: 3,
    text: 'Bu portföydeki yatırımlarınızı ne kadar süre tutmayı planlıyorsunuz?',
    options: [
      '1 yıldan kısa (kısa vade)',
      '1–5 yıl (orta vade)',
      '5–10 yıl (uzun vade)',
      '10 yıldan fazla (çok uzun vade)',
    ],
  },
  {
    id: 11, category: 'Yatırım Ufku', categoryIndex: 3,
    text: 'Bu parayı yakın gelecekte (1–2 yıl) kullanma ihtimaliniz ne kadar?',
    options: [
      'Çok yüksek — yakında ihtiyacım olabilir',
      'Orta — belki ihtiyacım olabilir',
      'Düşük — planlamıyorum',
      'Yok — kesinlikle kullanmayacağım',
    ],
  },
  {
    id: 12, category: 'Yatırım Ufku', categoryIndex: 3,
    text: 'Hangi yaşam döneminde olduğunuzu düşünüyorsunuz?',
    options: [
      'Emekliliğe yakın, sermayeyi koruma önceliğim',
      'Orta yaş, hem büyüme hem koruma istiyorum',
      'Kariyer başlangıcı, büyüme odaklıyım',
      'Genç yatırımcı, uzun vadeli agresif büyüme hedefliyorum',
    ],
  },
  // ── Likidite (Cat 4) ──────────────────────────────────────────
  {
    id: 13, category: 'Likidite', categoryIndex: 4,
    text: 'Acil durum fonunuz (3–6 aylık gider) var mı?',
    options: [
      'Hayır, acil fon yok',
      'Kısmi — 1–2 aylık giderim var',
      'Evet — 3–6 aylık acil fonuma sahibim',
      'Evet ve bu yatırım dışında tutulacak',
    ],
  },
  {
    id: 14, category: 'Likidite', categoryIndex: 4,
    text: 'Portföyünüzden anlık olarak para çekme ihtiyacınız olabilir mi?',
    options: [
      'Evet, her zaman likidite ihtiyacım olabilir',
      'Belki, nadiren',
      'Hayır, planlı bir çekme ihtiyacım yok',
      'Kesinlikle hayır, bu para kilitlenmiş kabul edilebilir',
    ],
  },
  {
    id: 15, category: 'Likidite', categoryIndex: 4,
    text: 'Aylık düzenli yatırım yapabilir misiniz?',
    options: [
      'Hayır, tek seferlik yatırım yapıyorum',
      'Belki, duruma göre',
      'Evet, küçük ama düzenli eklemeler yapabilirim',
      'Evet, önemli miktarda düzenli yatırım ekleyebilirim',
    ],
  },
]

/** Returns score 0–3 for an answer (used to compute composite score) */
export function scoreAnswer(questionId: number, optionIndex: number): number {
  // Higher index = higher risk appetite
  return optionIndex
}

/** Compute composite score 0–100 from all answers */
export function computeCompositeScore(answers: { questionId: number; selectedOption: number }[]): number {
  if (answers.length === 0) return 0
  const total = answers.reduce((sum, a) => sum + scoreAnswer(a.questionId, a.selectedOption), 0)
  const maxPossible = answers.length * 3
  return Math.round((total / maxPossible) * 100)
}
