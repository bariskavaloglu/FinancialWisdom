"""
Portfolios router — RAD UC-04, UC-05, UC-06

GET  /portfolios/current          → latest current portfolio (dashboard)
GET  /portfolios/:id              → specific portfolio by ID
GET  /portfolios                  → list all user portfolios
GET  /portfolios/compare?a=&b=    → side-by-side comparison (UC-06)
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.portfolio import AssetAllocation, Portfolio
from app.models.user import User
from app.schemas.portfolio import (
    AssetAllocation as AssetAllocationSchema,
    Instrument,
    FactorScore,
    Portfolio as PortfolioSchema,
    PortfolioComparison,
    PortfolioDiff,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolios", tags=["portfolios"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _orm_to_schema(portfolio: Portfolio) -> PortfolioSchema:
    allocations = []
    for alloc in portfolio.allocations:
        instruments = []
        for inst_data in (alloc.instruments or []):
            fs_data = inst_data.get("factorScore")
            factor_score = FactorScore(**fs_data) if fs_data else None
            instruments.append(Instrument(
                instrumentId=inst_data.get("instrumentId", ""),
                ticker=inst_data["ticker"],
                name=inst_data.get("name", inst_data["ticker"]),
                assetClass=inst_data.get("assetClass", alloc.asset_class),
                exchange=inst_data.get("exchange", ""),
                currency=inst_data.get("currency", "USD"),
                currentPrice=inst_data.get("currentPrice", 0),
                isActive=inst_data.get("isActive", True),
                factorScore=factor_score,
                whySelected=inst_data.get("whySelected", []),
            ))
        allocations.append(AssetAllocationSchema(
            allocationId=str(alloc.id),
            portfolioId=str(alloc.portfolio_id),
            assetClass=alloc.asset_class,
            targetWeight=alloc.target_weight,
            instruments=instruments,
        ))

    return PortfolioSchema(
        portfolioId=str(portfolio.id),
        userId=str(portfolio.user_id),
        assessmentId=str(portfolio.assessment_id),
        generatedAt=portfolio.generated_at.isoformat(),
        isCurrent=portfolio.is_current,
        profileType=portfolio.profile_type,
        horizonType=portfolio.horizon_type,
        allocations=allocations,
        portfolioScore=portfolio.portfolio_score,
        expectedVolatility=portfolio.expected_volatility,
        expectedReturn=getattr(portfolio, 'expected_return', 0.0),
        explanation=portfolio.explanation,
    )


def _get_weight(portfolio: Portfolio, asset_class: str) -> float:
    for alloc in portfolio.allocations:
        if alloc.asset_class == asset_class:
            return alloc.target_weight
    return 0.0


# ── UC-05: Dashboard — current portfolio ────────────────────────────────────

@router.get("/current", response_model=PortfolioSchema)
def get_current_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the user's active portfolio for the dashboard.
    RAD UC-05 main flow step 2.
    """
    portfolio = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id, Portfolio.is_current == True)
        .order_by(Portfolio.generated_at.desc())
        .first()
    )
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No portfolio found. Please complete the risk questionnaire.",
        )
    return _orm_to_schema(portfolio)


# ── List all portfolios ────────────────────────────────────────────────────────

@router.get("", response_model=list[PortfolioSchema])
def list_portfolios(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portfolios = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == current_user.id)
        .order_by(Portfolio.generated_at.desc())
        .all()
    )
    return [_orm_to_schema(p) for p in portfolios]


# ── UC-06: Scenario comparison ────────────────────────────────────────────────

@router.get("/compare", response_model=PortfolioComparison)
def compare_portfolios(
    a: str = Query(..., description="Portfolio ID A"),
    b: str = Query(..., description="Portfolio ID B"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Side-by-side comparison of two portfolios.
    RAD UC-06 main flow step 3-4.
    """
    port_a = db.query(Portfolio).filter(
        Portfolio.id == a, Portfolio.user_id == current_user.id
    ).first()
    port_b = db.query(Portfolio).filter(
        Portfolio.id == b, Portfolio.user_id == current_user.id
    ).first()

    if not port_a or not port_b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")

    schema_a = _orm_to_schema(port_a)
    schema_b = _orm_to_schema(port_b)

    equity_a = _get_weight(port_a, "BIST_EQUITY") + _get_weight(port_a, "SP500_EQUITY")
    equity_b = _get_weight(port_b, "BIST_EQUITY") + _get_weight(port_b, "SP500_EQUITY")

    diff = PortfolioDiff(
        expectedReturn=round((port_b.portfolio_score - port_a.portfolio_score) * 0.12, 2),
        expectedVolatility=round(port_b.expected_volatility - port_a.expected_volatility, 2),
        equityExposure=round(equity_b - equity_a, 2),
        cryptoExposure=round(
            _get_weight(port_b, "CRYPTOCURRENCY") - _get_weight(port_a, "CRYPTOCURRENCY"), 2
        ),
        cashExposure=round(
            _get_weight(port_b, "CASH_EQUIVALENT") - _get_weight(port_a, "CASH_EQUIVALENT"), 2
        ),
        sharpeRatio=round((port_b.portfolio_score - port_a.portfolio_score) * 0.03, 2),
    )

    return PortfolioComparison(scenarioA=schema_a, scenarioB=schema_b, diff=diff)


# ── GET /portfolios/:id ────────────────────────────────────────────────────────

@router.get("/{portfolio_id}", response_model=PortfolioSchema)
def get_portfolio_by_id(
    portfolio_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portfolio = db.query(Portfolio).filter(
        Portfolio.id == portfolio_id,
        Portfolio.user_id == current_user.id,
    ).first()
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return _orm_to_schema(portfolio)
