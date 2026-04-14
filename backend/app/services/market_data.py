"""
Market data service — RAD Task 6.1
Fetches OHLCV data from yfinance with Redis caching (TTL 15 min, RAD NFR).

Cache key pattern:  market:ticker:<TICKER>
                    market:info:<TICKER>
"""
import json
import logging
from datetime import datetime, timezone

import yfinance as yf

from app.core.config import settings
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

_CACHE_PREFIX_HIST = "market:ticker:"
_CACHE_PREFIX_INFO = "market:info:"
_TTL = settings.YFINANCE_CACHE_TTL_MINUTES * 60  # seconds


def _cache_key_hist(ticker: str) -> str:
    return f"{_CACHE_PREFIX_HIST}{ticker}"


def _cache_key_info(ticker: str) -> str:
    return f"{_CACHE_PREFIX_INFO}{ticker}"


def get_price_history(ticker: str, period: str = "1y") -> list[dict]:
    """
    Returns OHLCV price history for a ticker.
    Checks Redis cache first; falls back to yfinance.
    Returns empty list on failure (RAD: useFallbackOnApiFailure).
    """
    redis = get_redis()
    cache_key = _cache_key_hist(f"{ticker}:{period}")

    # Try cache
    cached = redis.get(cache_key)
    if cached:
        logger.debug("Cache HIT for price history: %s", ticker)
        return json.loads(cached)

    # Fetch from yfinance
    try:
        logger.info("Fetching price history from yfinance: %s (period=%s)", ticker, period)
        ticker_obj = yf.Ticker(ticker)
        hist = ticker_obj.history(period=period)

        if hist.empty:
            logger.warning("yfinance returned empty history for %s", ticker)
            return []

        records = [
            {
                "date": str(idx.date()),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            }
            for idx, row in hist.iterrows()
        ]

        redis.setex(cache_key, _TTL, json.dumps(records))
        logger.debug("Cached price history for %s (%d points)", ticker, len(records))
        return records

    except Exception as exc:
        logger.error("yfinance error for %s: %s", ticker, exc)
        return []


def get_ticker_info(ticker: str) -> dict:
    """
    Returns fundamental info dict for a ticker (P/E, P/B, ROE, market cap, etc.)
    Used by factor scoring (Task 6.2).
    """
    redis = get_redis()
    cache_key = _cache_key_info(ticker)

    cached = redis.get(cache_key)
    if cached:
        logger.debug("Cache HIT for ticker info: %s", ticker)
        return json.loads(cached)

    try:
        logger.info("Fetching ticker info from yfinance: %s", ticker)
        info = yf.Ticker(ticker).info
        # Keep only what we need — full info dict can be huge
        slim = {
            "symbol": info.get("symbol", ticker),
            "shortName": info.get("shortName", ticker),
            "exchange": info.get("exchange", ""),
            "currentPrice": info.get("currentPrice") or info.get("regularMarketPrice", 0),
            "marketCap": info.get("marketCap"),
            "trailingPE": info.get("trailingPE"),
            "priceToBook": info.get("priceToBook"),
            "returnOnEquity": info.get("returnOnEquity"),
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
            "beta": info.get("beta"),
        }
        redis.setex(cache_key, _TTL, json.dumps(slim))
        return slim

    except Exception as exc:
        logger.error("yfinance info error for %s: %s", ticker, exc)
        return {}
