"""
Assessments router — RAD UC-03 (Complete Risk Assessment) and UC-08 (Update Risk Profile)

POST /assessments          → submit answers, classify profile, trigger portfolio generation
GET  /assessments/latest   → fetch most recent assessment result

Changes:
- expected_return wired through from engine
- All error messages in English
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.assessment import RiskAssessment
from app.models.portfolio import AssetAllocation, Portfolio
from app.models.user import User
from app.schemas.assessment import AssessmentListItem, AssessmentResult, AssessmentSubmitRequest, SimulateRequest
from app.services.assessment_service import (
    classify_horizon,
    classify_profile,
    compute_composite_score,
)
from app.services.portfolio_engine import build_portfolio
from app.models.admin_override import AdminOverride

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assessments", tags=["assessments"])


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
    composite_score = compute_composite_score(body.answers)
    profile_type = classify_profile(composite_score)
    horizon_type = classify_horizon(body.answers)

    logger.info(
        "Assessment submitted: user=%s score=%d profile=%s horizon=%s",
        current_user.id, composite_score, profile_type, horizon_type,
    )

    assessment = RiskAssessment(
        user_id=current_user.id,
        answers=[a.model_dump() for a in body.answers],
        composite_score=composite_score,
        profile_type=profile_type,
        horizon_type=horizon_type,
    )
    db.add(assessment)
    db.flush()

    # UC-08: mark all previous portfolios as not current
    db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id,
        Portfolio.is_current == True,
    ).update({"is_current": False})

    # Cevapları Algorithm D'ye ilet — dinamik ağırlıklandırma için
    raw_answers = [a.model_dump() for a in body.answers]

    # Admin override'larını yükle ve guardrail olarak ilet
    active_overrides = (
        db.query(AdminOverride)
        .filter(
            AdminOverride.user_id == current_user.id,
            AdminOverride.is_active == True,
        )
        .all()
    )
    admin_guardrails = [
        {
            "dim": ov.asset_class,
            "action": "min",
            "val": ov.min_weight,
            "reason": f"Admin override: {ov.reason}",
        }
        for ov in active_overrides if ov.min_weight is not None
    ] + [
        {
            "dim": ov.asset_class,
            "action": "max",
            "val": ov.max_weight,
            "reason": f"Admin override: {ov.reason}",
        }
        for ov in active_overrides if ov.max_weight is not None
    ]

    if admin_guardrails:
        logger.info(
            "Admin guardrails applied for user=%s: %d rules",
            current_user.id, len(admin_guardrails)
        )

    try:
        engine_result = build_portfolio(
            profile_type, horizon_type,
            answers=raw_answers,
            admin_guardrails=admin_guardrails or None,
        )
    except Exception as exc:
        logger.error("Portfolio engine error: %s", exc, exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Portfolio generation failed. Please try again.",
        )

    assessment.explanation = engine_result["explanation"]

    portfolio = Portfolio(
        user_id=current_user.id,
        assessment_id=assessment.id,
        profile_type=profile_type,
        horizon_type=horizon_type,
        is_current=True,
        portfolio_score=engine_result["portfolio_score"],
        expected_volatility=engine_result["expected_volatility"],
        expected_return=engine_result.get("expected_return", 0.0),
        explanation=engine_result["explanation"],
    )
    db.add(portfolio)
    db.flush()

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


@router.get("/history", response_model=list[AssessmentListItem])
def list_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kullanıcının tüm assessment geçmişini döner (en yeni önce).
    Dashboard dropdown için kullanılır.
    """
    assessments = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.user_id == current_user.id)
        .order_by(RiskAssessment.created_at.desc())
        .all()
    )

    result = []
    for a in assessments:
        portfolio = (
            db.query(Portfolio)
            .filter(Portfolio.assessment_id == a.id)
            .first()
        )
        result.append(AssessmentListItem(
            assessmentId=str(a.id),
            profileType=a.profile_type,
            investmentHorizon=a.horizon_type,
            compositeScore=a.composite_score,
            portfolioId=str(portfolio.id) if portfolio else "",
            completedAt=a.created_at.isoformat(),
        ))
    return result


# ── Simülasyon endpoint'i ─────────────────────────────────────────────────────

@router.post("/simulate", status_code=status.HTTP_200_OK)
def simulate_portfolio(
    body: SimulateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Gerçek simülasyon: verilen anket cevaplarını + as_of_date'i alır,
    o tarih itibarıyla factor scoring yaparak portföy oluşturur.
    Portföy DB'ye kaydedilmez — sadece sonuç döner.

    as_of_date: "YYYY-MM-DD" — bu tarihten sonraki piyasa verisi görünmez.
    Kullanıcı "Ocak 2024'te bu anketi doldurmış olsaydım" simülasyonu yapabilir.
    """
    composite_score = compute_composite_score(body.answers)
    profile_type    = classify_profile(composite_score)
    horizon_type    = classify_horizon(body.answers)

    logger.info(
        "Simulate portfolio: user=%s as_of=%s profile=%s horizon=%s",
        current_user.id, body.as_of_date, profile_type, horizon_type,
    )

    raw_answers = [a.model_dump() for a in body.answers]

    try:
        engine_result = build_portfolio(
            profile_type,
            horizon_type,
            answers=raw_answers,
            as_of_date=body.as_of_date,
        )
    except Exception as exc:
        logger.error("Simulate portfolio engine error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Simulation failed. Please try again.",
        )

    # Portfolio schema formatında döndür ama portfolioId olmadan
    return {
        "simulated":          True,
        "asOfDate":           body.as_of_date,
        "profileType":        profile_type,
        "horizonType":        horizon_type,
        "portfolioScore":     engine_result["portfolio_score"],
        "expectedReturn":     engine_result["expected_return"],
        "expectedVolatility": engine_result["expected_volatility"],
        "explanation":        engine_result["explanation"],
        "allocations": [
            {
                "assetClass":   a["asset_class"],
                "targetWeight": a["target_weight"],
                "instruments":  a["instruments"],
            }
            for a in engine_result["allocations"]
            if a["target_weight"] > 0
        ],
    }


@router.get("/{assessment_id}/answers")
def get_assessment_answers(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assessment cevaplarını döner — simülasyon için kullanılır.
    Sadece kendi assessment'larına erişilebilir.
    """
    import uuid as _uuid
    try:
        aid = _uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid assessment ID")

    assessment = (
        db.query(RiskAssessment)
        .filter(
            RiskAssessment.id == aid,
            RiskAssessment.user_id == current_user.id,
        )
        .first()
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return {"assessmentId": str(assessment.id), "answers": assessment.answers}
