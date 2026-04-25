"""
Market Pool router — tüm universe tickerlarının anlık verisi

GET /api/v1/pool                → tüm tickerların özet snapshot'ı
GET /api/v1/pool/{ticker}       → tek ticker'ın tam OHLCV + factor skoru
GET /api/v1/pool/refresh        → cache'i ısıt (admin/debug)
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.user import User
from app.services.market_data import (
    ALL_BIST,
    ALL_TICKERS,
    get_batch_price_history,
    get_price_history,
    get_usdtry_rate,
    warmup_cache,
)
from app.services.factor_scoring import score_instruments

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pool", tags=["market-pool"])

# Bilinen BIST hisse isimleri (Yahoo shortName yetersiz kalırsa kullanılır)
_BIST_NAMES: dict[str, str] = {
    "AKBNK.IS": "Akbank",
    "AKSEN.IS": "Aksa Enerji",
    "ARCLK.IS": "Arçelik",
    "ASELS.IS": "Aselsan",
    "BIMAS.IS": "BİM Mağazalar",
    "EKGYO.IS": "Emlak Konut GYO",
    "EREGL.IS": "Erdemir",
    "FROTO.IS": "Ford Otosan",
    "GARAN.IS": "Garanti BBVA",
    "GUBRF.IS": "Gübre Fabrikaları",
    "HALKB.IS": "Halkbank",
    "ISCTR.IS": "İş Bankası C",
    "KCHOL.IS": "Koç Holding",
    "KONTR.IS": "Kontrolmatik",
    "KOZAA.IS": "Koza Anadolu",
    "KOZAL.IS": "Koza Altın",
    "KRDMD.IS": "Kardemir D",
    "MGROS.IS": "Migros",
    "ODAS.IS": "Odaş Elektrik",
    "OYAKC.IS": "Oyak Çimento",
    "PETKM.IS": "Petkim",
    "SAHOL.IS": "Sabancı Holding",
    "SASA.IS": "SASA Polyester",
    "SISE.IS": "Şişecam",
    "TAVHL.IS": "TAV Havalimanları",
    "TCELL.IS": "Turkcell",
    "THYAO.IS": "Türk Hava Yolları",
    "TOASO.IS": "Tofaş",
    "TUPRS.IS": "Tüpraş",
    "VAKBN.IS": "Vakıfbank",
    "YKBNK.IS": "Yapı Kredi",
    "AEFES.IS": "Anadolu Efes",
    "AGROT.IS": "Agroterapi",
    "AKFGY.IS": "Akfen GYO",
    "AKGRT.IS": "Aksigorta",
    "ALARK.IS": "Alarko Holding",
    "ALBRK.IS": "Albaraka Türk",
    "ALFAS.IS": "Alfa Solar",
    "ANHYT.IS": "Anadolu Hayat",
    "ANSGR.IS": "Anadolu Sigorta",
    "ASUZU.IS": "Anadolu Isuzu",
    "AYDEN.IS": "Aydem Enerji",
    "BAGFS.IS": "Bagfaş",
    "BANVT.IS": "Banvit",
    "BIOEN.IS": "Biotrend Enerji",
    "BRISA.IS": "Brisa",
    "BRYAT.IS": "Borusan Yatırım",
    "BUCIM.IS": "Bursa Çimento",
    "CCOLA.IS": "Coca-Cola İçecek",
    "CEMTS.IS": "Çemtaş",
    "CIMSA.IS": "Çimsa",
    "CLEBI.IS": "Çelebi Hava",
    "DOAS.IS": "Doğuş Otomotiv",
    "DOHOL.IS": "Doğan Holding",
    "EGEEN.IS": "Ege Endüstri",
    "ENERU.IS": "Enerji SA",
    "ENJSA.IS": "Enerjisa Enerji",
    "ENKAI.IS": "Enka İnşaat",
    "FENER.IS": "Fenerbahçe SK",
    "GESAN.IS": "Gersan Elektrik",
    "GLYHO.IS": "Global Yatırım Holding",
    "GOLTS.IS": "Göltaş Çimento",
    "GRSEL.IS": "Grsel Taşımacılık",
    "HEKTS.IS": "Hektaş",
    "INDES.IS": "İndeks Bilgisayar",
    "IPEKE.IS": "İpek Doğal Enerji",
    "ISGYO.IS": "İş GYO",
    "JANTS.IS": "Jantsa",
    "KAREL.IS": "Karel Elektronik",
    "KATMR.IS": "Katmerciler",
    "KAYSE.IS": "Kayseri Şeker",
    "KERVT.IS": "Kervan Gıda",
    "KLNMA.IS": "Türkiye Kalkınma Bankası",
    "KMPUR.IS": "Kâmil Koç",
    "KONYA.IS": "Konya Çimento",
    "KORDS.IS": "Kordsa",
    "KTLEV.IS": "Katilim Emeklilik",
    "LOGO.IS": "Logo Yazılım",
    "LRSHO.IS": "Lider Faktoring",
    "MAVI.IS": "Mavi Giyim",
    "MEDTR.IS": "Meditera",
    "METUR.IS": "Metur Turizm",
    "MPARK.IS": "MLP Sağlık",
    "NETAS.IS": "Netaş Telekomünikasyon",
    "NTHOL.IS": "Net Holding",
    "OTKAR.IS": "Otokar",
    "PARSN.IS": "Parsan",
    "PGSUS.IS": "Pegasus",
    "PRKAB.IS": "Türk Prysmian Kablo",
    "QUAGR.IS": "Quagr",
    "RAYSG.IS": "Ray Sigorta",
    "RGYAS.IS": "Reysaş GYO",
    "RYSAS.IS": "Reysaş Taşımacılık",
    "SARKY.IS": "Sarkuysan",
    "SELEC.IS": "Selçuk Ecza",
    "SMRTG.IS": "Smart Güneş",
    "SNKRN.IS": "Şeker Finansman",
    "SOKM.IS": "Şok Marketler",
    "SUMAS.IS": "Sumaş",
    "TATGD.IS": "Tat Gıda",
    "TKNSA.IS": "Teknosa",
    "TLMAN.IS": "Tüloman",
    "TRGYO.IS": "Torunlar GYO",
    "TRILC.IS": "Trilc",
    "TSPOR.IS": "Trabzonspor",
    "TTKOM.IS": "Türk Telekom",
    "TURSG.IS": "Turismo",
    "VESTL.IS": "Vestel",
    "YEOTK.IS": "Ye-o Tekstil",
    "ZOREN.IS": "Zorlu Enerji",
}

def _build_ticker_meta() -> dict[str, dict]:
    """
    TICKER_META'yı dinamik olarak oluşturur.
    Yeni BIST tickerı eklemek için sadece market_data.py'deki ALL_BIST listesini güncellemek yeterli.
    """
    meta: dict[str, dict] = {}

    # BIST hisseleri — otomatik olarak ALL_BIST'ten
    for ticker in ALL_BIST:
        meta[ticker] = {
            "name": _BIST_NAMES.get(ticker, ticker.replace(".IS", "")),
            "assetClass": "BIST_EQUITY",
            "exchange": "BIST",
        }

    # Sabit non-BIST araçlar
    meta.update({
        "SPY":     {"name": "SPDR S&P 500 ETF",      "assetClass": "SP500_EQUITY",    "exchange": "NYSE"},
        "QQQ":     {"name": "Invesco QQQ (NASDAQ)",   "assetClass": "SP500_EQUITY",    "exchange": "NASDAQ"},
        "VTI":     {"name": "Vanguard Total Market",  "assetClass": "SP500_EQUITY",    "exchange": "NYSE"},
        "GLD":     {"name": "SPDR Gold Shares",       "assetClass": "COMMODITY",       "exchange": "NYSE"},
        "SLV":     {"name": "iShares Silver Trust",   "assetClass": "COMMODITY",       "exchange": "NYSE"},
        "IAU":     {"name": "iShares Gold Trust",     "assetClass": "COMMODITY",       "exchange": "NYSE"},
        "BTC-USD": {"name": "Bitcoin",                "assetClass": "CRYPTOCURRENCY",  "exchange": "CRYPTO"},
        "ETH-USD": {"name": "Ethereum",               "assetClass": "CRYPTOCURRENCY",  "exchange": "CRYPTO"},
        "BIL":     {"name": "SPDR 1-3 Month T-Bill", "assetClass": "CASH_EQUIVALENT", "exchange": "NYSE"},
        "SGOV":    {"name": "iShares 0-3M Treasury", "assetClass": "CASH_EQUIVALENT", "exchange": "NYSE"},
    })
    return meta

# Uygulama genelinde kullanılan metadata sözlüğü
TICKER_META: dict[str, dict] = _build_ticker_meta()

PRICE_TICKERS = [t for t in ALL_TICKERS if not t.endswith("=X")]


def _change_pct(history: list[dict]) -> float | None:
    """Son 2 kapanış arasındaki % değişim."""
    if len(history) < 2:
        return None
    prev  = history[-2]["close"]
    curr  = history[-1]["close"]
    if prev == 0:
        return None
    return round((curr / prev - 1) * 100, 2)


def _to_usd(price: float, ticker: str, usdtry: float) -> float:
    if ticker.endswith(".IS") and usdtry > 0:
        return round(price / usdtry, 4)
    return price


@router.get("")
def get_pool_snapshot(
    period: str = Query("1y", pattern="^(1m|3m|1y|2y)$"),
    asset_class: str | None = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Tüm universe tickerlarının anlık özet verisi.
    Her ticker için: fiyat, günlük değişim, 52h, factor skorları.
    """
    period_map = {"1m": "1mo", "3m": "3mo", "1y": "1y", "2y": "2y"}
    yf_period  = period_map.get(period, "1y")

    # Filtre
    tickers = PRICE_TICKERS
    if asset_class:
        tickers = [t for t in tickers if TICKER_META.get(t, {}).get("assetClass") == asset_class]

    # Batch fiyat çek
    histories = get_batch_price_history(tickers, period=yf_period)

    # Factor skorları
    try:
        scores_list = score_instruments(tickers)
        scores = {s["ticker"]: s for s in scores_list}
    except Exception as exc:
        logger.warning("Pool factor scoring başarısız: %s", exc)
        scores = {}

    usdtry = get_usdtry_rate()

    items = []
    for ticker in tickers:
        meta    = TICKER_META.get(ticker, {})
        history = histories.get(ticker, [])
        score   = scores.get(ticker, {})

        current_price_raw = history[-1]["close"] if history else 0
        current_price     = _to_usd(current_price_raw, ticker, usdtry)
        week52_high_raw   = max((r["high"]  for r in history), default=None)
        week52_low_raw    = min((r["low"]   for r in history), default=None)
        week52_high       = _to_usd(week52_high_raw, ticker, usdtry) if week52_high_raw else None
        week52_low        = _to_usd(week52_low_raw,  ticker, usdtry) if week52_low_raw  else None

        items.append({
            "ticker":        ticker,
            "name":          meta.get("name", ticker),
            "assetClass":    meta.get("assetClass", ""),
            "exchange":      meta.get("exchange", ""),
            "currency":      "USD",
            "currentPrice":  current_price,
            "dailyChange":   _change_pct(history),
            "week52High":    week52_high,
            "week52Low":     week52_low,
            "dataPoints":    len(history),
            "lastUpdated":   history[-1]["date"] if history else None,
            "factorScore":   score.get("factorScore"),
        })

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "usdtryRate":  usdtry,
        "period":      period,
        "count":       len(items),
        "items":       items,
    }


@router.get("/refresh")
def refresh_pool_cache(
    current_user: User = Depends(get_current_user),
):
    """Cache warmup'ı manuel tetikle (sadece admin değil, tüm auth kullanıcılar)."""
    summary = warmup_cache()
    return {
        "message": "Cache refresh tamamlandı",
        "summary": summary,
    }


@router.get("/{ticker}")
def get_pool_ticker_detail(
    ticker: str,
    period: str = Query("1y", pattern="^(1m|3m|1y|2y)$"),
    current_user: User = Depends(get_current_user),
):
    """Tek ticker için tam OHLCV geçmişi + factor skorları."""
    period_map = {"1m": "1mo", "3m": "3mo", "1y": "1y", "2y": "2y"}
    yf_period  = period_map.get(period, "1y")

    history = get_price_history(ticker, period=yf_period)
    meta    = TICKER_META.get(ticker, {"name": ticker, "assetClass": "", "exchange": ""})
    usdtry  = get_usdtry_rate()

    try:
        scores_list  = score_instruments([ticker])
        factor_score = scores_list[0]["factorScore"] if scores_list else None
    except Exception:
        factor_score = None

    current_price_raw = history[-1]["close"] if history else 0
    current_price     = _to_usd(current_price_raw, ticker, usdtry)

    return {
        "ticker":       ticker,
        "name":         meta.get("name", ticker),
        "assetClass":   meta.get("assetClass", ""),
        "exchange":     meta.get("exchange", ""),
        "currency":     "USD",
        "currentPrice": current_price,
        "dailyChange":  _change_pct(history),
        "period":       period,
        "history":      history,
        "factorScore":  factor_score,
        "generatedAt":  datetime.now(timezone.utc).isoformat(),
    }
