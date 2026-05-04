"""
Factor scoring engine — pandas-ta ile güçlendirilmiş versiyon

Teknik analiz katmanı (pandas-ta):
  RSI(14)      → aşırı satım/alım durumu → momentum sinyali
  MACD         → trend yönü ve gücü      → trend kalitesi
  BB %B        → Bollinger Band konumu   → oynaklık ve aşırılık
  ADX(14)      → trend gücü              → kalite (güçlü trend = kalite)
  ATR(14)      → gerçek aralık           → risk / volatilite

Orijinal faktörler korunuyor, TA skorları ile harmanlanıyor:
  momentum   → 0.6×(12M getiri skoru) + 0.4×(RSI+MACD TA skoru)
  volatility → 0.5×(yıllık std skoru) + 0.5×(ATR+BB TA skoru)
  value      → 0.6×(52h yüksekten uzaklık) + 0.4×(BB %B skoru)
  quality    → 0.5×(Calmar-benzeri skor) + 0.5×(ADX trend skoru)

Ağırlıklar profile göre ayarlanabilir (mevcut API değişmedi).
"""
import logging
import math
from datetime import datetime, timezone

import pandas as pd

from app.services.market_data import get_batch_price_history, get_ticker_info

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
    "momentum":   0.35,
    "value":      0.20,
    "quality":    0.20,
    "volatility": 0.25,
}


# ── Orijinal faktörler ────────────────────────────────────────────────────────

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
    """52 haftalık yüksekten uzaklık (%). Negatif = aşağıda = ucuz."""
    if len(price_history) < 20:
        return None
    try:
        current  = price_history[-1]["close"]
        high_52w = max(r["high"] for r in price_history)
        if high_52w <= 0:
            return None
        return (current / high_52w - 1) * 100
    except Exception:
        return None


def _quality_raw(price_history: list[dict]) -> float | None:
    """Risk-adjusted trend tutarlılığı (Calmar benzeri)."""
    if len(price_history) < 60:
        return None
    try:
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
        positive_ratio = sum(1 for r in monthly_returns if r > 0) / len(monthly_returns)
        avg_return     = sum(monthly_returns) / len(monthly_returns)
        return positive_ratio * avg_return
    except Exception:
        return None


# ── Teknik analiz faktörleri (pandas-ta) ────────────────────────────────────

def _build_df(price_history: list[dict]) -> "pd.DataFrame | None":
    """price_history listini pandas DataFrame'e çevirir."""
    if len(price_history) < 20:
        return None
    try:
        df = pd.DataFrame(price_history)[["close", "high", "low", "volume"]].copy()
        df = df.dropna()
        return df if len(df) >= 20 else None
    except Exception:
        return None


def _ta_momentum_score(df: "pd.DataFrame") -> float | None:
    """RSI(14) + MACD → momentum TA skoru (0–100)."""
    try:
        import pandas_ta as ta
        rsi = ta.rsi(df["close"], length=14)
        if rsi is None or rsi.empty:
            return None
        rsi_val = float(rsi.iloc[-1])
        if pd.isna(rsi_val):
            return None
        # RSI: 30 altı kötü, 70 üstü iyi
        rsi_score = max(0.0, min(100.0, (rsi_val - 30) / 40 * 100))

        macd_df = ta.macd(df["close"])
        macd_hist_score = 50.0
        if macd_df is not None and not macd_df.empty:
            hist_col = [c for c in macd_df.columns if "MACDh" in c]
            if hist_col:
                hist_val = float(macd_df[hist_col[0]].iloc[-1])
                if not pd.isna(hist_val):
                    macd_hist_score = 75.0 if hist_val > 0 else 25.0

        return rsi_score * 0.6 + macd_hist_score * 0.4
    except ImportError:
        return None
    except Exception as exc:
        logger.debug("TA momentum error: %s", exc)
        return None


def _ta_volatility_score(df: "pd.DataFrame") -> float | None:
    """ATR(14) + Bollinger Band genişliği → volatilite TA skoru (0–100)."""
    try:
        import pandas_ta as ta
        atr = ta.atr(df["high"], df["low"], df["close"], length=14)
        atr_score = 50.0
        if atr is not None and not atr.empty:
            atr_val = float(atr.iloc[-1])
            price   = float(df["close"].iloc[-1])
            if not pd.isna(atr_val) and price > 0:
                atr_pct   = atr_val / price * 100
                atr_score = max(0.0, min(100.0, (8.0 - atr_pct) / 6.0 * 100))

        bb = ta.bbands(df["close"], length=20)
        bb_score = 50.0
        if bb is not None and not bb.empty:
            bbu_col = [c for c in bb.columns if "BBU" in c]
            bbl_col = [c for c in bb.columns if "BBL" in c]
            bbm_col = [c for c in bb.columns if "BBM" in c]
            if bbu_col and bbl_col and bbm_col:
                bbu = float(bb[bbu_col[0]].iloc[-1])
                bbl = float(bb[bbl_col[0]].iloc[-1])
                bbm = float(bb[bbm_col[0]].iloc[-1])
                if not any(pd.isna(v) for v in [bbu, bbl, bbm]) and bbm > 0:
                    bbw      = (bbu - bbl) / bbm * 100
                    bb_score = max(0.0, min(100.0, (40.0 - bbw) / 30.0 * 100))

        return atr_score * 0.5 + bb_score * 0.5
    except ImportError:
        return None
    except Exception as exc:
        logger.debug("TA volatility error: %s", exc)
        return None


def _ta_value_score(df: "pd.DataFrame") -> float | None:
    """Bollinger Band %B → değerleme TA skoru (0–100). Alt band = ucuz = yüksek skor."""
    try:
        import pandas_ta as ta
        bb = ta.bbands(df["close"], length=20)
        if bb is None or bb.empty:
            return None
        bbu_col = [c for c in bb.columns if "BBU" in c]
        bbl_col = [c for c in bb.columns if "BBL" in c]
        if not (bbu_col and bbl_col):
            return None
        bbu   = float(bb[bbu_col[0]].iloc[-1])
        bbl   = float(bb[bbl_col[0]].iloc[-1])
        price = float(df["close"].iloc[-1])
        if pd.isna(bbu) or pd.isna(bbl) or (bbu - bbl) == 0:
            return None
        bb_pct_b = (price - bbl) / (bbu - bbl)
        return max(0.0, min(100.0, (1.0 - bb_pct_b) * 100))
    except ImportError:
        return None
    except Exception as exc:
        logger.debug("TA value error: %s", exc)
        return None


def _ta_quality_score(df: "pd.DataFrame") -> float | None:
    """ADX(14) → trend gücü TA skoru (0–100). Güçlü yükselen trend = kalite."""
    try:
        import pandas_ta as ta
        adx_df = ta.adx(df["high"], df["low"], df["close"], length=14)
        if adx_df is None or adx_df.empty:
            return None
        adx_col = [c for c in adx_df.columns if c.startswith("ADX_")]
        dmp_col = [c for c in adx_df.columns if "DMP" in c]
        dmn_col = [c for c in adx_df.columns if "DMN" in c]
        if not adx_col:
            return None
        adx_val = float(adx_df[adx_col[0]].iloc[-1])
        if pd.isna(adx_val):
            return None

        adx_strength = max(0.0, min(100.0, adx_val * 2))
        direction_bonus = 0.0
        if dmp_col and dmn_col:
            dmp = float(adx_df[dmp_col[0]].iloc[-1])
            dmn = float(adx_df[dmn_col[0]].iloc[-1])
            if not (pd.isna(dmp) or pd.isna(dmn)):
                direction_bonus = 20.0 if dmp > dmn else -20.0

        return max(0.0, min(100.0, adx_strength + direction_bonus))
    except ImportError:
        return None
    except Exception as exc:
        logger.debug("TA quality error: %s", exc)
        return None


# ── Normalizasyon ─────────────────────────────────────────────────────────────

def _to_score(raw: float | None, lo: float, hi: float, invert: bool = False) -> float:
    if raw is None:
        return 50.0
    if hi == lo:
        return 50.0
    score = (raw - lo) / (hi - lo) * 100
    score = max(0.0, min(100.0, score))
    return 100.0 - score if invert else score


_MOM_LO, _MOM_HI = -40.0,  40.0
_VOL_LO, _VOL_HI =   0.0,  40.0
_VAL_LO, _VAL_HI = -50.0,   0.0
_QUA_LO, _QUA_HI =  -5.0,   5.0


# ── Ana scoring ───────────────────────────────────────────────────────────────

def score_instruments(
    tickers: list[str],
    weights: dict | None = None,
) -> list[dict]:
    """
    Tüm tickerları batch olarak skorlar.
    pandas-ta mevcutsa orijinal faktörlerle harmanlar, yoksa sadece orijinal kullanır.
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    w_mom = weights.get("momentum",   DEFAULT_WEIGHTS["momentum"])
    w_val = weights.get("value",      DEFAULT_WEIGHTS["value"])
    w_qua = weights.get("quality",    DEFAULT_WEIGHTS["quality"])
    w_vol = weights.get("volatility", DEFAULT_WEIGHTS["volatility"])

    logger.info("Batch scoring %d instruments (TA-enhanced)", len(tickers))
    histories = get_batch_price_history(tickers, period="1y")
    now       = datetime.now(timezone.utc).isoformat()
    scored    = []

    for ticker in tickers:
        history       = histories.get(ticker, [])
        currency      = "TRY" if ticker.endswith(".IS") else "USD"
        current_price = history[-1]["close"] if history else 0

        # Orijinal faktörler
        mom_raw = _momentum_score(history)
        vol_raw = _volatility_raw(history)
        val_raw = _value_raw(history)
        qua_raw = _quality_raw(history)

        orig_mom = _to_score(mom_raw, _MOM_LO, _MOM_HI)
        orig_vol = _to_score(vol_raw, _VOL_LO, _VOL_HI, invert=True)
        orig_val = _to_score(val_raw, _VAL_LO, _VAL_HI, invert=True)
        orig_qua = _to_score(qua_raw, _QUA_LO, _QUA_HI)

        # TA faktörleri
        df = _build_df(history)
        ta_mom = ta_vol = ta_val = ta_qua = None
        ta_enabled = False

        if df is not None:
            ta_mom     = _ta_momentum_score(df)
            ta_vol     = _ta_volatility_score(df)
            ta_val     = _ta_value_score(df)
            ta_qua     = _ta_quality_score(df)
            ta_enabled = any(v is not None for v in [ta_mom, ta_vol, ta_val, ta_qua])

        if ta_enabled:
            mom_score = orig_mom * 0.6 + (ta_mom or orig_mom) * 0.4
            vol_score = orig_vol * 0.5 + (ta_vol or orig_vol) * 0.5
            val_score = orig_val * 0.6 + (ta_val or orig_val) * 0.4
            qua_score = orig_qua * 0.5 + (ta_qua or orig_qua) * 0.5
        else:
            mom_score, vol_score, val_score, qua_score = orig_mom, orig_vol, orig_val, orig_qua

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
                "taEnabled":    ta_enabled,
                "_raw": {
                    "momentum_pct":   round(mom_raw, 2) if mom_raw is not None else None,
                    "volatility_pct": round(vol_raw, 2) if vol_raw is not None else None,
                    "value_pct":      round(val_raw, 2) if val_raw is not None else None,
                    "quality_score":  round(qua_raw, 2) if qua_raw is not None else None,
                    "ta_momentum":    round(ta_mom, 1) if ta_mom is not None else None,
                    "ta_volatility":  round(ta_vol, 1) if ta_vol is not None else None,
                    "ta_value":       round(ta_val, 1) if ta_val is not None else None,
                    "ta_quality":     round(ta_qua, 1) if ta_qua is not None else None,
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
