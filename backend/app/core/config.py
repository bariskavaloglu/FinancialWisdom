from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql://fw_user:fw_password@localhost:5432/financial_wisdom"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_supersecretkey"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App
    ENVIRONMENT: str = "development"
    APP_NAME: str = "Financial Wisdom API"
    API_V1_PREFIX: str = "/api/v1"

    # Frontend base URL (used in verification emails)
    FRONTEND_URL: str = "http://localhost:5173"

    # SMTP — email verification
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""          # Gmail adresi
    SMTP_PASSWORD: str = ""      # Gmail uygulama şifresi (App Password)
    EMAILS_ENABLED: bool = False  # True yapınca gerçek mail gönderir

    # yfinance cache TTL (minutes) — matches RAD NFR
    YFINANCE_CACHE_TTL_MINUTES: int = 15

    # Portfolio engine config
    MAX_INSTRUMENTS_PER_CLASS: int = 3
    MIN_DATA_COMPLETENESS: float = 0.95


settings = Settings()
