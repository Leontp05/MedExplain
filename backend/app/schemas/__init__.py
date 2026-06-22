"""Pydantic request/response schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class UserResponse(BaseModel):
    id: UUID
    email: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserResponse
    csrf_token: str


class CsrfResponse(BaseModel):
    csrf_token: str


class ReportResponse(BaseModel):
    id: UUID
    original_filename: str
    mime_type: str
    file_size: int
    page_count: int | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GazePointCreate(BaseModel):
    page_number: int = Field(ge=1)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    duration_ms: int = Field(ge=0, le=60000)


class GazeBatchRequest(BaseModel):
    points: list[GazePointCreate] = Field(max_length=500)


class RegionBounds(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(ge=0, le=1)
    height: float = Field(ge=0, le=1)


class ExplainRequest(BaseModel):
    region_text: str = Field(min_length=1, max_length=10000)
    reading_level: Literal["basic", "intermediate", "medical"] = "basic"
    page_number: int = Field(ge=1, default=1)
    region_bounds: RegionBounds | None = None


class ExplainResponse(BaseModel):
    id: UUID
    explanation_text: str
    reading_level: str
    disclaimer: str = "This explanation is educational only and not medical advice."


class HeatmapPoint(BaseModel):
    x: float
    y: float
    intensity: float
    visits: int = 1
    duration_ms: int = 0


class ExplanationMarker(BaseModel):
    x: float
    y: float
    region_text: str


class HeatmapResponse(BaseModel):
    page_number: int
    points: list[HeatmapPoint]
    explanation_points: list[ExplanationMarker] = []


class SectionStat(BaseModel):
    label: str
    visit_count: int
    explanation_count: int
    page_number: int


class AnalyticsResponse(BaseModel):
    total_views: int
    total_explanations: int
    top_viewed_sections: list[SectionStat]
    top_explained_terms: list[SectionStat]


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str
