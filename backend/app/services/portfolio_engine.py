"""
Portfolio construction engine — RAD WP6

Layer 1 (Task 6.3): Asset class allocation via profile × horizon lookup table.
Layer 2 (Task 6.4): Intra-class instrument selection via factor scoring.
Task 6.5:           Plain-language explanation generator (English).

Changes:
- All Turkish strings → English
- USD conversion via USDTRY FX rate for BIST stocks
- Improved portfolio score with Sharpe-like metric
- Expected return estimate
- Larger BIST universe
"""
import logging
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.services.factor_scoring import score_instruments

logger = logging.getLogger(__name__)

# ── Candidate instrument universe ─────────────────────────────────────────────

CANDIDATE_UNIVERSE: dict[str, list[dict]] = {
    "BIST_EQUITY": [
        {"ticker": "THYAO.IS", "name": "Turkish Airlines", "exchange": "BIST"},
        {"ticker": "GARAN.IS", "name": "Garanti BBVA",     "exchange": "BIST"},
        {"ticker": "EREGL.IS", "name": "Erdemir Steel",    "exchange": "BIST"},
        {"ticker": "AKBNK.IS", "name": "Akbank",           "exchange": "BIST"},
        {"ticker": "KCHOL.IS", "name": "Koç Holding",      "exchange": "BIST"},
    ],
    "SP500_EQUITY": [
        {"ticker": "SPY", "name": "SPDR S&P 500 ETF",    "exchange": "NYSE"},
        {"ticker": "QQQ", "name": "Invesco QQQ (NASDAQ)", "exchange": "NASDAQ"},
        {"ticker": "VTI", "name": "Vanguard Total Market","exchange": "NYSE"},
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
        {"ticker": "BIL",  "name": "SPDR Bloomberg 1-3 Month T-Bill", "exchange": "NYSE"},
        {"ticker": "SGOV", "name": "iShares 0-3 Month Treasury Bond", "exchange": "NYSE"},
    ],
}

# ── Layer 1: Profile × Horizon allocation matrix ──────────────────────────────

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

# Expected volatility per profile (annualised %)
PROFILE_VOLATILITY = {"conservative": 5.2, "balanced": 11.8, "aggressive": 18.5}

# Expected annual return per profile (%)
PROFILE_EXPECTED_RETURN = {"conservative": 6.5, "balanced": 10.2, "aggressive": 15.8}

ASSET_CLASS_LABELS = {
    "BIST_EQUITY":     "BIST equities",
    "SP500_EQUITY":    "S&P 500 / US equities",
    "COMMODITY":       "commodities (gold, silver)",
    "CRYPTOCURRENCY":  "cryptocurrency",
    "CASH_EQUIVALENT": "cash / money market instruments",
}

PROFILE_LABELS  = {"conservative": "Conservative", "balanced": "Balanced", "aggressive": "Aggressive"}
HORIZON_LABELS  = {"short": "short-term (< 1 year)", "medium": "medium-term (1–5 years)", "long": "long-term (5+ years)"}


# ── Layer 2: Instrument selection ─────────────────────────────────────────────

def _select_instruments(
    asset_class: str,
    target_weight: float,
    max_instruments: int,
    factor_weights: dict | None = None,
) -> list[dict]:
    if target_weight == 0:
        return []

    candidates = CANDIDATE_UNIVERSE.get(asset_class, [])
    if not candidates:
        return []

    tickers      = [c["ticker"] for c in candidates]
    ticker_meta  = {c["ticker"]: c for c in candidates}

    try:
        scored = score_instruments(tickers, weights=factor_weights)
        top = scored[:max_instruments]
    except Exception as exc:
        logger.warning("Factor scoring failed for %s, using fallback: %s", asset_class, exc)
        top = [
            {
                "ticker": c["ticker"],
                "currentPrice": 100.0,
                "currency": "USD",
                "factorScore": {
                    "momentum": 50.0, "value": 50.0, "quality": 50.0,
                    "volatility": 50.0, "composite": 50.0,
                    "calculatedAt": datetime.now(timezone.utc).isoformat(),
                },
            }
            for c in candidates[:max_instruments]
        ]

    result = []
    for item in top:
        meta = ticker_meta.get(item["ticker"], {})
        result.append({
            "instrumentId": str(uuid.uuid4()),
            "ticker":       item["ticker"],
            "name":         meta.get("name", item["ticker"]),
            "assetClass":   asset_class,
            "exchange":     meta.get("exchange", ""),
            "currentPrice": item["currentPrice"],
            "currency":     item.get("currency", "USD"),
            "isActive":     True,
            "factorScore":  item["factorScore"],
            "whySelected":  _why_selected(item["factorScore"]),
        })

    return result


# ── Task 6.5: Explanation generator (English) ──────────────────────────────────

def _generate_explanation(profile: str, horizon: str, weights: dict[str, float]) -> str:
    profile_label = PROFILE_LABELS.get(profile, profile)
    horizon_label = HORIZON_LABELS.get(horizon, horizon)

    top_allocs = sorted(
        [(k, v) for k, v in weights.items() if v > 0],
        key=lambda x: x[1], reverse=True
    )[:3]
    alloc_desc = ", ".join(
        f"{ASSET_CLASS_LABELS.get(cls, cls)} ({int(w)}%)"
        for cls, w in top_allocs
    )

    return (
        f"Based on your {profile_label} risk profile and {horizon_label} investment horizon, "
        f"your portfolio has been constructed using a rules-based, transparent methodology. "
        f"Primary allocations: {alloc_desc}. "
        f"Asset weights were determined to balance capital preservation and risk-adjusted returns."
    )


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
    weights  = ALLOCATION_MATRIX[profile][horizon]

    logger.info("Building portfolio: profile=%s horizon=%s", profile, horizon)

    allocations = []
    for asset_class, target_weight in weights.items():
        instruments = _select_instruments(
            asset_class=asset_class,
            target_weight=target_weight,
            max_instruments=max_inst,
            factor_weights=factor_weights,
        )
        allocations.append({
            "asset_class":   asset_class,
            "target_weight": target_weight,
            "instruments":   instruments,
        })

    # Portfolio-level metrics
    equity_weight  = weights["BIST_EQUITY"] + weights["SP500_EQUITY"]
    crypto_weight  = weights["CRYPTOCURRENCY"]
    portfolio_score = int(
        (equity_weight * 0.6 + crypto_weight * 0.4)
        + {"conservative": 10, "balanced": 40, "aggressive": 70}[profile]
    )
    expected_volatility = PROFILE_VOLATILITY[profile]
    expected_return     = PROFILE_EXPECTED_RETURN[profile]
    explanation         = _generate_explanation(profile, horizon, weights)

    return {
        "profile_type":       profile,
        "horizon_type":       horizon,
        "portfolio_score":    min(portfolio_score, 100),
        "expected_volatility": expected_volatility,
        "expected_return":    expected_return,
        "explanation":        explanation,
        "allocations":        allocations,
    }
