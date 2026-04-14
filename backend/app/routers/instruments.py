"""
Instruments router — RAD UC-07 (View Asset Detail)

GET /instruments/:ticker        → price history + factor scores + metrics
GET /instruments/:ticker/history?period=1m|3m|1y  → OHLCV only
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.user import User
from app.services.factor_scoring import compute_raw_factors, score_instruments
from app.services.market_data import get_price_history, get_ticker_info

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/instruments", tags=["instruments"])

PERIOD_MAP = {"1m": "1mo", "3m": "3mo", "1y": "1y", "2y": "2y"}


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

    # Factor scores for this single instrument (scored against itself → neutral peer group)
    try:
        scored = score_instruments([ticker])
        factor_score = scored[0]["factorScore"] if scored else None
        current_price = scored[0]["currentPrice"] if scored else info.get("currentPrice", 0)
    except Exception as exc:
        logger.warning("Factor scoring failed for %s: %s", ticker, exc)
        factor_score = None
        current_price = info.get("currentPrice", 0)

    return {
        "instrumentId": ticker,
        "ticker": ticker,
        "name": info.get("shortName", ticker),
        "exchange": info.get("exchange", ""),
        "currentPrice": current_price,
        "isActive": True,
        "isStale": is_stale,
        "priceHistory": price_history,
        "factorScore": factor_score,
        "metrics": {
            "marketCap": info.get("marketCap"),
            "peRatio": info.get("trailingPE"),
            "pbRatio": info.get("priceToBook"),
            "roe": info.get("returnOnEquity"),
            "week52High": info.get("fiftyTwoWeekHigh"),
            "week52Low": info.get("fiftyTwoWeekLow"),
            "beta": info.get("beta"),
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
        return ["Kural tabanlı portföy algoritmasıyla seçildi."]
    reasons = []
    if factor_score.get("momentum", 0) >= 65:
        reasons.append("Güçlü fiyat momentumu (son 12 ay getirisi)")
    if factor_score.get("quality", 0) >= 65:
        reasons.append("Yüksek kalite skoru (güçlü ROE)")
    if factor_score.get("volatility", 0) >= 65:
        reasons.append("Düşük volatilite — sermaye koruması")
    if factor_score.get("value", 0) >= 65:
        reasons.append("Cazip değerleme (düşük F/DD oranı)")
    if not reasons:
        reasons.append("Dengeli faktör profili — portföy çeşitlendirmesi")
    return reasons
