"""
Assessment scoring unit tests — WP7 Task 7.1

Tests the pure scoring functions (no DB, no network).
"""
import pytest
from app.schemas.assessment import QuestionnaireAnswer
from app.services.assessment_service import (
    classify_horizon,
    classify_profile,
    compute_composite_score,
)


def _make_answers(option: int, count: int = 15) -> list[QuestionnaireAnswer]:
    return [QuestionnaireAnswer(questionId=i + 1, selectedOption=option) for i in range(count)]


# ── compute_composite_score ────────────────────────────────────────────────────

def test_all_zero_options():
    # All conservative answers → score 0
    answers = _make_answers(0)
    assert compute_composite_score(answers) == 0


def test_all_max_options():
    # All aggressive answers → score 100
    answers = _make_answers(3)
    assert compute_composite_score(answers) == 100


def test_mid_score():
    # Half max → ~50
    answers = _make_answers(1) + _make_answers(2)  # mix
    score = compute_composite_score(answers)
    assert 40 <= score <= 60


# ── classify_profile ──────────────────────────────────────────────────────────

def test_conservative_threshold():
    assert classify_profile(0) == "conservative"
    assert classify_profile(34) == "conservative"


def test_balanced_threshold():
    assert classify_profile(35) == "balanced"
    assert classify_profile(67) == "balanced"


def test_aggressive_threshold():
    assert classify_profile(68) == "aggressive"
    assert classify_profile(100) == "aggressive"


# ── classify_horizon ──────────────────────────────────────────────────────────

def test_short_horizon():
    # Questions 10-15, all option 0 → short term
    answers = [QuestionnaireAnswer(questionId=i, selectedOption=0) for i in range(1, 16)]
    assert classify_horizon(answers) == "short"


def test_long_horizon():
    # Questions 10-15, all option 3 → long term
    answers = [QuestionnaireAnswer(questionId=i, selectedOption=3) for i in range(1, 16)]
    assert classify_horizon(answers) == "long"


# ── RAD Scenario S-01 ─────────────────────────────────────────────────────────

def test_scenario_s01_conservative_short():
    """RAD Scenario S-01: Ali — low loss tolerance, 1 year horizon → Conservative/Short."""
    # Simulate all-conservative answers (option 0)
    answers = _make_answers(0)
    score = compute_composite_score(answers)
    profile = classify_profile(score)
    horizon = classify_horizon(answers)

    assert profile == "conservative"
    assert horizon == "short"


# ── RAD Scenario S-02 ─────────────────────────────────────────────────────────

def test_scenario_s02_aggressive_long():
    """RAD Scenario S-02: Zeynep — high risk, long horizon → Aggressive/Long."""
    answers = _make_answers(3)
    score = compute_composite_score(answers)
    profile = classify_profile(score)
    horizon = classify_horizon(answers)

    assert profile == "aggressive"
    assert horizon == "long"
