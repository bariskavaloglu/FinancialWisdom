"""
Market data service — RAD Task 6.1  (revised: raw Yahoo Finance API)

Rate-limit strategy:
1. Ham Yahoo Finance /v8/finance/chart endpoint'i — yfinance wrapper'ı bypass eder
2. query1 → query2 endpoint fallback (429 veya timeout durumunda)
3. Batch download için yfinance.download() hâlâ kullanılır (1 istek / N ticker)
4. Redis cache: 15dk fiyat geçmişi, 4 saat info
5. Exponential backoff
6. Startup warmup: uygulama açılışında tüm tickerlar önceden çekilir
"""

import json
import logging
import time
from datetime import datetime, timezone

import requests
import yfinance as yf

from app.core.config import settings
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

_CACHE_PREFIX_HIST = "market:ticker:"
_CACHE_PREFIX_INFO = "market:info:"
_CACHE_PREFIX_FX   = "market:fx:"
_TTL               = settings.YFINANCE_CACHE_TTL_MINUTES * 60
_TTL_INFO          = 60 * 60 * 4
_TTL_WARMUP        = 60 * 60 * 23   # warmup cache'i 23 saat geçerli

_MAX_RETRIES  = 3
_BACKOFF_BASE = 3.0
_REQ_TIMEOUT  = 15  # saniye

# Yahoo Finance endpoint'leri — query1 önce denenir, 429'da query2'ye geçilir
_YF_ENDPOINTS = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
]

# Tarayıcı gibi görünmek için User-Agent — bot engelini aşar
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── BIST Hisse Listeleri ──────────────────────────────────────────────────────

# BIST 30 — Yahoo Finance .IS formatı
BIST_30: list[str] = [
    "AKBNK.IS", "AKSEN.IS", "ARCLK.IS", "ASELS.IS", "BIMAS.IS",
    "EKGYO.IS", "EREGL.IS", "FROTO.IS", "GARAN.IS", "GUBRF.IS",
    "HALKB.IS", "ISCTR.IS", "KCHOL.IS", "KONTR.IS", "KOZAA.IS",
    "KOZAL.IS", "KRDMD.IS", "MGROS.IS", "ODAS.IS",  "OYAKC.IS",
    "PETKM.IS", "SAHOL.IS", "SASA.IS",  "SISE.IS",  "TAVHL.IS",
    "TCELL.IS", "THYAO.IS", "TOASO.IS", "TUPRS.IS", "VAKBN.IS",
    "YKBNK.IS",
]

# BIST 100'den ek önemli hisseler (BIST 30 dışı)
BIST_100_EXTRA: list[str] = [
    "AEFES.IS", "AGROT.IS", "AKFGY.IS", "AKGRT.IS", "ALARK.IS",
    "ALBRK.IS", "ALFAS.IS", "ANHYT.IS", "ANSGR.IS", "ASUZU.IS",
    "AYDEN.IS", "BAGFS.IS", "BANVT.IS", "BIOEN.IS", "BRISA.IS",
    "BRYAT.IS", "BUCIM.IS", "CCOLA.IS", "CEMTS.IS", "CIMSA.IS",
    "CLEBI.IS", "DOAS.IS",  "DOHOL.IS", "EGEEN.IS", "ENERU.IS",
    "ENJSA.IS", "ENKAI.IS", "FENER.IS", "GESAN.IS", "GLYHO.IS",
    "GOLTS.IS", "GRSEL.IS", "HEKTS.IS", "INDES.IS", "IPEKE.IS",
    "ISGYO.IS", "JANTS.IS", "KAREL.IS", "KATMR.IS", "KAYSE.IS",
    "KERVT.IS", "KLNMA.IS", "KMPUR.IS", "KONYA.IS", "KORDS.IS",
    "KTLEV.IS", "LOGO.IS",  "LRSHO.IS", "MAVI.IS",  "MEDTR.IS",
    "METUR.IS", "MPARK.IS", "NETAS.IS", "NTHOL.IS", "OTKAR.IS",
    "PARSN.IS", "PGSUS.IS", "PRKAB.IS", "QUAGR.IS", "RAYSG.IS",
    "RGYAS.IS", "RYSAS.IS", "SARKY.IS", "SELEC.IS", "SMRTG.IS",
    "SNKRN.IS", "SOKM.IS",  "SUMAS.IS", "TATGD.IS", "TKNSA.IS",
    "TLMAN.IS", "TRGYO.IS", "TRILC.IS", "TSPOR.IS", "TTKOM.IS",
    "TURSG.IS", "VESTL.IS", "YEOTK.IS", "ZOREN.IS",
]

# Tüm BIST hisseleri (tekrar içermez)
ALL_BIST: list[str] = list(dict.fromkeys(BIST_30 + BIST_100_EXTRA))

# Tüm uygulamadaki ticker listesi — warmup için
ALL_TICKERS: list[str] = [
    # BIST (BIST 30 + BIST 100 kapsamlı liste)
    *ALL_BIST,
    # S&P 500 / ETF
    "SPY", "QQQ", "VTI",
    # Emtia
    "GLD", "SLV", "IAU",
    # Kripto
    "BTC-USD", "ETH-USD",
    # Para piyasası
    "BIL", "SGOV",
    # FX
    "USDTRY=X",
]


# ── Yardımcı: Ham Yahoo API isteği ───────────────────────────────────────────

def _yahoo_chart(ticker: str, period: str = "1y", interval: str = "1d") -> dict | None:
    """
    Ham /v8/finance/chart isteği yapar.
    query1 → query2 sırasıyla dener; ikisi de başarısız olursa None döner.
    """
    params = {
        "range":    period,
        "interval": interval,
        "events":   "history",
        "includeAdjustedClose": "true",
    }

    for base_url in _YF_ENDPOINTS:
        url = f"{base_url}/v8/finance/chart/{ticker}"
        for attempt in range(_MAX_RETRIES):
            try:
                resp = requests.get(
                    url,
                    params=params,
                    headers=_HEADERS,
                    timeout=_REQ_TIMEOUT,
                )
                if resp.status_code == 429:
                    wait = _BACKOFF_BASE ** (attempt + 1)
                    logger.warning(
                        "429 Rate limit — %s (attempt %d/%d) — %.1fs bekleniyor",
                        base_url, attempt + 1, _MAX_RETRIES, wait,
                    )
                    time.sleep(wait)
                    continue

                if resp.status_code != 200:
                    logger.warning("HTTP %d — %s %s", resp.status_code, base_url, ticker)
                    break  # Bu endpoint'ten vazgeç, diğerini dene

                data = resp.json()
                result = data.get("chart", {}).get("result")
                if not result:
                    error = data.get("chart", {}).get("error")
                    logger.warning("Yahoo API boş sonuç — %s: %s", ticker, error)
                    return None

                return result[0]

            except requests.exceptions.Timeout:
                wait = _BACKOFF_BASE ** attempt
                logger.warning(
                    "Timeout — %s %s (attempt %d/%d) — %.1fs bekleniyor",
                    base_url, ticker, attempt + 1, _MAX_RETRIES, wait,
                )
                time.sleep(wait)

            except Exception as exc:
                logger.warning("İstek hatası — %s %s: %s", base_url, ticker, exc)
                break  # Bu endpoint başarısız, diğerini dene

    logger.error("Tüm Yahoo endpoint'leri başarısız — ticker: %s", ticker)
    return None


def _parse_chart_to_records(chart_result: dict) -> list[dict]:
    """
    Yahoo /v8/finance/chart response'unu OHLCV kayıt listesine çevirir.
    """
    try:
        timestamps = chart_result.get("timestamp", [])
        indicators = chart_result.get("indicators", {})
        quote      = indicators.get("quote", [{}])[0]
        adjclose   = indicators.get("adjclose", [{}])
        adj_list   = adjclose[0].get("adjclose", []) if adjclose else []

        opens   = quote.get("open",   [])
        highs   = quote.get("high",   [])
        lows    = quote.get("low",    [])
        closes  = quote.get("close",  [])
        volumes = quote.get("volume", [])

        # Adjusted close varsa onu kullan (auto_adjust=True ile aynı davranış)
        effective_closes = adj_list if len(adj_list) == len(closes) else closes

        records = []
        for i, ts in enumerate(timestamps):
            try:
                c = effective_closes[i]
                if c is None or c != c:  # None veya NaN
                    continue
                records.append({
                    "date":   datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"),
                    "open":   round(float(opens[i])   if opens[i]   is not None else c, 4),
                    "high":   round(float(highs[i])   if highs[i]   is not None else c, 4),
                    "low":    round(float(lows[i])    if lows[i]    is not None else c, 4),
                    "close":  round(float(c), 4),
                    "volume": int(volumes[i] or 0) if i < len(volumes) else 0,
                })
            except (TypeError, ValueError, IndexError):
                continue

        return records

    except Exception as exc:
        logger.error("Chart parse hatası: %s", exc)
        return []


# ── Yardımcı: yfinance batch (çok sayıda ticker için) ────────────────────────

def _retry(fn, *args, **kwargs):
    for attempt in range(_MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            wait = _BACKOFF_BASE ** attempt
            logger.warning(
                "yfinance deneme %d/%d başarısız (%s) — %.1fs bekleniyor",
                attempt + 1, _MAX_RETRIES, exc, wait,
            )
            time.sleep(wait)
    return None


def _flatten_df(df, ticker: str):
    """
    yfinance ≥ 0.2.x MultiIndex sütunlarını düzleştirir.
    Layout A: (field, ticker) — tek ticker download
    Layout B: (ticker, field) — çok ticker download
    """
    import pandas as pd

    if df is None or df.empty:
        return None

    if isinstance(df.columns, pd.MultiIndex):
        lvl0 = df.columns.get_level_values(0).unique().tolist()
        lvl1 = df.columns.get_level_values(1).unique().tolist()

        if ticker in lvl1 and "Close" in lvl0:
            df = df.xs(ticker, axis=1, level=1)
        elif ticker in lvl0:
            df = df[ticker]
        else:
            logger.warning(
                "MultiIndex'te ticker bulunamadı %s — lvl0=%s lvl1=%s",
                ticker, lvl0[:5], lvl1[:5],
            )
            return None

    if "Adj Close" in df.columns and "Close" not in df.columns:
        df = df.rename(columns={"Adj Close": "Close"})

    required = {"Open", "High", "Low", "Close", "Volume"}
    missing  = required - set(df.columns)
    if missing:
        logger.warning("Eksik sütunlar %s — %s", missing, ticker)
        return None

    return df


# ── Ana servis fonksiyonları ──────────────────────────────────────────────────

def get_usdtry_rate() -> float:
    redis = get_redis()
    key   = f"{_CACHE_PREFIX_FX}USDTRY"
    cached = redis.get(key)
    if cached:
        return float(cached)

    # Ham API ile dene
    chart = _yahoo_chart("USDTRY=X", period="5d", interval="1d")
    if chart:
        records = _parse_chart_to_records(chart)
        if records:
            rate = records[-1]["close"]
            redis.setex(key, 3600, str(rate))
            return rate

    logger.warning("USDTRY çekilemedi, varsayılan kullanılıyor: 38.0")
    return 38.0


def get_price_history(ticker: str, period: str = "1y") -> list[dict]:
    """Tek ticker OHLCV — önce cache, yoksa ham Yahoo API."""
    redis     = get_redis()
    cache_key = f"{_CACHE_PREFIX_HIST}{ticker}:{period}"

    cached = redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        logger.debug("Cache HIT history: %s [%s] — %d kayıt", ticker, period, len(data))
        return data

    logger.info("Fiyat geçmişi çekiliyor: %s (period=%s)", ticker, period)

    chart   = _yahoo_chart(ticker, period=period, interval="1d")
    records = _parse_chart_to_records(chart) if chart else []

    if not records:
        logger.warning("%s için veri yok", ticker)
        return []

    logger.info("%s — %d kayıt çekildi", ticker, len(records))
    redis.setex(cache_key, _TTL, json.dumps(records))
    return records


def get_batch_price_history(
    tickers: list[str],
    period: str = "1y",
) -> dict[str, list[dict]]:
    """
    Birden fazla ticker'ı TEK bir yfinance.download() isteğiyle çeker.
    Cache'de olan tickerlar atlanır — sadece eksikler indirilir.
    """
    redis   = get_redis()
    results: dict[str, list[dict]] = {}
    to_fetch: list[str] = []

    for ticker in tickers:
        cache_key = f"{_CACHE_PREFIX_HIST}{ticker}:{period}"
        cached    = redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            logger.debug("Cache HIT history: %s [%s] — %d kayıt", ticker, period, len(data))
            results[ticker] = data
        else:
            to_fetch.append(ticker)

    if not to_fetch:
        return results

    logger.info("Batch fetch — %d ticker: %s", len(to_fetch), to_fetch)

    # Tek ticker ise ham API daha güvenilir
    if len(to_fetch) == 1:
        t       = to_fetch[0]
        records = get_price_history(t, period)
        results[t] = records
        return results

    # Çoklu ticker → yfinance batch (1 istek = N ticker)
    def _fetch_batch():
        return yf.download(
            " ".join(to_fetch),
            period=period,
            progress=False,
            auto_adjust=True,
            timeout=20,
            group_by="ticker",
        )

    df = _retry(_fetch_batch)

    if df is None or df.empty:
        logger.warning("Batch fetch boş döndü — tek tek deneniyor: %s", to_fetch)
        # Fallback: tek tek ham API
        for ticker in to_fetch:
            results[ticker] = get_price_history(ticker, period)
        return results

    for ticker in to_fetch:
        try:
            flat = _flatten_df(df, ticker)
            if flat is None or flat.empty:
                logger.warning("Batch'te %s için veri yok — ham API fallback", ticker)
                results[ticker] = get_price_history(ticker, period)
                continue

            records = []
            for idx, row in flat.iterrows():
                try:
                    c = float(row["Close"])
                    if c != c:  # NaN
                        continue
                    records.append({
                        "date":   str(idx.date()),
                        "open":   round(float(row["Open"]),  4),
                        "high":   round(float(row["High"]),  4),
                        "low":    round(float(row["Low"]),   4),
                        "close":  round(c, 4),
                        "volume": int(row.get("Volume", 0) or 0),
                    })
                except (ValueError, TypeError):
                    continue

            if not records:
                logger.warning("Batch parse sonrası %s boş — ham API fallback", ticker)
                results[ticker] = get_price_history(ticker, period)
                continue

            cache_key = f"{_CACHE_PREFIX_HIST}{ticker}:{period}"
            redis.setex(cache_key, _TTL, json.dumps(records))
            results[ticker] = records
            logger.debug("Batch OK — %s: %d kayıt", ticker, len(records))

        except Exception as exc:
            logger.warning("Batch parse hatası %s: %s — ham API fallback", ticker, exc)
            results[ticker] = get_price_history(ticker, period)

    return results


def get_ticker_info(ticker: str) -> dict:
    """
    Fiyat geçmişinden türetilmiş özet bilgi — quoteSummary çağrısı yok (429 riski).
    """
    redis     = get_redis()
    cache_key = f"{_CACHE_PREFIX_INFO}{ticker}"

    cached = redis.get(cache_key)
    if cached:
        logger.debug("Cache HIT info: %s", ticker)
        return json.loads(cached)

    history  = get_price_history(ticker, period="1y")
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


# ── Cache Warmup ──────────────────────────────────────────────────────────────

def warmup_cache(tickers: list[str] | None = None, period: str = "1y") -> dict:
    """
    Uygulama başlangıcında tüm tickerları önceden çeker ve cache'e yazar.
    Böylece kullanıcı isteği geldiğinde yfinance/Yahoo'ya hiç istek atılmaz.

    main.py lifespan fonksiyonundan çağrılır:
        from app.services.market_data import warmup_cache
        warmup_cache()

    Dönen dict:
        {"total": N, "success": M, "failed": [...]}
    """
    targets = tickers or ALL_TICKERS
    logger.info("Cache warmup başlıyor — %d ticker", len(targets))

    redis = get_redis()

    # FX ayrıca işle
    fx_tickers    = [t for t in targets if t.endswith("=X")]
    price_tickers = [t for t in targets if not t.endswith("=X")]

    failed: list[str] = []
    success           = 0

    # FX tickerları
    for ticker in fx_tickers:
        cache_key = f"{_CACHE_PREFIX_FX}{ticker.replace('=X', '')}"
        if redis.get(cache_key):
            logger.debug("Warmup skip (cached): %s", ticker)
            success += 1
            continue
        chart   = _yahoo_chart(ticker, period="5d", interval="1d")
        records = _parse_chart_to_records(chart) if chart else []
        if records:
            redis.setex(cache_key, 3600, str(records[-1]["close"]))
            success += 1
        else:
            failed.append(ticker)
        time.sleep(0.5)   # throttle

    # Fiyat tickerları — 10'ar 10'ar batch
    batch_size = 10
    for i in range(0, len(price_tickers), batch_size):
        batch = price_tickers[i: i + batch_size]

        # Cache'te olmayan tickerları filtrele
        missing = [
            t for t in batch
            if not redis.get(f"{_CACHE_PREFIX_HIST}{t}:{period}")
        ]
        already = len(batch) - len(missing)
        success += already

        if not missing:
            logger.info("Warmup skip (cached): %s", batch)
            continue

        logger.info("Warmup batch %d/%d: %s", i // batch_size + 1,
                    (len(price_tickers) - 1) // batch_size + 1, missing)

        results = get_batch_price_history(missing, period)

        for ticker, records in results.items():
            if records:
                success += 1
            else:
                failed.append(ticker)
                logger.warning("Warmup başarısız: %s", ticker)

        if i + batch_size < len(price_tickers):
            time.sleep(2)   # batch arası throttle — rate limit koruması

    summary = {"total": len(targets), "success": success, "failed": failed}
    logger.info(
        "Cache warmup tamamlandı — %d/%d başarılı, başarısız: %s",
        success, len(targets), failed or "yok",
    )
    return summary