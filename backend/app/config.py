"""Application configuration from environment variables only."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "production", "test"] = "development"
    app_name: str = "MedExplain AI"
    secret_key: str = Field(min_length=32)
    debug: bool = False

    database_url: str

    session_expire_minutes: int = 60
    csrf_secret: str = Field(min_length=32)

    storage_path: str = "/app/storage"
    encryption_key: str
    max_upload_size_mb: int = 10
    auto_delete_hours: int = 24

    clamav_enabled: bool = True
    clamav_host: str = "localhost"
    clamav_port: int = 3310

    ai_provider: Literal["openai", "gemini", "anthropic", "groq"] = "openai"
    openai_api_key: str = ""
    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""

    rate_limit_uploads: str = "10/hour"
    rate_limit_ai: str = "30/hour"
    rate_limit_login: str = "5/minute"

    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @field_validator("debug")
    @classmethod
    def no_debug_in_production(cls, v: bool, info) -> bool:
        if info.data.get("app_env") == "production" and v:
            return False
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
