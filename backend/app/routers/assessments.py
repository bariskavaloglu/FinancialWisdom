"""
Assessments router — RAD UC-03 (Complete Risk Assessment) and UC-08 (Update Risk Profile)

POST /assessments          → submit answers, classify profile, trigger portfolio generation
GET  /assessments/latest   → fetch most recent assessment result
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.assessment import RiskAssessment
from app.models.portfolio import AssetAllocation, Portfolio
from app.models.user import User
from app.schemas.assessment import AssessmentResult, AssessmentSubmitRequest
from app.services.assessment_service import (
    classify_horizon,
    classify_profile,
    compute_composite_score,
)
from app.services.portfolio_engine import build_portfolio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assessments", tags=["assessments"])


# ── UC-03 / UC-08: Submit questionnaire ──────────────────────────────────────

@router.post("", response_model=AssessmentResult, status_code=status.HTTP_201_CREATED)
def submit_assessment(
    body: AssessmentSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts 15 questionnaire answers, scores them, classifies the user,
    and generates a new portfolio recommendation.

    RAD UC-03 main flow steps 3-6.
    RAD UC-08: re-submission archives old profile and generates new portfolio.
    """
    # Step 3: compute composite score and classify
    composite_score = compute_composite_score(body.answers)
    profile_type = classify_profile(composite_score)
    horizon_type = classify_horizon(body.answers)

    logger.info(
        "Assessment submitted: user=%s score=%d profile=%s horizon=%s",
        current_user.id, composite_score, profile_type, horizon_type,
    )

    # Step 4: persist assessment
    assessment = RiskAssessment(
        user_id=current_user.id,
        answers=[a.model_dump() for a in body.answers],
        composite_score=composite_score,
        profile_type=profile_type,
        horizon_type=horizon_type,
    )
    db.add(assessment)
    db.flush()  # get assessment.id before portfolio FK

    # UC-08: mark all previous portfolios as not current
    db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id,
        Portfolio.is_current == True,
    ).update({"is_current": False})

    # Trigger portfolio generation (Layer 1 + Layer 2)
    try:
        engine_result = build_portfolio(profile_type, horizon_type)
    except Exception as exc:
        logger.error("Portfolio engine error: %s", exc, exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Portfolio generation failed. Please try again.",
        )

    # Update assessment explanation from engine
    assessment.explanation = engine_result["explanation"]

    # Persist portfolio
    portfolio = Portfolio(
        user_id=current_user.id,
        assessment_id=assessment.id,
        profile_type=profile_type,
        horizon_type=horizon_type,
        is_current=True,
        portfolio_score=engine_result["portfolio_score"],
        expected_volatility=engine_result["expected_volatility"],
        explanation=engine_result["explanation"],
    )
    db.add(portfolio)
    db.flush()

    # Persist asset allocations (Layer 1 + 2 results)
    for alloc_data in engine_result["allocations"]:
        if alloc_data["target_weight"] > 0:
            alloc = AssetAllocation(
                portfolio_id=portfolio.id,
                asset_class=alloc_data["asset_class"],
                target_weight=alloc_data["target_weight"],
                instruments=alloc_data["instruments"],
            )
            db.add(alloc)

    db.commit()
    logger.info("Portfolio generated: id=%s for user=%s", portfolio.id, current_user.id)

    return AssessmentResult(
        assessmentId=str(assessment.id),
        profileType=profile_type,
        investmentHorizon=horizon_type,
        compositeScore=composite_score,
        explanation=engine_result["explanation"],
        portfolioId=str(portfolio.id),
    )


# ── GET /assessments/latest ───────────────────────────────────────────────────

@router.get("/latest", response_model=AssessmentResult | None)
def get_latest_assessment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.user_id == current_user.id)
        .order_by(RiskAssessment.created_at.desc())
        .first()
    )
    if not assessment:
        return None

    portfolio = (
        db.query(Portfolio)
        .filter(Portfolio.assessment_id == assessment.id)
        .first()
    )

    return AssessmentResult(
        assessmentId=str(assessment.id),
        profileType=assessment.profile_type,
        investmentHorizon=assessment.horizon_type,
        compositeScore=assessment.composite_score,
        explanation=assessment.explanation or "",
        portfolioId=str(portfolio.id) if portfolio else "",
    )
