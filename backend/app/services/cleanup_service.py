"""Background cleanup for expired reports and files."""

import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Explanation, GazePoint, Report
from app.services.file_service import FileStorage

logger = logging.getLogger(__name__)


async def cleanup_expired_reports(db: AsyncSession) -> int:
    """Delete expired reports, encrypted files, and associated data."""
    now = datetime.now(timezone.utc)
    result = await db.execute(select(Report).where(Report.expires_at <= now))
    reports = result.scalars().all()

    storage = FileStorage()
    count = 0
    for report in reports:
        try:
            storage.delete(report.stored_filename)
        except Exception:
            logger.warning("Failed to delete file for report %s", report.id)

        await db.execute(delete(GazePoint).where(GazePoint.report_id == report.id))
        await db.execute(delete(Explanation).where(Explanation.report_id == report.id))
        await db.delete(report)
        count += 1

    if count:
        logger.info("Cleaned up %d expired reports", count)
    return count


async def delete_report_data(db: AsyncSession, report: Report) -> None:
    """User-initiated full deletion of report and all generated data."""
    storage = FileStorage()
    storage.delete(report.stored_filename)
    await db.execute(delete(GazePoint).where(GazePoint.report_id == report.id))
    await db.execute(delete(Explanation).where(Explanation.report_id == report.id))
    await db.delete(report)
    logger.info("Report deleted by user: report_id=%s", report.id)
