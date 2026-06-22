"""Report upload, retrieval, and deletion routes."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID
from sqlalchemy import select
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from app.config import get_settings
from app.limiter import limiter
from app.dependencies import CurrentUser, DbSession, verify_csrf_token
from app.models import GazePoint, Report
from app.schemas import AnalyticsResponse, GazeBatchRequest, HeatmapResponse, MessageResponse, ReportResponse, SectionStat
from app.services.cleanup_service import delete_report_data
from app.services.file_service import FileStorage, FileValidationError, VirusScanError, get_page_count, scan_for_viruses, validate_file_content
from app.services.heatmap_service import build_heatmap_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["reports"])


async def _get_user_report(db: DbSession, user: CurrentUser, report_id: UUID) -> Report:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.user_id == user.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.post("/upload", response_model=ReportResponse, dependencies=[Depends(verify_csrf_token)])
@limiter.limit(lambda: get_settings().rate_limit_uploads)
async def upload_report(
    request: Request,
    db: DbSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File(description="Medical report PDF or image")],
):
    settings = get_settings()

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    content = await file.read()
    declared_mime = file.content_type or "application/octet-stream"

    try:
        validated_mime = validate_file_content(content, declared_mime)
        await scan_for_viruses(content)
    except FileValidationError as e:
        logger.warning("Upload validation failed: user_id=%s reason=%s", user.id, type(e).__name__)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except VirusScanError:
        logger.warning("Virus scan failed: user_id=%s", user.id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File failed security scan")

    storage = FileStorage()
    stored_filename, _ = storage.store(content, file.filename)
    page_count = get_page_count(content, validated_mime)

    report = Report(
        user_id=user.id,
        original_filename=file.filename[:255],
        stored_filename=stored_filename,
        mime_type=validated_mime,
        file_size=len(content),
        page_count=page_count,
        status="ready",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.auto_delete_hours),
    )
    db.add(report)
    await db.flush()

    logger.info("Upload success: user_id=%s report_id=%s size=%d", user.id, report.id, len(content))
    return ReportResponse.model_validate(report)


@router.get("", response_model=list[ReportResponse])
async def list_reports(db: DbSession, user: CurrentUser):
    result = await db.execute(
        select(Report).where(Report.user_id == user.id).order_by(Report.created_at.desc())
    )
    return [ReportResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: UUID, db: DbSession, user: CurrentUser):
    report = await _get_user_report(db, user, report_id)
    return ReportResponse.model_validate(report)


@router.get("/{report_id}/content")
async def get_report_content(report_id: UUID, db: DbSession, user: CurrentUser):
    """Serve decrypted report content — no public URLs, auth required."""
    report = await _get_user_report(db, user, report_id)
    storage = FileStorage()
    try:
        content = storage.retrieve(report.stored_filename)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return Response(
        content=content,
        media_type=report.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{report.original_filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/{report_id}", response_model=MessageResponse, dependencies=[Depends(verify_csrf_token)])
async def delete_report(report_id: UUID, db: DbSession, user: CurrentUser):
    report = await _get_user_report(db, user, report_id)
    await delete_report_data(db, report)
    return MessageResponse(message="Report and all associated data deleted")


@router.post("/{report_id}/gaze", response_model=MessageResponse, dependencies=[Depends(verify_csrf_token)])
async def record_gaze(
    report_id: UUID,
    body: GazeBatchRequest,
    db: DbSession,
    user: CurrentUser,
):
    """Store anonymized gaze coordinates only — never video."""
    report = await _get_user_report(db, user, report_id)

    for point in body.points:
        db.add(
            GazePoint(
                report_id=report.id,
                page_number=point.page_number,
                x=point.x,
                y=point.y,
                duration_ms=point.duration_ms,
            )
        )
    await db.flush()
    return MessageResponse(message=f"Recorded {len(body.points)} gaze points")


@router.get("/{report_id}/heatmap/{page_number}", response_model=HeatmapResponse)
async def get_heatmap(report_id: UUID, page_number: int, db: DbSession, user: CurrentUser):
    report = await _get_user_report(db, user, report_id)

    result = await db.execute(
        select(GazePoint).where(
            GazePoint.report_id == report.id,
            GazePoint.page_number == page_number,
        )
    )
    points = result.scalars().all()
    gaze_data = [(p.x, p.y, p.duration_ms, p.recorded_at) for p in points]

    # Also fetch explanations for this page so we can mark them as red dots
    from app.models import Explanation
    ex_result = await db.execute(
        select(Explanation).where(
            Explanation.report_id == report.id,
            Explanation.page_number == page_number,
        )
    )
    explanations = []
    for ex in ex_result.scalars().all():
        explanations.append({
            "region_text": ex.region_text,
            "region_bounds": ex.region_bounds,
        })

    return build_heatmap_response(page_number, gaze_data, explanations)
@router.get("/{report_id}/analytics", response_model=AnalyticsResponse)
async def get_analytics(report_id: UUID, db: DbSession, user: CurrentUser):
    """Aggregate analytics: top viewed sections + top explained terms."""
    from app.models import Explanation
    from collections import Counter

    report = await _get_user_report(db, user, report_id)

    # --- Total views = total gaze points ---
    gaze_result = await db.execute(
        select(GazePoint).where(GazePoint.report_id == report.id)
    )
    all_gaze = gaze_result.scalars().all()
    total_views = len(all_gaze)

    # --- Total explanations ---
    ex_result = await db.execute(
        select(Explanation).where(Explanation.report_id == report.id)
    )
    all_explanations = ex_result.scalars().all()
    total_explanations = len(all_explanations)

    # --- Top explained terms ---
    # Group by region_text (the text the user asked to explain)
    ex_text_counts = Counter()
    for ex in all_explanations:
        # Use first 60 chars as the label to group similar selections
        label = ex.region_text.strip()[:60]
        ex_text_counts[label] += 1

    top_explained = [
        SectionStat(
            label=text,
            visit_count=0,  # we don't cross-reference with gaze here
            explanation_count=count,
            page_number=0,
        )
        for text, count in ex_text_counts.most_common(10)
    ]

    # --- Top viewed sections ---
    # Cluster gaze points by page + spatial region, label by position
    from app.services.heatmap_service import _cluster_visits, _cluster_hotspots
    from collections import defaultdict

    page_gaze = defaultdict(list)
    for p in all_gaze:
        page_gaze[p.page_number].append((p.x, p.y, p.duration_ms, p.recorded_at))

    section_stats = []
    for page_num, gaze_list in page_gaze.items():
        visits = _cluster_visits(gaze_list)
        hotspots = _cluster_hotspots(visits)

        for h in hotspots:
            # Label by position on page
            y_pct = h["y"]
            if y_pct < 0.33:
                pos = "Top"
            elif y_pct < 0.66:
                pos = "Middle"
            else:
                pos = "Bottom"

            x_pct = h["x"]
            if x_pct < 0.33:
                horiz = "left"
            elif x_pct < 0.66:
                horiz = "center"
            else:
                horiz = "right"

            label = f"Page {page_num} — {pos} {horiz}"

            # Check if any explanation was requested near this hotspot
            ex_count = 0
            for ex in all_explanations:
                if ex.page_number == page_num and ex.region_bounds:
                    ex_x = ex.region_bounds["x"] + ex.region_bounds["width"] / 2
                    ex_y = ex.region_bounds["y"] + ex.region_bounds["height"] / 2
                    dist = ((ex_x - h["x"]) ** 2 + (ex_y - h["y"]) ** 2) ** 0.5
                    if dist < 0.1:
                        ex_count += 1

            section_stats.append(SectionStat(
                label=label,
                visit_count=h["visits"],
                explanation_count=ex_count,
                page_number=page_num,
            ))

    # Sort by visit count, take top 10
    section_stats.sort(key=lambda s: s.visit_count, reverse=True)
    top_viewed = section_stats[:10]

    return AnalyticsResponse(
        total_views=total_views,
        total_explanations=total_explanations,
        top_viewed_sections=top_viewed,
        top_explained_terms=top_explained,
    )
