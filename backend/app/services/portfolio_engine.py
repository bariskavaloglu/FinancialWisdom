"""
Portfolio construction engine — RAD WP6

Layer 1 (Task 6.3): Asset class allocation via profile × horizon lookup table.
Layer 2 (Task 6.4): Intra-class instrument selection via factor scoring.
Task 6.5:           Plain-language explanation generator.

This module is the Python heart of the system. The frontend's
services/index.ts had this logic client-side; here it lives server-side
with real yfinance data and proper factor scoring.
"""
import logging
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.services.factor_scoring import score_instruments

logger = logging.getLogger(__name__)

# ── Candidate instrument universe ─────────────────────────────────────────────
# Tickers available per asset class. Layer 2 selects top-N by factor score.

CANDIDATE_UNIVERSE: dict[str, list[dict]] = {
    "BIST_EQUITY": [
        {"ticker": "THYAO.IS", "name": "Türk Hava Yolları",  "exchange": "BIST"},
        {"ticker": "GARAN.IS", "name": "Garanti BBVA",        "exchange": "BIST"},
        {"ticker": "EREGL.IS", "name": "Ereğli Demir Çelik", "exchange": "BIST"},
        {"ticker": "AKBNK.IS", "name": "Akbank",              "exchange": "BIST"},
        {"ticker": "SASA.IS",  "name": "Sasa Polyester",      "exchange": "BIST"},
    ],
    "SP500_EQUITY": [
        {"ticker": "SPY",  "name": "SPDR S&P 500 ETF",     "exchange": "NYSE"},
        {"ticker": "QQQ",  "name": "Invesco QQQ (NASDAQ)", "exchange": "NASDAQ"},
        {"ticker": "VTI",  "name": "Vanguard Total Market", "exchange": "NYSE"},
        {"ticker": "IVV",  "name": "iShares Core S&P 500", "exchange": "NYSE"},
    ],
    "COMMODITY": [
        {"ticker": "GLD", "name": "SPDR Gold Shares",    "exchange": "NYSE"},
        {"ticker": "SLV", "name": "iShares Silver Trust","exchange": "NYSE"},
        {"ticker": "IAU", "name": "iShares Gold Trust",  "exchange": "NYSE"},
    ],
    "CRYPTOCURRENCY": [
        {"ticker": "BTC-USD", "name": "Bitcoin",  "exchange": "CRYPTO"},
        {"ticker": "ETH-USD", "name": "Ethereum", "exchange": "CRYPTO"},
    ],
    "CASH_EQUIVALENT": [
        {"ticker": "BIL",   "name": "SPDR Bloomberg 1-3 Month T-Bill", "exchange": "NYSE"},
        {"ticker": "SGOV",  "name": "iShares 0-3 Month Treasury Bond", "exchange": "NYSE"},
    ],
}

# ── Layer 1: Profile × Horizon allocation matrix ──────────────────────────────
# RAD Scenarios S-01 (conservative/short) and S-02 (aggressive/long) are encoded here.

ALLOCATION_MATRIX: dict[str, dict[str, dict[str, float]]] = {
    "conservative": {
        "short":  {"BIST_EQUITY": 20, "SP500_EQUITY": 5,  "COMMODITY": 25, "CRYPTOCURRENCY": 0,  "CASH_EQUIVALENT": 50},
        "medium": {"BIST_EQUITY": 30, "SP500_EQUITY": 10, "COMMODITY": 20, "CRYPTOCURRENCY": 0,  "CASH_EQUIVALENT": 40},
        "long":   {"BIST_EQUITY": 35, "SP500_EQUITY": 15, "COMMODITY": 20, "CRYPTOCURRENCY": 0,  "CASH_EQUIVALENT": 30},
    },
    "balanced": {
        "short":  {"BIST_EQUITY": 25, "SP500_EQUITY": 15, "COMMODITY": 20, "CRYPTOCURRENCY": 5,  "CASH_EQUIVALENT": 35},
        "medium": {"BIST_EQUITY": 35, "SP500_EQUITY": 20, "COMMODITY": 15, "CRYPTOCURRENCY": 10, "CASH_EQUIVALENT": 20},
        "long":   {"BIST_EQUITY": 40, "SP500_EQUITY": 20, "COMMODITY": 15, "CRYPTOCURRENCY": 15, "CASH_EQUIVALENT": 10},
    },
    "aggressive": {
        "short":  {"BIST_EQUITY": 30, "SP500_EQUITY": 20, "COMMODITY": 15, "CRYPTOCURRENCY": 15, "CASH_EQUIVALENT": 20},
        "medium": {"BIST_EQUITY": 35, "SP500_EQUITY": 20, "COMMODITY": 10, "CRYPTOCURRENCY": 20, "CASH_EQUIVALENT": 15},
        "long":   {"BIST_EQUITY": 35, "SP500_EQUITY": 20, "COMMODITY": 10, "CRYPTOCURRENCY": 25, "CASH_EQUIVALENT": 10},
    },
}

# Expected volatility per profile (used for portfolio-level metrics)
PROFILE_VOLATILITY = {"conservative": 5.2, "balanced": 11.8, "aggressive": 18.5}

# Asset class display names for explanations
ASSET_CLASS_LABELS = {
    "BIST_EQUITY": "BIST hisse senetleri",
    "SP500_EQUITY": "S&P 500 / ABD hisse senetleri",
    "COMMODITY": "emtia (altın, gümüş)",
    "CRYPTOCURRENCY": "kripto para",
    "CASH_EQUIVALENT": "nakit / para piyasası araçları",
}

PROFILE_LABELS = {"conservative": "Muhafazakâr", "balanced": "Dengeli", "aggressive": "Agresif"}
HORIZON_LABELS = {"short": "kısa vadeli (1 yıldan az)", "medium": "orta vadeli (1-5 yıl)", "long": "uzun vadeli (5+ yıl)"}


# ── Layer 2: Instrument selection ─────────────────────────────────────────────

def _select_instruments(
    asset_class: str,
    target_weight: float,
    max_instruments: int,
    factor_weights: dict | None = None,
) -> list[dict]:
    """
    Scores all candidates for an asset class and returns top-N instruments.
    Falls back to static data if yfinance is unavailable.
    """
    if target_weight == 0:
        return []

    candidates = CANDIDATE_UNIVERSE.get(asset_class, [])
    if not candidates:
        return []

    tickers = [c["ticker"] for c in candidates]
    ticker_meta = {c["ticker"]: c for c in candidates}

    try:
        scored = score_instruments(tickers, weights=factor_weights)
        top = scored[:max_instruments]
    except Exception as exc:
        logger.warning("Factor scoring failed for %s, using fallback: %s", asset_class, exc)
        # Fallback: return candidates in original order with neutral scores
        top = [
            {
                "ticker": c["ticker"],
                "currentPrice": 100.0,
                "factorScore": {
                    "momentum": 50.0, "value": 50.0, "quality": 50.0,
                    "volatility": 50.0, "composite": 50.0,
                    "calculatedAt": datetime.now(timezone.utc).isoformat(),
                },
            }
            for c in candidates[:max_instruments]
        ]

    # Merge scored data with static metadata
    result = []
    for item in top:
        meta = ticker_meta.get(item["ticker"], {})
        result.append({
            "instrumentId": str(uuid.uuid4()),
            "ticker": item["ticker"],
            "name": meta.get("name", item["ticker"]),
            "assetClass": asset_class,
            "exchange": meta.get("exchange", ""),
            "currentPrice": item["currentPrice"],
            "isActive": True,
            "factorScore": item["factorScore"],
        })

    return result


# ── Task 6.5: Explanation generator ───────────────────────────────────────────

def _generate_explanation(profile: str, horizon: str, weights: dict[str, float]) -> str:
    profile_label = PROFILE_LABELS.get(profile, profile)
    horizon_label = HORIZON_LABELS.get(horizon, horizon)

    # Describe top 3 allocations
    top_allocs = sorted(
        [(k, v) for k, v in weights.items() if v > 0],
        key=lambda x: x[1], reverse=True
    )[:3]
    alloc_desc = ", ".join(
        f"{ASSET_CLASS_LABELS.get(cls, cls)} (%{int(w)})"
        for cls, w in top_allocs
    )

    return (
        f"{profile_label} risk profiliniz ve {horizon_label} yatırım ufkunuza göre "
        f"portföyünüz oluşturuldu. Ağırlıklı olarak {alloc_desc} içermektedir. "
        f"Sermaye koruma ve risk-getiri dengesi gözetilerek, kural tabanlı ve şeffaf "
        f"bir yöntemle varlık dağılımı belirlenmiştir."
    )


# ── Public API ────────────────────────────────────────────────────────────────

def build_portfolio(
    profile: str,
    horizon: str,
    factor_weights: dict | None = None,
    max_instruments: int | None = None,
) -> dict:
    """
    Full two-layer portfolio construction.

    Returns a dict ready to be persisted as Portfolio + AssetAllocation rows.
    Raises ValueError for unknown profile/horizon combinations.
    """
    if profile not in ALLOCATION_MATRIX:
        raise ValueError(f"Unknown profile: {profile}")
    if horizon not in ALLOCATION_MATRIX[profile]:
        raise ValueError(f"Unknown horizon: {horizon}")

    max_inst = max_instruments or settings.MAX_INSTRUMENTS_PER_CLASS
    weights = ALLOCATION_MATRIX[profile][horizon]

    logger.info("Building portfolio: profile=%s horizon=%s", profile, horizon)

    # Layer 1 + Layer 2
    allocations = []
    for asset_class, target_weight in weights.items():
        instruments = _select_instruments(
            asset_class=asset_class,
            target_weight=target_weight,
            max_instruments=max_inst,
            factor_weights=factor_weights,
        )
        allocations.append({
            "asset_class": asset_class,
            "target_weight": target_weight,
            "instruments": instruments,
        })

    # Portfolio-level metrics
    equity_weight = weights["BIST_EQUITY"] + weights["SP500_EQUITY"]
    crypto_weight = weights["CRYPTOCURRENCY"]
    portfolio_score = int(
        (equity_weight * 0.6 + crypto_weight * 0.4)
        + {"conservative": 10, "balanced": 40, "aggressive": 70}[profile]
    )
    expected_volatility = PROFILE_VOLATILITY[profile]
    explanation = _generate_explanation(profile, horizon, weights)

    return {
        "profile_type": profile,
        "horizon_type": horizon,
        "portfolio_score": min(portfolio_score, 100),
        "expected_volatility": expected_volatility,
        "explanation": explanation,
        "allocations": allocations,
    }
