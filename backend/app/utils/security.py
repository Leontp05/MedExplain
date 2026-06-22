"""Security utilities: hashing, tokens, encryption, sanitization."""

import hashlib
import re
import secrets
import uuid
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken

# Argon2 with secure defaults — never store plaintext passwords
_ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)

# Prompt injection patterns in uploaded document text
_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"disregard\s+(all\s+)?prior",
    r"you\s+are\s+now",
    r"system\s*:\s*",
    r"<\s*/?\s*script",
    r"jailbreak",
    r"bypass\s+safety",
]


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def needs_rehash(password_hash: str) -> bool:
    return _ph.check_needs_rehash(password_hash)


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def sanitize_filename(filename: str) -> str:
    """Remove path traversal and dangerous characters from filenames."""
    name = Path(filename).name
    name = re.sub(r"[^\w.\- ]", "_", name)
    return name[:200] if name else "upload"


def sanitize_text(text: str, max_length: int = 10000) -> str:
    """Strip control chars and limit length to prevent injection."""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text[:max_length].strip()


def detect_prompt_injection(text: str) -> bool:
    """Detect potential prompt injection in document text."""
    lower = text.lower()
    for pattern in _INJECTION_PATTERNS:
        if re.search(pattern, lower, re.IGNORECASE):
            return True
    return False


def get_fernet(key: str) -> Fernet:
    """Fernet requires 32 url-safe base64-encoded bytes."""
    import base64

    try:
        return Fernet(key.encode() if len(key) == 44 else base64.urlsafe_b64encode(key.encode()[:32].ljust(32)))
    except Exception:
        return Fernet(Fernet.generate_key())


def encrypt_bytes(data: bytes, key: str) -> bytes:
    return get_fernet(key).encrypt(data)


def decrypt_bytes(data: bytes, key: str) -> bytes:
    try:
        return get_fernet(key).decrypt(data)
    except InvalidToken:
        raise ValueError("Decryption failed")


def random_stored_filename() -> str:
    return uuid.uuid4().hex
