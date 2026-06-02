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


class SimulateRequest(BaseModel):
    """
    Simülasyon isteği: anket cevapları + simülasyon başlangıç tarihi.
    as_of_date: "YYYY-MM-DD" — factor scoring bu tarih itibarıyla yapılır.
    """
    answers:    list[QuestionnaireAnswer] = Field(..., min_length=15, max_length=15)
    as_of_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
