"""
Factor scoring engine — RAD Task 6.2

Rate-limit-friendly approach:
- Uses get_batch_price_history() → 1 yfinance request per asset class
- NO get_ticker_info() calls during scoring (derived from price history)
- value/quality factors disabled (require quoteSummary = 429 risk)
- momentum + volatility only → always available from price data
"""
import logging
import math
from datetime import datetime, timezone

from app.services.market_data import get_batch_price_history, get_ticker_info

logger = logging.getLogger(__name__)

# Only use factors derivable from price history (no API calls for fundamentals)
DEFAULT_WEIGHTS = {
    "momentum":   0.50,
    "value":      0.00,   # disabled — requires quoteSummary
    "quality":    0.00,   # disabled — requires quoteSummary
    "volatility": 0.50,
}


def _momentum_score(price_history: list[dict]) -> float | None:
    """12-month return, skip last month. Falls back to 3m if not enough data."""
    if len(price_history) >= 200:
        try:
            close_now = price_history[-22]["close"]
            close_12m = price_history[0]["close"]
            if close_12m > 0:
                return (close_now / close_12m - 1) * 100
        except (IndexError, KeyError, ZeroDivisionError):
            pass

    # 3-month fallback
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
    """Annualised daily return std dev (%)."""
    if len(price_history) < 20:
        return None
    try:
        closes = [p["close"] for p in price_history if p["close"] > 0]
        if len(closes) < 2:
            return None
        returns = [(closes[i] / closes[i - 1] - 1) for i in range(1, len(closes))]
        mean = sum(returns) / len(returns)
        variance = sum((r - mean) ** 2 for r in returns) / len(returns)
        return math.sqrt(variance) * math.sqrt(252) * 100
    except Exception:
        return None


def _normalise(values: list[float | None], invert: bool = False) -> list[float]:
    valid = [v for v in values if v is not None]
    if not valid:
        return [50.0] * len(values)
    lo, hi = min(valid), max(valid)
    result = []
    for v in values:
        if v is None:
            result.append(50.0)
            continue
        if hi == lo:
            result.append(50.0)
            continue
        n = (v - lo) / (hi - lo) * 100
        result.append(100 - n if invert else n)
    return result


def score_instruments(
    tickers: list[str],
    weights: dict | None = None,
) -> list[dict]:
    """
    Score tickers using a SINGLE batch download call per invocation.
    No parallel threads needed — one request handles all tickers.
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    logger.info("Batch scoring %d instruments: %s", len(tickers), tickers)

    # ONE batch request for all tickers
    histories = get_batch_price_history(tickers, period="1y")

    raw_list = []
    for ticker in tickers:
        history = histories.get(ticker, [])
        momentum = _momentum_score(history)
        vol_raw  = _volatility_raw(history)
        current_price = history[-1]["close"] if history else 0
        currency = "TRY" if ticker.endswith(".IS") else "USD"

        raw_list.append({
            "ticker":         ticker,
            "currentPrice":   current_price,
            "currency":       currency,
            "momentum_raw":   momentum,
            "volatility_raw": vol_raw,
        })

    # --- DÜZELTİLEN KISIM: HEM ANA SAYFA HEM DETAY İÇİN AYNI MATEMATİK ---
    mom_norm = []
    vol_norm = []
    
    for raw in raw_list:
        mom_raw = raw["momentum_raw"]
        vol_raw = raw["volatility_raw"]

        # Momentum: %0 getiri = 50 Puan, +%40 = 100 Puan, -%40 = 0 Puan
        if mom_raw is not None:
            mom_norm.append(max(0.0, min(100.0, 50.0 + (mom_raw * 1.25))))
        else:
            mom_norm.append(50.0)

        # Volatilite: %20 risk = 50 Puan, %40 risk = 0 Puan, %0 risk = 100 Puan
        if vol_raw is not None:
            vol_norm.append(max(0.0, min(100.0, 100.0 - (vol_raw / 40.0 * 100.0))))
        else:
            vol_norm.append(50.0)
    # -----------------------------------------------------------------------

    now = datetime.now(timezone.utc).isoformat()
    scored = []
    for i, raw in enumerate(raw_list):
        composite = (
            weights["momentum"]   * mom_norm[i]
            + weights["volatility"] * vol_norm[i]
        )
        scored.append({
            "ticker":       raw["ticker"],
            "currentPrice": raw["currentPrice"],
            "currency":     raw["currency"],
            "factorScore": {
                "momentum":     round(mom_norm[i], 1),
                "value":        50.0,
                "quality":      50.0,
                "volatility":   round(vol_norm[i], 1),
                "composite":    round(composite, 1),
                "calculatedAt": now,
            },
        })

    scored.sort(key=lambda x: x["factorScore"]["composite"], reverse=True)
    return scored


def compute_raw_factors(ticker: str) -> dict:
    """For single-ticker detail page."""
    from app.services.market_data import get_price_history
    history = get_price_history(ticker, period="1y")
    info    = get_ticker_info(ticker)
    return {
        "ticker":         ticker,
        "currentPrice":   info.get("currentPrice", 0),
        "currency":       info.get("currency", "USD"),
        "momentum_raw":   _momentum_score(history),
        "value_raw":      None,
        "quality_raw":    None,
        "volatility_raw": _volatility_raw(history),
    }


def score_single(ticker: str, weights: dict | None = None) -> dict | None:
    results = score_instruments([ticker], weights=weights)
    return results[0] if results else None
