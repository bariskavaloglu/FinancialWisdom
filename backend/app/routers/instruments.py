"""
Instruments router — RAD UC-07 (View Asset Detail)

GET /instruments/:ticker        → price history + factor scores + metrics
GET /instruments/:ticker/history?period=1m|3m|1y  → OHLCV only

Changes:
- period parameter reaches yfinance properly (chart fix)
- USD-normalised prices for BIST stocks
- English "why selected" reasons
"""
import logging

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.user import User
from app.services.factor_scoring import score_instruments
from app.services.market_data import get_price_history, get_ticker_info, get_usdtry_rate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/instruments", tags=["instruments"])

PERIOD_MAP = {"1m": "1mo", "3m": "3mo", "1y": "1y", "2y": "2y"}


def _to_usd(price: float, currency: str) -> float:
    """Convert price to USD. BIST stocks are quoted in TRY."""
    if currency and currency.upper() == "TRY" and price > 0:
        rate = get_usdtry_rate()
        return round(price / rate, 4)
    return price


@router.get("/{ticker}")
def get_instrument_detail(
    ticker: str,
    period: str = Query("1y", pattern="^(1m|3m|1y|2y)$"),
    current_user: User = Depends(get_current_user),
):
    """
    Returns full instrument detail: price history, factor scores, key metrics.
    RAD UC-07 main flow step 2-3.
    Alternative flow 2a: returns isStale=True if data unavailable.
    """
    yf_period = PERIOD_MAP.get(period, "1y")
    price_history = get_price_history(ticker, period=yf_period)
    info = get_ticker_info(ticker)
    is_stale = not price_history and not info

    currency = info.get("currency", "USD")

    try:
        scored = score_instruments([ticker])
        factor_score  = scored[0]["factorScore"] if scored else None
        current_price = scored[0]["currentPrice"] if scored else info.get("currentPrice", 0)
    except Exception as exc:
        logger.warning("Factor scoring failed for %s: %s", ticker, exc)
        factor_score  = None
        current_price = info.get("currentPrice", 0)

    # Normalise price to USD
    current_price_usd = _to_usd(current_price, currency)

    return {
        "instrumentId":    ticker,
        "ticker":          ticker,
        "name":            info.get("shortName", ticker),
        "exchange":        info.get("exchange", ""),
        "currency":        "USD",
        "currentPrice":    current_price_usd,
        "isActive":        True,
        "isStale":         is_stale,
        "priceHistory":    price_history,
        "factorScore":     factor_score,
        "metrics": {
            "marketCap":  info.get("marketCap"),
            "peRatio":    info.get("trailingPE"),
            "pbRatio":    info.get("priceToBook"),
            "roe":        info.get("returnOnEquity"),
            "week52High": info.get("fiftyTwoWeekHigh"),
            "week52Low":  info.get("fiftyTwoWeekLow"),
            "beta":       info.get("beta"),
        },
        "whySelected": _why_selected(factor_score),
    }


@router.get("/{ticker}/history")
def get_price_history_endpoint(
    ticker: str,
    period: str = Query("1y", pattern="^(1m|3m|1y|2y)$"),
    current_user: User = Depends(get_current_user),
):
    """Returns OHLCV price history only (lighter endpoint for chart re-renders)."""
    yf_period = PERIOD_MAP.get(period, "1y")
    return {"ticker": ticker, "period": period, "data": get_price_history(ticker, yf_period)}


def _why_selected(factor_score: dict | None) -> list[str]:
    if not factor_score:
        return ["Selected by rules-based portfolio algorithm."]
    reasons = []
    if factor_score.get("momentum", 0) >= 65:
        reasons.append("Strong price momentum (12-month return)")
    if factor_score.get("quality", 0) >= 65:
        reasons.append("High quality score (strong ROE)")
    if factor_score.get("volatility", 0) >= 65:
        reasons.append("Low volatility — capital preservation")
    if factor_score.get("value", 0) >= 65:
        reasons.append("Attractive valuation (low P/B ratio)")
    if not reasons:
        reasons.append("Balanced factor profile — portfolio diversification")
    return reasons
