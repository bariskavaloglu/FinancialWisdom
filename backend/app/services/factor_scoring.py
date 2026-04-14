"""
Factor scoring engine — RAD Task 6.2

Four factors (RAD WP6):
  momentum   — 12-1 month return (last 12m close / close at month 1)
  value      — inverse P/B ratio (lower P/B = better value)
  quality    — Return on Equity (ROE)
  volatility — annualised standard deviation of daily returns (lower = better)

Each factor is normalised to 0-100 within a peer group.
Composite score = weighted average using SystemConfig.factorWeights.
"""
import logging
import math
from datetime import date, timedelta

from app.services.market_data import get_price_history, get_ticker_info

logger = logging.getLogger(__name__)

# Default factor weights (can be overridden by admin config — RAD UC-09)
DEFAULT_WEIGHTS = {
    "momentum": 0.30,
    "value": 0.20,
    "quality": 0.30,
    "volatility": 0.20,
}


def _momentum_score(price_history: list[dict]) -> float | None:
    """
    12-1 month return.
    Uses close prices: (close[-1] / close[~21 trading days ago]) - 1
    Skip last month to avoid reversal effect (standard factor construction).
    """
    if len(price_history) < 250:
        return None
    try:
        close_now = price_history[-22]["close"]   # 1 month ago (skip last month)
        close_12m = price_history[0]["close"]      # ~12 months ago
        if close_12m == 0:
            return None
        return (close_now / close_12m - 1) * 100  # percentage return
    except (IndexError, KeyError, ZeroDivisionError):
        return None


def _volatility_score_raw(price_history: list[dict]) -> float | None:
    """Annualised daily return std dev (%)."""
    if len(price_history) < 30:
        return None
    try:
        closes = [p["close"] for p in price_history if p["close"] > 0]
        if len(closes) < 2:
            return None
        returns = [(closes[i] / closes[i - 1] - 1) for i in range(1, len(closes))]
        mean = sum(returns) / len(returns)
        variance = sum((r - mean) ** 2 for r in returns) / len(returns)
        daily_std = math.sqrt(variance)
        return daily_std * math.sqrt(252) * 100  # annualised %
    except Exception:
        return None


def compute_raw_factors(ticker: str) -> dict:
    """
    Computes raw (un-normalised) factor values for a single ticker.
    Returns dict with keys: momentum, value, quality, volatility, currentPrice.
    Missing values are None.
    """
    history = get_price_history(ticker, period="1y")
    info = get_ticker_info(ticker)

    momentum = _momentum_score(history)
    vol_raw = _volatility_score_raw(history)

    # Value: inverse of P/B (lower P/B = higher value score, so we negate)
    pb = info.get("priceToBook")
    value_raw = (1 / pb) * 100 if pb and pb > 0 else None

    # Quality: ROE as percentage
    roe = info.get("returnOnEquity")
    quality_raw = roe * 100 if roe is not None else None

    current_price = info.get("currentPrice") or (history[-1]["close"] if history else 0)

    return {
        "ticker": ticker,
        "currentPrice": current_price,
        "momentum_raw": momentum,
        "value_raw": value_raw,
        "quality_raw": quality_raw,
        "volatility_raw": vol_raw,  # raw std dev — lower is better
    }


def _normalise(values: list[float | None], invert: bool = False) -> list[float]:
    """
    Min-max normalise a list to 0-100.
    invert=True → lower raw value maps to higher score (used for volatility).
    None values map to 50 (neutral).
    """
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
        normalised = (v - lo) / (hi - lo) * 100
        result.append(100 - normalised if invert else normalised)
    return result


def score_instruments(
    tickers: list[str],
    weights: dict | None = None,
) -> list[dict]:
    """
    Scores a list of tickers and returns them sorted by composite score (desc).

    Returns list of dicts:
      { ticker, currentPrice, factorScore: {momentum, value, quality, volatility, composite, calculatedAt} }
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    logger.info("Scoring %d instruments: %s", len(tickers), tickers)

    raw_list = [compute_raw_factors(t) for t in tickers]

    # Normalise each factor across the peer group
    mom_norm = _normalise([r["momentum_raw"] for r in raw_list])
    val_norm = _normalise([r["value_raw"] for r in raw_list])
    qua_norm = _normalise([r["quality_raw"] for r in raw_list])
    vol_norm = _normalise([r["volatility_raw"] for r in raw_list], invert=True)  # lower vol = better

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    scored = []
    for i, raw in enumerate(raw_list):
        composite = (
            weights["momentum"] * mom_norm[i]
            + weights["value"] * val_norm[i]
            + weights["quality"] * qua_norm[i]
            + weights["volatility"] * vol_norm[i]
        )
        scored.append({
            "ticker": raw["ticker"],
            "currentPrice": raw["currentPrice"],
            "factorScore": {
                "momentum": round(mom_norm[i], 1),
                "value": round(val_norm[i], 1),
                "quality": round(qua_norm[i], 1),
                "volatility": round(vol_norm[i], 1),
                "composite": round(composite, 1),
                "calculatedAt": now,
            },
        })

    scored.sort(key=lambda x: x["factorScore"]["composite"], reverse=True)
    return scored
