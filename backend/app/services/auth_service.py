"""Authentication service with session management."""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import User, UserSession
from app.utils.security import generate_token, hash_password, hash_token, verify_password

logger = logging.getLogger(__name__)

LOCKOUT_THRESHOLD = 5
LOCKOUT_MINUTES = 15


class AuthError(Exception):
    pass


class AccountLockedError(AuthError):
    pass


async def register_user(db: AsyncSession, email: str, password: str) -> User:
    existing = await db.execute(select(User).where(User.email == email.lower()))
    if existing.scalar_one_or_none():
        raise AuthError("Email already registered")

    user = User(email=email.lower(), password_hash=hash_password(password))
    db.add(user)
    await db.flush()
    logger.info("User registered: user_id=%s", user.id)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()

    if user is None:
        # Security: constant-time-ish delay via failed path
        hash_password("dummy-password-for-timing")
        raise AuthError("Invalid credentials")

    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        raise AccountLockedError("Account temporarily locked. Try again later.")

    if not verify_password(user.password_hash, password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= LOCKOUT_THRESHOLD:
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            logger.warning("Account locked: user_id=%s", user.id)
        raise AuthError("Invalid credentials")

    user.failed_login_attempts = 0
    user.locked_until = None
    logger.info("Login success: user_id=%s", user.id)
    return user


async def create_session(db: AsyncSession, user: User) -> tuple[str, str, UserSession]:
    settings = get_settings()
    session_token = generate_token()
    csrf_token = generate_token()

    session = UserSession(
        user_id=user.id,
        session_token_hash=hash_token(session_token),
        csrf_token_hash=hash_token(csrf_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.session_expire_minutes),
    )
    db.add(session)
    await db.flush()
    return session_token, csrf_token, session


async def get_user_by_session(db: AsyncSession, session_token: str) -> User | None:
    token_hash = hash_token(session_token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(UserSession, User)
        .join(User, UserSession.user_id == User.id)
        .where(UserSession.session_token_hash == token_hash)
        .where(UserSession.expires_at > now)
        .where(User.is_active == True)  # noqa: E712
    )
    row = result.first()
    if not row:
        return None
    return row[1]


async def invalidate_session(db: AsyncSession, session_token: str) -> None:
    token_hash = hash_token(session_token)
    result = await db.execute(select(UserSession).where(UserSession.session_token_hash == token_hash))
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        logger.info("Session invalidated: user_id=%s", session.user_id)


async def verify_csrf(db: AsyncSession, session_token: str, csrf_token: str) -> bool:
    token_hash = hash_token(session_token)
    csrf_hash = hash_token(csrf_token)
    result = await db.execute(
        select(UserSession).where(
            UserSession.session_token_hash == token_hash,
            UserSession.csrf_token_hash == csrf_hash,
        )
    )
    return result.scalar_one_or_none() is not None


async def refresh_csrf_token(db: AsyncSession, session_token: str) -> str | None:
    """Generate a new CSRF token for an existing valid session.

    Persists the new token's hash in the DB and returns the raw token so the
    caller can hand it back to the client via a Set-Cookie header. Returns
    None if the session does not exist or has expired.
    """
    token_hash = hash_token(session_token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(UserSession).where(
            UserSession.session_token_hash == token_hash,
            UserSession.expires_at > now,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return None

    new_csrf_token = generate_token()
    session.csrf_token_hash = hash_token(new_csrf_token)
    await db.flush()
    logger.info("CSRF token refreshed: user_id=%s", session.user_id)
    return new_csrf_token

