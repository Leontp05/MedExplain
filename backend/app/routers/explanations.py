"""AI explanation routes — backend proxy for all AI requests."""

import logging
from uuid import UUID
from sqlalchemy import select

from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.config import get_settings
from app.limiter import limiter
from app.dependencies import CurrentUser, DbSession, verify_csrf_token
from app.models import Explanation, Report
from app.schemas import ExplainRequest, ExplainResponse, MessageResponse
from app.services.ai_service import AIServiceError, PromptInjectionError, generate_explanation
from app.services.cleanup_service import delete_report_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/explanations", tags=["explanations"])

DISCLAIMER = "This explanation is educational only and not medical advice."


async def _get_user_report(db: DbSession, user: CurrentUser, report_id: UUID) -> Report:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.user_id == user.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.post("/{report_id}/explain", response_model=ExplainResponse, dependencies=[Depends(verify_csrf_token)])
@limiter.limit(lambda: get_settings().rate_limit_ai)
async def explain_region(
    request: Request,
    report_id: UUID,
    body: ExplainRequest,
    db: DbSession,
    user: CurrentUser,
):
    report = await _get_user_report(db, user, report_id)

    try:
        explanation_text = await generate_explanation(body.region_text, body.reading_level)
    except PromptInjectionError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to process this text safely",
        )
    except AIServiceError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to generate explanation at this time",
        )

    explanation = Explanation(
        report_id=report.id,
        region_text=body.region_text[:10000],
        reading_level=body.reading_level,
        explanation_text=explanation_text,
        region_bounds=body.region_bounds.model_dump() if body.region_bounds else None,
        page_number=body.page_number,
    )
    db.add(explanation)
    await db.flush()

    logger.info("Explanation generated: report_id=%s level=%s", report.id, body.reading_level)

    return ExplainResponse(
        id=explanation.id,
        explanation_text=explanation_text,
        reading_level=body.reading_level,
        disclaimer=DISCLAIMER,
    )


@router.get("/{report_id}", response_model=list[ExplainResponse])
async def list_explanations(report_id: UUID, db: DbSession, user: CurrentUser):
    await _get_user_report(db, user, report_id)

    result = await db.execute(
        select(Explanation).where(Explanation.report_id == report_id).order_by(Explanation.created_at.desc())
    )
    return [
        ExplainResponse(
            id=e.id,
            explanation_text=e.explanation_text,
            reading_level=e.reading_level,
            disclaimer=DISCLAIMER,
        )
        for e in result.scalars().all()
    ]


@router.delete("/user/data", response_model=MessageResponse, dependencies=[Depends(verify_csrf_token)])
async def clear_all_user_data(db: DbSession, user: CurrentUser):
    """Delete all reports and generated data for the current user."""
    result = await db.execute(select(Report).where(Report.user_id == user.id))
    reports = result.scalars().all()
    for report in reports:
        await delete_report_data(db, report)

    logger.info("All user data cleared: user_id=%s reports=%d", user.id, len(reports))
    return MessageResponse(message=f"Deleted {len(reports)} reports and all associated data")
