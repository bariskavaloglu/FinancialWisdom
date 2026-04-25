from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql://fw_user:fw_password@localhost:5432/financial_wisdom"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "e978ba56ecdfa02327ff04a8aa1f5dd308cedb2a2b666e5155d2b57612958e3f"
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
    SMTP_USER: str = "financial.wisdom.auth@gmail.com"           # Gmail adresi
    SMTP_PASSWORD: str = "hmwb jiym uzwx mdpl"       # Gmail uygulama şifresi (App Password)
    EMAILS_ENABLED: bool = True  # True yapınca gerçek mail gönderir

    # Market data cache TTL
    YFINANCE_CACHE_TTL_MINUTES: int = 15   # kullanıcı isteği TTL'i

    # Startup cache warmup
    # False yaparak devre dışı bırakabilirsin (test ortamı, CI/CD vb.)
    CACHE_WARMUP_ON_STARTUP: bool = True

    # Portfolio engine config
    MAX_INSTRUMENTS_PER_CLASS: int = 5   # her asset class'tan seçilecek max araç sayısı
    MIN_DATA_COMPLETENESS: float = 0.90  # veri eksiksizliği eşiği (biraz gevşetildi)


settings = Settings()