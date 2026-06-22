"""File validation, storage, and virus scanning."""

import io
import logging
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

from app.config import get_settings
from app.utils.security import decrypt_bytes, encrypt_bytes, random_stored_filename, sanitize_filename

logger = logging.getLogger(__name__)

ALLOWED_MIMES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

# Magic bytes verification — never trust client MIME alone
MIME_SIGNATURES = {
    "application/pdf": [b"%PDF"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
}

_SIGNATURE_TO_MIME = {
    sig: mime
    for mime, sigs in MIME_SIGNATURES.items()
    for sig in sigs
}


def _detect_mime(content: bytes) -> str:
    """Detect MIME from magic bytes; use libmagic when available."""
    for sig, mime in _SIGNATURE_TO_MIME.items():
        if content.startswith(sig):
            return mime
    try:
        import magic

        return magic.from_buffer(content, mime=True)
    except (ImportError, OSError):
        raise FileValidationError("Unsupported file type")


class FileValidationError(Exception):
    pass


class VirusScanError(Exception):
    pass


def validate_file_content(content: bytes, declared_mime: str) -> str:
    """Verify actual file content matches allowed types."""
    if len(content) == 0:
        raise FileValidationError("Empty file")

    settings = get_settings()
    if len(content) > settings.max_upload_bytes:
        raise FileValidationError(f"File exceeds maximum size of {settings.max_upload_size_mb} MB")

    detected = _detect_mime(content)
    if detected not in ALLOWED_MIMES:
        raise FileValidationError(f"Unsupported file type: {detected}")

    if declared_mime not in ALLOWED_MIMES:
        raise FileValidationError(f"Unsupported declared type: {declared_mime}")

    # Verify magic bytes
    signatures = MIME_SIGNATURES.get(detected, [])
    if signatures and not any(content.startswith(sig) for sig in signatures):
        raise FileValidationError("File content does not match declared type")

    # Reject disguised executables (PE, ELF, Mach-O)
    dangerous = [b"MZ", b"\x7fELF", b"\xca\xfe\xba\xbe", b"\xfe\xed\xfa"]
    for sig in dangerous:
        if content.startswith(sig):
            raise FileValidationError("Executable files are not allowed")

    # Additional validation per type
    if detected == "application/pdf":
        try:
            reader = PdfReader(io.BytesIO(content))
            if len(reader.pages) == 0:
                raise FileValidationError("PDF has no pages")
        except FileValidationError:
            raise
        except Exception:
            raise FileValidationError("Invalid or corrupted PDF")
    elif detected in ("image/jpeg", "image/png"):
        try:
            img = Image.open(io.BytesIO(content))
            img.verify()
        except Exception:
            raise FileValidationError("Invalid or corrupted image")

    return detected


async def scan_for_viruses(content: bytes) -> None:
    """Scan uploaded file with ClamAV before processing."""
    settings = get_settings()
    if not settings.clamav_enabled:
        logger.warning("ClamAV disabled — skipping virus scan (dev only)")
        return

    try:
        import pyclamd

        cd = pyclamd.ClamdNetworkSocket(settings.clamav_host, settings.clamav_port)
        if not cd.ping():
            raise VirusScanError("Virus scanner unavailable")

        result = cd.scan_stream(content)
        if result is not None:
            status = list(result.values())[0]
            if status and status[0] == "FOUND":
                raise VirusScanError("File failed security scan")
    except VirusScanError:
        raise
    except Exception as e:
        logger.error("Virus scan error: %s", type(e).__name__)
        raise VirusScanError("Unable to complete security scan") from e


def get_page_count(content: bytes, mime_type: str) -> int | None:
    if mime_type == "application/pdf":
        try:
            return len(PdfReader(io.BytesIO(content)).pages)
        except Exception:
            return None
    return 1


class FileStorage:
    """Encrypted file storage outside public web root."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_path = Path(self.settings.storage_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def store(self, content: bytes, original_filename: str) -> tuple[str, str]:
        stored_name = random_stored_filename()
        ext = Path(sanitize_filename(original_filename)).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            ext = ".bin"
        stored_name_with_ext = f"{stored_name}{ext}"

        encrypted = encrypt_bytes(content, self.settings.encryption_key)
        file_path = self.base_path / stored_name_with_ext
        file_path.write_bytes(encrypted)
        return stored_name_with_ext, stored_name

    def retrieve(self, stored_filename: str) -> bytes:
        file_path = self.base_path / stored_filename
        if not file_path.exists():
            raise FileNotFoundError("File not found")
        # Security: prevent path traversal
        if not file_path.resolve().is_relative_to(self.base_path.resolve()):
            raise FileValidationError("Invalid file path")
        encrypted = file_path.read_bytes()
        return decrypt_bytes(encrypted, self.settings.encryption_key)

    def delete(self, stored_filename: str) -> None:
        file_path = self.base_path / stored_filename
        if file_path.exists() and file_path.resolve().is_relative_to(self.base_path.resolve()):
            file_path.unlink(missing_ok=True)
