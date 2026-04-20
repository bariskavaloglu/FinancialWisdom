"""
Market data service — RAD Task 6.1

Rate-limit strategy:
1. yf.download() with multi-ticker batch per asset class (1 request for N tickers)
2. Sequential asset class processing (not parallel) — avoids 429
3. Redis cache: 15min for price history, 4h for info
4. Exponential backoff with longer waits
"""
import json
import logging
import time
from datetime import datetime, timezone

import yfinance as yf

from app.core.config import settings
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

_CACHE_PREFIX_HIST = "market:ticker:"
_CACHE_PREFIX_INFO = "market:info:"
_CACHE_PREFIX_FX   = "market:fx:"
_TTL      = settings.YFINANCE_CACHE_TTL_MINUTES * 60
_TTL_INFO = 60 * 60 * 4

_YF_TIMEOUT  = 20
_MAX_RETRIES = 3
_BACKOFF_BASE = 3.0   # longer backoff to respect rate limits


def _retry(fn, *args, **kwargs):
    for attempt in range(_MAX_RETRIES):
        try:
            result = fn(*args, **kwargs)
            return result
        except Exception as exc:
            wait = _BACKOFF_BASE ** attempt
            logger.warning("yfinance attempt %d/%d failed (%s) — waiting %.1fs",
                           attempt + 1, _MAX_RETRIES, exc, wait)
            time.sleep(wait)
    return None


def get_usdtry_rate() -> float:
    redis = get_redis()
    key = f"{_CACHE_PREFIX_FX}USDTRY"
    cached = redis.get(key)
    if cached:
        return float(cached)
    try:
        df = yf.download("USDTRY=X", period="5d", interval="1d",
                         progress=False, timeout=_YF_TIMEOUT)
        if df is not None and not df.empty:
            rate = float(df["Close"].dropna().iloc[-1])
            redis.setex(key, 3600, str(rate))
            return rate
    except Exception as exc:
        logger.warning("USDTRY fetch failed: %s", exc)
    return 38.0


def _flatten_df(df, ticker: str):
    """
    Normalise a yfinance DataFrame to a flat (date-indexed) DataFrame
    with columns [Open, High, Low, Close, Volume].

    yfinance ≥ 0.2.x returns MultiIndex columns in ALL cases:
      - Single ticker:  level-0 = field name,  level-1 = ticker  → (Close, SPY)
      - Multi  ticker with group_by='ticker':
                        level-0 = ticker,       level-1 = field   → (SPY, Close)

    We detect which layout we have and flatten accordingly.
    """
    import pandas as pd

    if df is None or df.empty:
        return None

    if isinstance(df.columns, pd.MultiIndex):
        lvl0 = df.columns.get_level_values(0).unique().tolist()
        lvl1 = df.columns.get_level_values(1).unique().tolist()

        # Layout A: (field, ticker)  — single-ticker download
        if ticker in lvl1 and "Close" in lvl0:
            df = df.xs(ticker, axis=1, level=1)   # → flat columns: Open, High, …

        # Layout B: (ticker, field) — multi-ticker download
        elif ticker in lvl0:
            df = df[ticker]                        # → flat columns: Open, High, …

        else:
            logger.warning("Cannot locate ticker %s in MultiIndex %s / %s", ticker, lvl0[:5], lvl1[:5])
            return None

    # At this point df should have flat string columns
    # Rename "Adj Close" → "Close" if needed (auto_adjust=False fallback)
    if "Adj Close" in df.columns and "Close" not in df.columns:
        df = df.rename(columns={"Adj Close": "Close"})

    required = {"Open", "High", "Low", "Close", "Volume"}
    missing = required - set(df.columns)
    if missing:
        logger.warning("Missing columns %s for %s", missing, ticker)
        return None

    return df


def get_price_history(ticker: str, period: str = "1y") -> list[dict]:
    """Fetch single ticker OHLCV with retry."""
    redis = get_redis()
    cache_key = f"{_CACHE_PREFIX_HIST}{ticker}:{period}"

    cached = redis.get(cache_key)
    if cached:
        logger.debug("Cache HIT history: %s [%s]", ticker, period)
        return json.loads(cached)

    logger.info("Fetching price history: %s (period=%s)", ticker, period)

    def _fetch():
        return yf.download(ticker, period=period, progress=False,
                           auto_adjust=True, timeout=_YF_TIMEOUT)

    raw_df = _retry(_fetch)
    flat = _flatten_df(raw_df, ticker)

    if flat is None or flat.empty:
        logger.warning("No price data for %s", ticker)
        return []

    try:
        records = []
        for idx, row in flat.iterrows():
            try:
                close_val = float(row["Close"])
                if close_val != close_val:   # NaN
                    continue
                records.append({
                    "date":   str(idx.date()),
                    "open":   round(float(row["Open"]),  4),
                    "high":   round(float(row["High"]),  4),
                    "low":    round(float(row["Low"]),   4),
                    "close":  round(close_val,           4),
                    "volume": int(row.get("Volume", 0) or 0),
                })
            except (ValueError, TypeError):
                continue
        redis.setex(cache_key, _TTL, json.dumps(records))
        return records
    except Exception as exc:
        logger.error("Error processing history for %s: %s", ticker, exc)
        return []


def get_batch_price_history(tickers: list[str], period: str = "1y") -> dict[str, list[dict]]:
    """
    Download multiple tickers in a SINGLE yfinance request.
    Much more efficient and rate-limit-friendly than individual calls.
    Returns {ticker: [records]} dict.
    """
    redis = get_redis()

    # Check which tickers need fetching
    to_fetch = []
    results: dict[str, list[dict]] = {}

    for ticker in tickers:
        cache_key = f"{_CACHE_PREFIX_HIST}{ticker}:{period}"
        cached = redis.get(cache_key)
        if cached:
            logger.debug("Cache HIT history: %s [%s]", ticker, period)
            results[ticker] = json.loads(cached)
        else:
            to_fetch.append(ticker)

    if not to_fetch:
        return results

    logger.info("Batch fetching %d tickers: %s", len(to_fetch), to_fetch)

    def _fetch_batch():
        # yf.download with multiple tickers returns MultiIndex columns
        df = yf.download(
            " ".join(to_fetch),
            period=period,
            progress=False,
            auto_adjust=True,
            timeout=_YF_TIMEOUT,
            group_by="ticker",
        )
        return df

    df = _retry(_fetch_batch)

    if df is None or df.empty:
        logger.warning("Batch fetch returned empty for %s", to_fetch)
        for ticker in to_fetch:
            results[ticker] = []
        return results

    # Parse multi-ticker response using _flatten_df for correct MultiIndex handling
    for ticker in to_fetch:
        try:
            flat = _flatten_df(df, ticker)

            if flat is None or flat.empty:
                logger.warning("No data for %s in batch response", ticker)
                results[ticker] = []
                continue

            records = []
            for idx, row in flat.iterrows():
                try:
                    close_val = float(row["Close"])
                    if close_val != close_val:  # NaN check
                        continue
                    records.append({
                        "date":   str(idx.date()),
                        "open":   round(float(row["Open"]),  4),
                        "high":   round(float(row["High"]),  4),
                        "low":    round(float(row["Low"]),   4),
                        "close":  round(close_val, 4),
                        "volume": int(row.get("Volume", 0) or 0),
                    })
                except (ValueError, TypeError):
                    continue

            cache_key = f"{_CACHE_PREFIX_HIST}{ticker}:{period}"
            if records:
                redis.setex(cache_key, _TTL, json.dumps(records))
            results[ticker] = records

        except Exception as exc:
            logger.warning("Error parsing batch data for %s: %s", ticker, exc)
            results[ticker] = []

    return results


def get_ticker_info(ticker: str) -> dict:
    """
    Derives info entirely from price history — no quoteSummary, no 429.
    """
    redis = get_redis()
    cache_key = f"{_CACHE_PREFIX_INFO}{ticker}"

    cached = redis.get(cache_key)
    if cached:
        logger.debug("Cache HIT info: %s", ticker)
        return json.loads(cached)

    history = get_price_history(ticker, period="1y")

    currency = "TRY" if ticker.endswith(".IS") else "USD"

    slim = {
        "symbol":           ticker,
        "shortName":        ticker,
        "exchange":         "BIST" if ticker.endswith(".IS") else "",
        "currency":         currency,
        "currentPrice":     history[-1]["close"] if history else 0,
        "marketCap":        None,
        "trailingPE":       None,
        "priceToBook":      None,
        "returnOnEquity":   None,
        "fiftyTwoWeekHigh": max(r["high"] for r in history) if history else None,
        "fiftyTwoWeekLow":  min(r["low"]  for r in history) if history else None,
        "beta":             None,
    }

    redis.setex(cache_key, _TTL_INFO, json.dumps(slim))
    return slim