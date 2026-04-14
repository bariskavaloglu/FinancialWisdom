"""
Assessment service — RAD UC-03 scoring logic (server-side).

Mirrors the scoring in the frontend's services/index.ts but lives here
so the algorithm is authoritative and testable.
"""
from app.schemas.assessment import QuestionnaireAnswer


def compute_composite_score(answers: list[QuestionnaireAnswer]) -> int:
    """
    Each of 15 questions is scored 0-3 (option index).
    Total range: 0-45 → normalised to 0-100.
    """
    if not answers:
        return 0
    total = sum(a.selectedOption for a in answers)
    max_possible = len(answers) * 3
    return round((total / max_possible) * 100)


def classify_profile(composite_score: int) -> str:
    """
    RAD thresholds: 0-34 conservative, 35-67 balanced, 68-100 aggressive.
    """
    if composite_score < 35:
        return "conservative"
    elif composite_score < 68:
        return "balanced"
    return "aggressive"


def classify_horizon(answers: list[QuestionnaireAnswer]) -> str:
    """
    Investment horizon is derived independently from risk profile (RAD key differentiator).
    Questions 10-15 (ids 10-15) cover investment horizon and liquidity.
    """
    horizon_answers = [a for a in answers if a.questionId >= 10]
    if not horizon_answers:
        return "medium"
    score = sum(a.selectedOption for a in horizon_answers)
    max_score = len(horizon_answers) * 3
    ratio = score / max_score
    if ratio < 0.35:
        return "short"
    elif ratio < 0.68:
        return "medium"
    return "long"
