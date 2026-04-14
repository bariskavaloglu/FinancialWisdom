from pydantic import BaseModel, EmailStr, Field
from pydantic.alias_generators import to_camel


# ── Request schemas ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    model_config = {"populate_by_name": True, "alias_generator": to_camel}
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


# ── Response schemas ───────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str


class RegisterResponse(BaseModel):
    """Kayıt başarılı ama mail doğrulama bekleniyor."""
    message: str
    email: str


class UserResponse(BaseModel):
    userId: str
    email: str
    fullName: str
    role: str
    createdAt: str
    isEmailVerified: bool = False

    model_config = {"from_attributes": True}
