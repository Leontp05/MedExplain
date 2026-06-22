"""File validation tests."""

import io

import pytest

from app.services.file_service import FileValidationError, validate_file_content


def test_reject_empty_file():
    with pytest.raises(FileValidationError, match="Empty"):
        validate_file_content(b"", "application/pdf")


def test_reject_oversized_file(monkeypatch):
    monkeypatch.setenv("MAX_UPLOAD_SIZE_MB", "1")
    from app.config import get_settings

    get_settings.cache_clear()

    large = b"%PDF-1.4 " + b"x" * (2 * 1024 * 1024)
    with pytest.raises(FileValidationError, match="maximum size"):
        validate_file_content(large, "application/pdf")

    get_settings.cache_clear()


def test_reject_executable():
    with pytest.raises(FileValidationError):
        validate_file_content(b"MZ" + b"\x00" * 100, "application/pdf")


def test_accept_minimal_pdf():
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buffer = io.BytesIO()
    writer.write(buffer)
    pdf = buffer.getvalue()

    mime = validate_file_content(pdf, "application/pdf")
    assert mime == "application/pdf"
