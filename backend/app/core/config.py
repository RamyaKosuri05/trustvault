"""
TrustVault — Application Configuration
Loads settings from environment variables with Pydantic Settings v2.
"""
from functools import lru_cache
import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "TrustVault"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "sqlite:///" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tests", "test_trustvault.db")) if os.getenv("ENVIRONMENT") == "testing" else "postgresql+psycopg2://trustvault:trustvault_dev_password@localhost:5432/trustvault"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return "postgresql+psycopg2://" + v[len("postgres://"):]
            if v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return "postgresql+psycopg2://" + v[len("postgresql://"):]
        return v

    # Security
    SECRET_KEY: str = "CHANGE_THIS_TO_A_RANDOM_64_CHAR_HEX_STRING"
    SESSION_EXPIRE_HOURS: int = 24
    SESSION_COOKIE_SECURE: bool = False  # True in production
    SESSION_COOKIE_SAMESITE: str = "lax"  # "lax" or "strict"
    SESSION_COOKIE_DOMAIN: Optional[str] = None

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors(cls, v: str) -> str:
        origins = [o.strip() for o in v.split(",") if o.strip()]
        if "*" in origins:
            raise ValueError(
                "Wildcard '*' in CORS_ORIGINS is strictly forbidden with credentialed cookies."
            )
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # File Storage
    STORAGE_BACKEND: str = "local"  # "local", "postgres", or "s3"
    LOCAL_STORAGE_PATH: str = "./storage"

    # S3 (optional)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_S3_REGION: str = "us-east-1"

    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = 10

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Rate limiting
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 5
    RATE_LIMIT_REGISTER_PER_MINUTE: int = 3

    # ClamAV (optional)
    CLAMAV_HOST: str = ""
    CLAMAV_PORT: int = 3310

    # Demo seed
    ALLOW_DEMO_SEED: bool = False

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

