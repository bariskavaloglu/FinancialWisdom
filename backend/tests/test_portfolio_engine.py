"""
Portfolio engine unit tests — WP7 Task 7.1

Tests Layer 1 allocation and basic engine output without network calls.
"""
from unittest.mock import patch
import pytest
from app.services.portfolio_engine import (
    ALLOCATION_MATRIX,
    build_portfolio,
)


# ── Layer 1 allocation matrix ─────────────────────────────────────────────────

def test_all_weights_sum_to_100():
    """Every profile/horizon combination must sum to exactly 100%."""
    for profile, horizons in ALLOCATION_MATRIX.items():
        for horizon, weights in horizons.items():
            total = sum(weights.values())
            assert total == 100, f"{profile}/{horizon} sums to {total}, expected 100"


def test_conservative_no_crypto():
    """RAD constraint: conservative profiles have 0% cryptocurrency."""
    for horizon, weights in ALLOCATION_MATRIX["conservative"].items():
        assert weights["CRYPTOCURRENCY"] == 0, f"conservative/{horizon} has crypto allocation"


def test_aggressive_has_crypto():
    """Aggressive profiles should have meaningful crypto exposure."""
    for horizon, weights in ALLOCATION_MATRIX["aggressive"].items():
        assert weights["CRYPTOCURRENCY"] > 0, f"aggressive/{horizon} has no crypto"


def test_scenario_s01_allocation():
    """RAD Scenario S-01: conservative/short → 50% cash, 25% commodity, no crypto."""
    weights = ALLOCATION_MATRIX["conservative"]["short"]
    assert weights["CASH_EQUIVALENT"] == 50
    assert weights["COMMODITY"] == 25
    assert weights["CRYPTOCURRENCY"] == 0


def test_scenario_s02_allocation():
    """RAD Scenario S-02: aggressive/long → high equity + crypto."""
    weights = ALLOCATION_MATRIX["aggressive"]["long"]
    total_equity = weights["BIST_EQUITY"] + weights["SP500_EQUITY"]
    assert total_equity >= 50
    assert weights["CRYPTOCURRENCY"] >= 20


# ── build_portfolio ───────────────────────────────────────────────────────────

def _mock_score_instruments(tickers, weights=None):
    """Returns neutral factor scores without network calls."""
    from datetime import datetime, timezone
    return [
        {
            "ticker": t,
            "currentPrice": 100.0,
            "factorScore": {
                "momentum": 50.0, "value": 50.0, "quality": 50.0,
                "volatility": 50.0, "composite": 50.0,
                "calculatedAt": datetime.now(timezone.utc).isoformat(),
            },
        }
        for t in tickers
    ]


@patch("app.services.portfolio_engine.score_instruments", side_effect=_mock_score_instruments)
def test_build_portfolio_conservative_short(mock_score):
    result = build_portfolio("conservative", "short")
    assert result["profile_type"] == "conservative"
    assert result["horizon_type"] == "short"
    # No crypto allocation
    crypto_allocs = [a for a in result["allocations"] if a["asset_class"] == "CRYPTOCURRENCY"]
    assert all(a["target_weight"] == 0 for a in crypto_allocs)


@patch("app.services.portfolio_engine.score_instruments", side_effect=_mock_score_instruments)
def test_build_portfolio_has_explanation(mock_score):
    result = build_portfolio("balanced", "medium")
    assert result["explanation"]
    assert "Dengeli" in result["explanation"]


@patch("app.services.portfolio_engine.score_instruments", side_effect=_mock_score_instruments)
def test_build_portfolio_invalid_profile(mock_score):
    with pytest.raises(ValueError, match="Unknown profile"):
        build_portfolio("unknown_profile", "medium")


@patch("app.services.portfolio_engine.score_instruments", side_effect=_mock_score_instruments)
def test_build_portfolio_allocations_count(mock_score):
    result = build_portfolio("aggressive", "long")
    # Should have all 5 asset classes
    asset_classes = {a["asset_class"] for a in result["allocations"]}
    assert "BIST_EQUITY" in asset_classes
    assert "CRYPTOCURRENCY" in asset_classes
    assert "CASH_EQUIVALENT" in asset_classes
