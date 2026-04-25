from pydantic import BaseModel, Field


class QuestionnaireAnswer(BaseModel):
    questionId: int = Field(..., ge=1, le=15)
    selectedOption: int = Field(..., ge=0, le=3)


class AssessmentSubmitRequest(BaseModel):
    answers: list[QuestionnaireAnswer] = Field(..., min_length=15, max_length=15)


class AssessmentResult(BaseModel):
    assessmentId: str
    profileType: str
    investmentHorizon: str
    compositeScore: int
    explanation: str
    portfolioId: str


class AssessmentListItem(BaseModel):
    """Dropdown listesi için hafif assessment özeti."""
    assessmentId: str
    profileType: str
    investmentHorizon: str
    compositeScore: int
    portfolioId: str
    completedAt: str
