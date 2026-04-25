"""
Portfolio construction engine — Algoritma D (Hibrit Çok Boyutlu)

Layer 1 (Algoritma D):
  Her questionnaire sorusu doğrudan 5 varlık boyutuna katkı sağlar.
  Ham boyut skorları normalize edilerek %100 tamamlanır.
  Güvenlik şeritleri (guardrails) kesin kısıtlar koyar.
  %5 altındaki ağırlıklar sıfırlanır — "her sınıftan biraz" anti-pattern'i kırılır.

Layer 2 (Task 6.4): Factor scoring ile intra-class instrument seçimi.
"""
import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.services.factor_scoring import score_instruments
from app.services.market_data import ALL_BIST

logger = logging.getLogger(__name__)

# ── BIST hisse isimleri ───────────────────────────────────────────────────────

_BIST_NAMES: dict[str, str] = {
    "AKBNK.IS": "Akbank",           "AKSEN.IS": "Aksa Enerji",
    "ARCLK.IS": "Arçelik",          "ASELS.IS": "Aselsan",
    "BIMAS.IS": "BİM Mağazalar",    "EKGYO.IS": "Emlak Konut GYO",
    "EREGL.IS": "Erdemir",          "FROTO.IS": "Ford Otosan",
    "GARAN.IS": "Garanti BBVA",     "GUBRF.IS": "Gübre Fabrikaları",
    "HALKB.IS": "Halkbank",         "ISCTR.IS": "İş Bankası C",
    "KCHOL.IS": "Koç Holding",      "KONTR.IS": "Kontrolmatik",
    "KOZAA.IS": "Koza Anadolu",     "KOZAL.IS": "Koza Altın",
    "KRDMD.IS": "Kardemir D",       "MGROS.IS": "Migros",
    "ODAS.IS":  "Odaş Elektrik",    "OYAKC.IS": "Oyak Çimento",
    "PETKM.IS": "Petkim",           "SAHOL.IS": "Sabancı Holding",
    "SASA.IS":  "SASA Polyester",   "SISE.IS":  "Şişecam",
    "TAVHL.IS": "TAV Havalimanları","TCELL.IS": "Turkcell",
    "THYAO.IS": "Türk Hava Yolları","TOASO.IS": "Tofaş",
    "TUPRS.IS": "Tüpraş",           "VAKBN.IS": "Vakıfbank",
    "YKBNK.IS": "Yapı Kredi",       "AEFES.IS": "Anadolu Efes",
    "AKGRT.IS": "Aksigorta",        "ALARK.IS": "Alarko Holding",
    "ANHYT.IS": "Anadolu Hayat",    "ANSGR.IS": "Anadolu Sigorta",
    "ASUZU.IS": "Anadolu Isuzu",    "AYDEN.IS": "Aydem Enerji",
    "BRISA.IS": "Brisa",            "BRYAT.IS": "Borusan Yatırım",
    "CCOLA.IS": "Coca-Cola İçecek", "CIMSA.IS": "Çimsa",
    "CLEBI.IS": "Çelebi Hava",      "DOAS.IS":  "Doğuş Otomotiv",
    "DOHOL.IS": "Doğan Holding",    "ENKAI.IS": "Enka İnşaat",
    "ENJSA.IS": "Enerjisa Enerji",  "ISGYO.IS": "İş GYO",
    "KORDS.IS": "Kordsa",           "LOGO.IS":  "Logo Yazılım",
    "MAVI.IS":  "Mavi Giyim",       "MPARK.IS": "MLP Sağlık",
    "OTKAR.IS": "Otokar",           "PGSUS.IS": "Pegasus",
    "SARKY.IS": "Sarkuysan",        "SOKM.IS":  "Şok Marketler",
    "TATGD.IS": "Tat Gıda",         "TRGYO.IS": "Torunlar GYO",
    "TTKOM.IS": "Türk Telekom",     "VESTL.IS": "Vestel",
    "ZOREN.IS": "Zorlu Enerji",
}

# ── Candidate universe ────────────────────────────────────────────────────────

CANDIDATE_UNIVERSE: dict[str, list[dict]] = {
    "BIST_EQUITY": [
        {"ticker": t, "name": _BIST_NAMES.get(t, t.replace(".IS", "")), "exchange": "BIST"}
        for t in ALL_BIST
    ],
    "SP500_EQUITY": [
        {"ticker": "SPY", "name": "SPDR S&P 500 ETF",     "exchange": "NYSE"},
        {"ticker": "QQQ", "name": "Invesco QQQ (NASDAQ)",  "exchange": "NASDAQ"},
        {"ticker": "VTI", "name": "Vanguard Total Market", "exchange": "NYSE"},
    ],
    "COMMODITY": [
        {"ticker": "GLD", "name": "SPDR Gold Shares",     "exchange": "NYSE"},
        {"ticker": "SLV", "name": "iShares Silver Trust", "exchange": "NYSE"},
        {"ticker": "IAU", "name": "iShares Gold Trust",   "exchange": "NYSE"},
    ],
    "CRYPTOCURRENCY": [
        {"ticker": "BTC-USD", "name": "Bitcoin",  "exchange": "CRYPTO"},
        {"ticker": "ETH-USD", "name": "Ethereum", "exchange": "CRYPTO"},
    ],
    "CASH_EQUIVALENT": [
        {"ticker": "BIL",  "name": "SPDR Bloomberg 1-3 Month T-Bill",  "exchange": "NYSE"},
        {"ticker": "SGOV", "name": "iShares 0-3 Month Treasury Bond",  "exchange": "NYSE"},
    ],
}

ASSET_CLASS_LABELS = {
    "BIST_EQUITY":     "BIST equities",
    "SP500_EQUITY":    "S&P 500 / US equities",
    "COMMODITY":       "commodities (gold, silver)",
    "CRYPTOCURRENCY":  "cryptocurrency",
    "CASH_EQUIVALENT": "cash / money market instruments",
}

PROFILE_LABELS = {"conservative": "Conservative", "balanced": "Balanced", "aggressive": "Aggressive"}
HORIZON_LABELS = {"short": "short-term (< 1 year)", "medium": "medium-term (1–5 years)", "long": "long-term (5+ years)"}

# ── Algoritma D — Boyut haritası ──────────────────────────────────────────────
#
# Her satır: (soru_id, opt0_katkı, opt1_katkı, opt2_katkı, opt3_katkı)
# Katkı: 0-100 arası, o boyut için ne kadar istek sinyali verdiği
#
# CASH_DIM    → nakit/para piyasası isteği
# CRYPTO_DIM  → kripto isteği
# COMMODITY_DIM → emtia (altın/gümüş) isteği
# BIST_DIM    → BIST hisse isteği
# SP500_DIM   → global hisse (S&P500) isteği

DIMENSION_MAP: dict[str, list[tuple[int, float, float, float, float]]] = {
    "CASH_EQUIVALENT": [
        # Q11: Para ne zaman lazım? Yakında → nakit artar
        (11, 100.0, 65.0, 25.0,  0.0),
        # Q13: Acil fon? Yoksa → nakit zorunlu
        (13, 100.0, 70.0, 30.0,  0.0),
        # Q14: Ani çekim ihtimali?
        (14, 100.0, 60.0, 20.0,  0.0),
    ],
    "CRYPTOCURRENCY": [
        # Q5: Kripto görüşü — en belirleyici sinyal
        (5,    0.0, 25.0, 65.0, 100.0),
        # Q4: Genel risk tutumu
        (4,    0.0, 15.0, 50.0, 100.0),
        # Q8: Max kayıp toleransı
        (8,    0.0, 10.0, 45.0, 100.0),
    ],
    "COMMODITY": [
        # Q1: Hedef — koruma odaklıysa emtia artar
        (1,  100.0, 75.0, 35.0, 10.0),
        # Q7: Kayıp tepkisi — panikçi → altın (güvenli liman)
        (7,  100.0, 70.0, 30.0,  0.0),
        # Q8: Kayıp toleransı — düşük → emtia tercih
        (8,   95.0, 65.0, 25.0,  0.0),
    ],
    "BIST_EQUITY": [
        # Q6: Piyasa deneyimi — deneyim arttıkça BIST artar
        (6,   10.0, 35.0, 70.0, 100.0),
        # Q12: Yaşam evresi — genç → büyüme hissesi
        (12,  10.0, 35.0, 70.0, 100.0),
        # Q3: Yatırım oranı — yüksek pay → daha fazla hisse
        (3,   20.0, 45.0, 70.0, 100.0),
    ],
    "SP500_EQUITY": [
        # Q1: Hedef — büyüme → global hisse
        (1,    0.0, 20.0, 70.0, 100.0),
        # Q2: Beklenen getiri — yüksek beklenti → hisse
        (2,    0.0, 30.0, 70.0, 100.0),
        # Q10: Yatırım ufku — uzun → hisse
        (10,   0.0, 20.0, 60.0, 100.0),
    ],
}

# Boyut ağırlıkları (soruların her boyuttaki eşit katkısı varsayılır,
# ama daha belirleyici sorulara daha yüksek ağırlık verebiliriz)
DIMENSION_QUESTION_WEIGHTS: dict[str, list[float]] = {
    # Her boyuttaki soruların ağırlıkları (DIMENSION_MAP sırasıyla)
    "CASH_EQUIVALENT": [1.0, 1.5, 1.0],   # Q13 (acil fon) daha belirleyici
    "CRYPTOCURRENCY":  [2.0, 1.0, 1.0],   # Q5 (kripto görüşü) çok belirleyici
    "COMMODITY":       [1.0, 1.0, 1.0],
    "BIST_EQUITY":     [1.5, 1.0, 1.0],   # Q6 (deneyim) biraz daha önemli
    "SP500_EQUITY":    [1.0, 1.0, 1.5],   # Q10 (ufuk) biraz daha önemli
}

# ── Güvenlik şeritleri (Guardrails) ──────────────────────────────────────────
#
# Her şerit: koşul sağlanırsa ilgili boyuta min/max kısıt konur.
# Birden fazla şerit aynı boyutu etkileyebilir — en kısıtlayıcı kazanır.
#
# Format: {"q": soru_id, "op": option_index, "dim": boyut, "action": "min"|"max", "val": yüzde}

GUARDRAILS: list[dict[str, Any]] = [
    # Kripto reddi → kesin sıfır
    {"q": 5, "op": 0, "dim": "CRYPTOCURRENCY", "action": "max", "val": 0,
     "reason": "User explicitly rejected cryptocurrency (Q5)"},

    # Acil fon yok → nakit zorunlu tampon
    {"q": 13, "op": 0, "dim": "CASH_EQUIVALENT", "action": "min", "val": 20,
     "reason": "No emergency fund (Q13) — minimum cash buffer required"},
    {"q": 13, "op": 1, "dim": "CASH_EQUIVALENT", "action": "min", "val": 10,
     "reason": "Partial emergency fund (Q13) — minimum cash buffer applied"},

    # Likidite ihtiyacı → kripto kısıt
    {"q": 14, "op": 0, "dim": "CRYPTOCURRENCY", "action": "max", "val": 5,
     "reason": "High liquidity need (Q14) — crypto capped at 5%"},

    # Deneyimsiz yatırımcı → BIST kısıt (BIST karmaşık, takip gerektirir)
    {"q": 6, "op": 0, "dim": "BIST_EQUITY", "action": "max", "val": 15,
     "reason": "Beginner investor (Q6) — BIST exposure capped at 15%"},

    # Kısa vadeli ufuk → kripto ve emtia kısıt
    {"q": 10, "op": 0, "dim": "CRYPTOCURRENCY", "action": "max", "val": 5,
     "reason": "Short investment horizon (Q10) — crypto capped at 5%"},
    {"q": 10, "op": 0, "dim": "COMMODITY", "action": "max", "val": 20,
     "reason": "Short investment horizon (Q10) — commodity capped at 20%"},

    # Çok düşük kayıp toleransı → kripto sıfır, BIST kısıt
    {"q": 8, "op": 0, "dim": "CRYPTOCURRENCY", "action": "max", "val": 0,
     "reason": "Cannot tolerate losses > 5% (Q8) — crypto excluded"},
    {"q": 8, "op": 0, "dim": "BIST_EQUITY", "action": "max", "val": 15,
     "reason": "Cannot tolerate losses > 5% (Q8) — BIST capped at 15%"},

    # Emekli / sermaye koruma → agresif varlıklar kısıt
    {"q": 12, "op": 0, "dim": "CRYPTOCURRENCY", "action": "max", "val": 0,
     "reason": "Near retirement (Q12) — crypto excluded"},
    {"q": 12, "op": 0, "dim": "BIST_EQUITY", "action": "max", "val": 20,
     "reason": "Near retirement (Q12) — BIST capped at 20%"},

    # Panik satıcı → riskli varlıklara limit
    {"q": 7, "op": 0, "dim": "CRYPTOCURRENCY", "action": "max", "val": 0,
     "reason": "Would panic-sell on 20% drop (Q7) — crypto excluded"},
    {"q": 7, "op": 0, "dim": "BIST_EQUITY", "action": "max", "val": 20,
     "reason": "Would panic-sell on 20% drop (Q7) — BIST capped at 20%"},
]

# Minimum ağırlık eşiği — bunun altındaki varlıklar portföyden çıkarılır
_MIN_WEIGHT_THRESHOLD = 5.0


# ── Layer 1: Algoritma D — Ağırlık hesabı ────────────────────────────────────

def compute_weights_from_answers(
    answers: list[dict],   # [{"questionId": int, "selectedOption": int}, ...]
) -> dict[str, float]:
    """
    Questionnaire cevaplarından doğrudan portföy ağırlıkları üretir.

    1. Her boyut için ağırlıklı ortalama ham skor hesapla (0-100)
    2. Güvenlik şeritlerini uygula (min/max clamp)
    3. Toplam 100'e normalize et
    4. %5 altındaki ağırlıkları sıfırla, yeniden normalize et
    5. Yuvarlama hatalarını düzelt
    """
    answer_map: dict[int, int] = {a["questionId"]: a["selectedOption"] for a in answers}

    # 1. Ham boyut skorları
    raw: dict[str, float] = {}
    for dim, questions in DIMENSION_MAP.items():
        q_weights = DIMENSION_QUESTION_WEIGHTS[dim]
        weighted_sum = 0.0
        weight_total = 0.0
        for i, (qid, v0, v1, v2, v3) in enumerate(questions):
            if qid in answer_map:
                vals = [v0, v1, v2, v3]
                score = vals[answer_map[qid]]
                w = q_weights[i] if i < len(q_weights) else 1.0
                weighted_sum += score * w
                weight_total += w
        raw[dim] = (weighted_sum / weight_total) if weight_total > 0 else 50.0

    logger.debug("Raw dimension scores: %s", raw)

    # 2. Güvenlik şeritleri
    applied_guardrails: list[str] = []
    guardrail_mins: dict[str, float] = {}
    guardrail_maxs: dict[str, float] = {}

    for g in GUARDRAILS:
        if answer_map.get(g["q"]) == g["op"]:
            dim = g["dim"]
            if g["action"] == "max":
                prev = guardrail_maxs.get(dim, float("inf"))
                guardrail_maxs[dim] = min(prev, g["val"])
            elif g["action"] == "min":
                prev = guardrail_mins.get(dim, 0.0)
                guardrail_mins[dim] = max(prev, g["val"])
            applied_guardrails.append(g["reason"])

    if applied_guardrails:
        logger.info("Guardrails applied: %s", applied_guardrails)

    # Güvenlik şeritlerini ham skorlara yansıt
    # (clamp yapmadan önce: max kısıtını ham skora oransal uygula)
    for dim in raw:
        if dim in guardrail_maxs:
            # Ham skoru 0-100 aralığında tutarken guardrail'i uygula
            # Gerçek ağırlık normalize sonrası belirleneceğinden,
            # ham skoru max_val'e karşılık gelen seviyeye çek
            raw[dim] = min(raw[dim], guardrail_maxs[dim])
        if dim in guardrail_mins:
            raw[dim] = max(raw[dim], guardrail_mins[dim])

    logger.debug("Post-guardrail raw scores: %s", raw)

    # 3. Normalize → toplam 100
    total = sum(raw.values())
    if total == 0:
        return {d: round(100 / len(raw)) for d in raw}

    normalized: dict[str, float] = {d: s / total * 100 for d, s in raw.items()}

    # Guardrail min'leri normalize sonrası da kontrol et
    # (normalize sonrası bazı min'ler bozulmuş olabilir)
    changed = True
    iterations = 0
    while changed and iterations < 10:
        changed = False
        iterations += 1
        for dim, min_val in guardrail_mins.items():
            if normalized.get(dim, 0) < min_val:
                deficit = min_val - normalized[dim]
                normalized[dim] = min_val
                # Eksikliği diğer boyutlardan oransal olarak al
                others = {d: v for d, v in normalized.items() if d != dim and v > 0}
                others_total = sum(others.values())
                if others_total > 0:
                    for d in others:
                        normalized[d] -= deficit * (normalized[d] / others_total)
                changed = True

    # 4. Küçük ağırlıkları sıfırla (< threshold)
    cleaned: dict[str, float] = {
        d: (v if v >= _MIN_WEIGHT_THRESHOLD else 0.0)
        for d, v in normalized.items()
    }

    # Guardrail min'leri sıfırlanan boyutlara tekrar uygula
    for dim, min_val in guardrail_mins.items():
        if min_val > 0 and cleaned.get(dim, 0) == 0:
            cleaned[dim] = min_val

    total2 = sum(cleaned.values())
    if total2 == 0:
        total2 = 100.0

    # 5. Son normalize + integer yuvarlama
    final_float: dict[str, float] = {d: v / total2 * 100 for d, v in cleaned.items()}
    final: dict[str, int] = {d: math.floor(v) for d, v in final_float.items()}

    # Yuvarlama farkını en büyük ağırlığa ekle
    remainder = 100 - sum(final.values())
    if remainder > 0:
        # Kesirli kısmı en büyük olan boyutlara ver
        fractions = sorted(
            [(d, final_float[d] - final[d]) for d in final],
            key=lambda x: -x[1]
        )
        for i in range(remainder):
            final[fractions[i % len(fractions)][0]] += 1

    return {d: float(v) for d, v in final.items()}


# ── Profil ve ufuk türetimi ───────────────────────────────────────────────────

def _derive_profile_from_weights(weights: dict[str, float]) -> str:
    """
    Hesaplanan ağırlıklardan profil etiketini türet.
    Risk taşıyan varlıkların (hisse + kripto) toplam oranına göre.
    """
    risky = weights.get("BIST_EQUITY", 0) + weights.get("SP500_EQUITY", 0) + weights.get("CRYPTOCURRENCY", 0)
    if risky < 35:
        return "conservative"
    elif risky < 65:
        return "balanced"
    return "aggressive"


def _derive_metrics_from_weights(weights: dict[str, float]) -> dict[str, float]:
    """Ağırlıklara göre beklenen getiri ve oynaklık tahmini."""
    # Varlık sınıfı bazında tarihi parametreler (kaba tahmin)
    asset_params = {
        "BIST_EQUITY":    {"return": 18.0, "vol": 28.0},  # TL bazlı yüksek, USD'de ~12%
        "SP500_EQUITY":   {"return": 10.5, "vol": 16.0},
        "COMMODITY":      {"return":  6.0, "vol": 14.0},
        "CRYPTOCURRENCY": {"return": 30.0, "vol": 65.0},
        "CASH_EQUIVALENT":{"return":  4.5, "vol":  0.5},
    }
    exp_return = sum(
        weights.get(ac, 0) / 100 * params["return"]
        for ac, params in asset_params.items()
    )
    # Basitleştirilmiş volatilite (korelasyonları dikkate almıyor ama yeterince göstergeci)
    exp_vol = sum(
        weights.get(ac, 0) / 100 * params["vol"]
        for ac, params in asset_params.items()
    )
    return {"expected_return": round(exp_return, 2), "expected_volatility": round(exp_vol, 2)}


# ── Layer 2: Instrument seçimi ────────────────────────────────────────────────

def _select_instruments(
    asset_class: str,
    target_weight: float,
    max_instruments: int,
    factor_weights: dict | None = None,
) -> list[dict]:
    if target_weight == 0:
        return []

    candidates   = CANDIDATE_UNIVERSE.get(asset_class, [])
    if not candidates:
        return []

    tickers     = [c["ticker"] for c in candidates]
    ticker_meta = {c["ticker"]: c for c in candidates}

    try:
        scored = score_instruments(tickers, weights=factor_weights)
        top    = scored[:max_instruments]
    except Exception as exc:
        logger.warning("Factor scoring failed for %s: %s", asset_class, exc)
        top = [
            {
                "ticker": c["ticker"],
                "currentPrice": 100.0,
                "currency": "USD",
                "factorScore": {
                    "momentum": 50.0, "value": 50.0, "quality": 50.0,
                    "volatility": 50.0, "composite": 50.0,
                    "calculatedAt": datetime.now(timezone.utc).isoformat(),
                },
            }
            for c in candidates[:max_instruments]
        ]

    result = []
    for item in top:
        meta = ticker_meta.get(item["ticker"], {})
        result.append({
            "instrumentId": str(uuid.uuid4()),
            "ticker":       item["ticker"],
            "name":         meta.get("name", item["ticker"]),
            "assetClass":   asset_class,
            "exchange":     meta.get("exchange", ""),
            "currentPrice": item["currentPrice"],
            "currency":     item.get("currency", "USD"),
            "isActive":     True,
            "factorScore":  item["factorScore"],
            "whySelected":  _why_selected(item["factorScore"]),
        })

    return result


# ── Açıklama üretici ──────────────────────────────────────────────────────────

def _generate_explanation(
    profile: str,
    horizon: str,
    weights: dict[str, float],
    applied_guardrails_info: list[str] | None = None,
) -> str:
    profile_label = PROFILE_LABELS.get(profile, profile)
    horizon_label = HORIZON_LABELS.get(horizon, horizon)

    active_allocs = sorted(
        [(k, v) for k, v in weights.items() if v >= _MIN_WEIGHT_THRESHOLD],
        key=lambda x: -x[1]
    )
    absent = [ASSET_CLASS_LABELS.get(k, k) for k, v in weights.items() if v < _MIN_WEIGHT_THRESHOLD]

    alloc_desc = ", ".join(
        f"{ASSET_CLASS_LABELS.get(cls, cls)} ({int(w)}%)"
        for cls, w in active_allocs
    )

    base = (
        f"Based on your questionnaire responses, a {profile_label} profile "
        f"with a {horizon_label} investment horizon was determined. "
        f"Your portfolio was built directly from your answers — "
        f"not from a fixed template. "
        f"Primary allocations: {alloc_desc}."
    )

    if absent:
        base += f" The following asset classes were excluded based on your preferences: {', '.join(absent)}."

    return base


def _why_selected(factor_score: dict | None) -> list[str]:
    if not factor_score:
        return ["Selected by rules-based portfolio algorithm."]
    reasons = []
    if factor_score.get("momentum", 0) >= 65:
        reasons.append("Strong price momentum (12-month return)")
    if factor_score.get("quality", 0) >= 65:
        reasons.append("Consistent uptrend quality (Calmar-style score)")
    if factor_score.get("volatility", 0) >= 65:
        reasons.append("Low volatility — capital preservation")
    if factor_score.get("value", 0) >= 65:
        reasons.append("Attractive entry point (below 52-week high)")
    if not reasons:
        reasons.append("Balanced factor profile — portfolio diversification")
    return reasons


# ── Public API ────────────────────────────────────────────────────────────────

def build_portfolio(
    profile: str,
    horizon: str,
    answers: list[dict] | None = None,
    factor_weights: dict | None = None,
    max_instruments: int | None = None,
) -> dict:
    """
    Algoritma D: Questionnaire cevaplarından doğrudan portföy üret.

    answers parametresi verilirse Algoritma D (dinamik) kullanılır.
    Verilmezse eski lookup tablosu fallback olarak devreye girer.
    """
    max_inst = max_instruments or settings.MAX_INSTRUMENTS_PER_CLASS

    if answers:
        logger.info(
            "Building portfolio (Algorithm D): profile=%s horizon=%s answers=%d",
            profile, horizon, len(answers)
        )
        weights_float = compute_weights_from_answers(answers)
    else:
        # Fallback: eski lookup tablosu (geriye dönük uyumluluk)
        logger.warning("No answers provided — using legacy lookup table fallback")
        weights_float = _legacy_lookup(profile, horizon)

    logger.info("Computed weights: %s", weights_float)

    allocations = []
    for asset_class, target_weight in weights_float.items():
        instruments = _select_instruments(
            asset_class=asset_class,
            target_weight=target_weight,
            max_instruments=max_inst,
            factor_weights=factor_weights,
        )
        allocations.append({
            "asset_class":   asset_class,
            "target_weight": target_weight,
            "instruments":   instruments,
        })

    # Dinamik metrikler
    metrics    = _derive_metrics_from_weights(weights_float)
    risky_pct  = weights_float.get("BIST_EQUITY", 0) + weights_float.get("SP500_EQUITY", 0) + weights_float.get("CRYPTOCURRENCY", 0)
    port_score = min(100, int(risky_pct * 0.8 + 20))

    explanation = _generate_explanation(profile, horizon, weights_float)

    return {
        "profile_type":        profile,
        "horizon_type":        horizon,
        "portfolio_score":     port_score,
        "expected_volatility": metrics["expected_volatility"],
        "expected_return":     metrics["expected_return"],
        "explanation":         explanation,
        "allocations":         allocations,
        "weights_debug":       weights_float,  # debug için
    }


def _legacy_lookup(profile: str, horizon: str) -> dict[str, float]:
    """Geriye dönük uyumluluk için eski sabit matris."""
    LEGACY_MATRIX = {
        "conservative": {
            "short":  {"BIST_EQUITY": 20, "SP500_EQUITY": 5,  "COMMODITY": 25, "CRYPTOCURRENCY": 0,  "CASH_EQUIVALENT": 50},
            "medium": {"BIST_EQUITY": 30, "SP500_EQUITY": 10, "COMMODITY": 20, "CRYPTOCURRENCY": 0,  "CASH_EQUIVALENT": 40},
            "long":   {"BIST_EQUITY": 35, "SP500_EQUITY": 15, "COMMODITY": 20, "CRYPTOCURRENCY": 0,  "CASH_EQUIVALENT": 30},
        },
        "balanced": {
            "short":  {"BIST_EQUITY": 25, "SP500_EQUITY": 15, "COMMODITY": 20, "CRYPTOCURRENCY": 5,  "CASH_EQUIVALENT": 35},
            "medium": {"BIST_EQUITY": 35, "SP500_EQUITY": 20, "COMMODITY": 15, "CRYPTOCURRENCY": 10, "CASH_EQUIVALENT": 20},
            "long":   {"BIST_EQUITY": 40, "SP500_EQUITY": 20, "COMMODITY": 15, "CRYPTOCURRENCY": 15, "CASH_EQUIVALENT": 10},
        },
        "aggressive": {
            "short":  {"BIST_EQUITY": 30, "SP500_EQUITY": 20, "COMMODITY": 15, "CRYPTOCURRENCY": 15, "CASH_EQUIVALENT": 20},
            "medium": {"BIST_EQUITY": 35, "SP500_EQUITY": 20, "COMMODITY": 10, "CRYPTOCURRENCY": 20, "CASH_EQUIVALENT": 15},
            "long":   {"BIST_EQUITY": 35, "SP500_EQUITY": 20, "COMMODITY": 10, "CRYPTOCURRENCY": 25, "CASH_EQUIVALENT": 10},
        },
    }
    row = LEGACY_MATRIX.get(profile, LEGACY_MATRIX["balanced"])
    return {k: float(v) for k, v in row.get(horizon, row["medium"]).items()}
