"""
Factor scoring engine — RAD Task 6.2

Rate-limit-friendly approach:
- Uses get_batch_price_history() → 1 yfinance request per asset class
- NO quoteSummary calls (429 riski)
- Tüm faktörler fiyat geçmişinden türetilir:
    momentum   → 12M getiri (son ay hariç)
    volatility → Yıllık günlük std sapma (düşük = iyi)
    value      → 52 haftalık yüksekten uzaklık (ucuzluk proxy'si)
    quality    → Trend tutarlılığı (Sharpe benzeri risk-adjusted return)
- Ağırlıklar profile göre ayarlanabilir
"""
import logging
import math
from datetime import datetime, timezone

from app.services.market_data import get_batch_price_history, get_ticker_info

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
    "momentum":   0.35,
    "value":      0.20,   # 52h yüksekten uzaklık — ucuzluk proxy
    "quality":    0.20,   # risk-adjusted trend tutarlılığı
    "volatility": 0.25,
}


def _momentum_score(price_history: list[dict]) -> float | None:
    """12 aylık getiri, son ay hariç. Yeterli veri yoksa 3 aya düşer."""
    if len(price_history) >= 200:
        try:
            close_now = price_history[-22]["close"]
            close_12m = price_history[0]["close"]
            if close_12m > 0:
                return (close_now / close_12m - 1) * 100
        except (IndexError, KeyError, ZeroDivisionError):
            pass

    if len(price_history) >= 60:
        try:
            close_now = price_history[-1]["close"]
            close_3m  = price_history[max(0, len(price_history) - 63)]["close"]
            if close_3m > 0:
                return (close_now / close_3m - 1) * 100
        except (IndexError, KeyError, ZeroDivisionError):
            pass

    return None


def _volatility_raw(price_history: list[dict]) -> float | None:
    """Yıllıklaştırılmış günlük getiri std sapması (%)."""
    if len(price_history) < 20:
        return None
    try:
        closes = [p["close"] for p in price_history if p["close"] > 0]
        if len(closes) < 2:
            return None
        returns = [(closes[i] / closes[i - 1] - 1) for i in range(1, len(closes))]
        mean     = sum(returns) / len(returns)
        variance = sum((r - mean) ** 2 for r in returns) / len(returns)
        return math.sqrt(variance) * math.sqrt(252) * 100
    except Exception:
        return None


def _value_raw(price_history: list[dict]) -> float | None:
    """
    Ucuzluk proxy: mevcut fiyatın 52 haftalık yüksekten uzaklığı (%).
    Negatif değer = yüksekten ne kadar aşağıda.
    -0%  = tam zirvede  (pahalı)
    -30% = zirveden %30 aşağıda (ucuz)
    """
    if len(price_history) < 20:
        return None
    try:
        current = price_history[-1]["close"]
        high_52w = max(r["high"] for r in price_history)
        if high_52w <= 0:
            return None
        return (current / high_52w - 1) * 100  # negatif değer
    except Exception:
        return None


def _quality_raw(price_history: list[dict]) -> float | None:
    """
    Risk-adjusted trend tutarlılığı (Calmar benzeri):
    Son 6 ayın aylık getirilerinde pozitif ay oranı × ortalama getiri.
    Yüksek = istikrarlı trend = kaliteli.
    """
    if len(price_history) < 60:
        return None
    try:
        # Son 6 ay için yaklaşık 126 iş günü, aylık dilimler
        recent = price_history[-126:]
        step   = max(1, len(recent) // 6)
        monthly_returns = []
        for i in range(0, len(recent) - step, step):
            c0 = recent[i]["close"]
            c1 = recent[i + step]["close"]
            if c0 > 0:
                monthly_returns.append((c1 / c0 - 1) * 100)

        if not monthly_returns:
            return None

        positive_ratio  = sum(1 for r in monthly_returns if r > 0) / len(monthly_returns)
        avg_return      = sum(monthly_returns) / len(monthly_returns)
        # Calmar-benzeri: pozitif ay oranı × ortalama getiri
        return positive_ratio * avg_return
    except Exception:
        return None


def _to_score(raw: float | None, lo: float, hi: float, invert: bool = False) -> float:
    """
    Mutlak referans noktalarına göre 0-100 arası normalize eder.
    Cross-sectional normalizasyondan (gruba göre sıralama) daha tutarlı.
    """
    if raw is None:
        return 50.0
    if hi == lo:
        return 50.0
    score = (raw - lo) / (hi - lo) * 100
    score = max(0.0, min(100.0, score))
    return 100.0 - score if invert else score


# ── Mutlak referans aralıkları ─────────────────────────────────────────────────
# Momentum  : -%40 → 0p,  %0 → 50p,  +%40 → 100p
_MOM_LO, _MOM_HI   = -40.0,  40.0
# Volatility: %40 → 0p,  %20 → 50p,  %0 → 100p  (invert=True)
_VOL_LO, _VOL_HI   =   0.0,  40.0
# Value (52h uzaklığı): -%50 → 100p (çok ucuz), -%0 → 0p (pahalı) (invert=True)
_VAL_LO, _VAL_HI   = -50.0,   0.0
# Quality: -5 → 0p,  0 → 50p,  +5 → 100p
_QUA_LO, _QUA_HI   =  -5.0,   5.0


def score_instruments(
    tickers: list[str],
    weights: dict | None = None,
) -> list[dict]:
    """
    Tüm tickerları tek bir batch isteğiyle skorlar.
    Her faktör mutlak referans aralıklarına göre 0-100 normalize edilir.
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    w_mom = weights.get("momentum",   DEFAULT_WEIGHTS["momentum"])
    w_val = weights.get("value",      DEFAULT_WEIGHTS["value"])
    w_qua = weights.get("quality",    DEFAULT_WEIGHTS["quality"])
    w_vol = weights.get("volatility", DEFAULT_WEIGHTS["volatility"])

    logger.info("Batch scoring %d instruments", len(tickers))

    histories = get_batch_price_history(tickers, period="1y")

    now    = datetime.now(timezone.utc).isoformat()
    scored = []

    for ticker in tickers:
        history  = histories.get(ticker, [])
        currency = "TRY" if ticker.endswith(".IS") else "USD"
        current_price = history[-1]["close"] if history else 0

        mom_raw = _momentum_score(history)
        vol_raw = _volatility_raw(history)
        val_raw = _value_raw(history)
        qua_raw = _quality_raw(history)

        mom_score = _to_score(mom_raw, _MOM_LO, _MOM_HI)
        vol_score = _to_score(vol_raw, _VOL_LO, _VOL_HI, invert=True)
        val_score = _to_score(val_raw, _VAL_LO, _VAL_HI, invert=True)
        qua_score = _to_score(qua_raw, _QUA_LO, _QUA_HI)

        composite = (
            w_mom * mom_score
            + w_val * val_score
            + w_qua * qua_score
            + w_vol * vol_score
        )

        scored.append({
            "ticker":       ticker,
            "currentPrice": current_price,
            "currency":     currency,
            "factorScore": {
                "momentum":     round(mom_score, 1),
                "value":        round(val_score, 1),
                "quality":      round(qua_score, 1),
                "volatility":   round(vol_score, 1),
                "composite":    round(composite, 1),
                "calculatedAt": now,
                # Debug için ham değerler
                "_raw": {
                    "momentum_pct":   round(mom_raw, 2) if mom_raw is not None else None,
                    "volatility_pct": round(vol_raw, 2) if vol_raw is not None else None,
                    "value_pct":      round(val_raw, 2) if val_raw is not None else None,
                    "quality_score":  round(qua_raw, 2) if qua_raw is not None else None,
                },
            },
        })

    scored.sort(key=lambda x: x["factorScore"]["composite"], reverse=True)
    return scored


def compute_raw_factors(ticker: str) -> dict:
    """Tek ticker detay sayfası için."""
    from app.services.market_data import get_price_history
    history = get_price_history(ticker, period="1y")
    info    = get_ticker_info(ticker)
    return {
        "ticker":         ticker,
        "currentPrice":   info.get("currentPrice", 0),
        "currency":       info.get("currency", "USD"),
        "momentum_raw":   _momentum_score(history),
        "value_raw":      _value_raw(history),
        "quality_raw":    _quality_raw(history),
        "volatility_raw": _volatility_raw(history),
    }


def score_single(ticker: str, weights: dict | None = None) -> dict | None:
    results = score_instruments([ticker], weights=weights)
    return results[0] if results else None
