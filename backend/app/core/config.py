from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "Warehouse ERP"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+asyncpg://erp:erp@localhost:5432/erp"

    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    JWT_ALGORITHM: str = "HS256"

    # Comma-separated string (kept as str so pydantic-settings doesn't JSON-decode it).
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_MANAGER_CHAT_ID: str | None = None

    # Directory (relative to the backend working dir) for uploaded photos.
    UPLOAD_DIR: str = "uploads"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
