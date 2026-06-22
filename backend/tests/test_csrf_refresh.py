"""Tests for the refactored CSRF flow:

* login/register set a readable CSRF cookie (double-submit pattern)
* POST /auth/csrf/refresh mints a new token for an existing session
* the new token is usable for subsequent state-changing requests
* the double-submit verification logic (header == cookie == DB hash) works
"""

import os

# Set test env before any app imports
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-minimum-32-characters-long")
os.environ.setdefault("CSRF_SECRET", "test-csrf-secret-key-minimum-32-chars")
os.environ.setdefault("ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("CLAMAV_ENABLED", "false")

from typing import Annotated

import pytest
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import Base, engine, get_db
from app.dependencies import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, verify_csrf_token
from app.main import app
from app.services.auth_service import create_session, hash_token
from app.models import User, UserSession
from app.utils.security import hash_password

import sqlalchemy as sa

get_settings.cache_clear()


@pytest.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    get_settings.cache_clear()


async def _register_and_login(client: AsyncClient) -> tuple[str, str]:
    """Register a user, log them in, return (csrf_token_from_body, csrf_cookie_value)."""
    await client.post(
        "/api/auth/register",
        json={"email": "csrf-test@example.com", "password": "password123"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "csrf-test@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    body_csrf = resp.json()["csrf_token"]
    cookie_csrf = client.cookies.get("medexplain_csrf")
    assert cookie_csrf is not None, "login must set the readable CSRF cookie"
    return body_csrf, cookie_csrf


# ---------------------------------------------------------------------------
# Integration: login cookie behavior
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_login_sets_readable_csrf_cookie(client):
    """Login must set BOTH the HttpOnly session cookie and the readable CSRF cookie."""
    body_csrf, cookie_csrf = await _register_and_login(client)
    # The cookie value must equal the token returned in the JSON body.
    assert body_csrf == cookie_csrf
    # Session cookie must also be present.
    assert client.cookies.get("medexplain_session") is not None


@pytest.mark.asyncio
async def test_logout_clears_csrf_cookie(client):
    """Logout must delete the readable CSRF cookie along with the session cookie."""
    _, cookie_csrf = await _register_and_login(client)
    assert client.cookies.get("medexplain_csrf") == cookie_csrf

    logout = await client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": cookie_csrf},
    )
    assert logout.status_code == 200
    # After logout, the CSRF cookie should be gone.
    assert client.cookies.get("medexplain_csrf") is None
    assert client.cookies.get("medexplain_session") is None


# ---------------------------------------------------------------------------
# Integration: /auth/csrf/refresh endpoint
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_csrf_refresh_issues_new_token_for_existing_session(client):
    """POST /auth/csrf/refresh mints a new token AND sets a new cookie."""
    _, original_cookie_csrf = await _register_and_login(client)

    resp = await client.post("/api/auth/csrf/refresh")
    assert resp.status_code == 200
    new_csrf = resp.json()["csrf_token"]

    # Must be a fresh token (not equal to the original).
    assert new_csrf != original_cookie_csrf
    # Must also be persisted in the cookie jar.
    assert client.cookies.get("medexplain_csrf") == new_csrf

    # The old token must NO LONGER be valid (hash was rotated in the DB).
    # Use the verify_csrf_token dependency directly to check this.
    # (See test_verify_csrf_token_rejects_rotated_token below for a direct check.)


@pytest.mark.asyncio
async def test_csrf_refresh_rejected_without_session(client):
    """No session cookie -> refresh must 401 (cannot mint for an anonymous user)."""
    resp = await client.post("/api/auth/csrf/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_csrf_refresh_rejected_after_session_expired(client):
    """If the session itself is invalid, refresh must 401 (not silently mint a token)."""
    # Build a fake session cookie that doesn't correspond to any DB row.
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set("medexplain_session", "nonexistent-session-token")
        resp = await ac.post("/api/auth/csrf/refresh")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# End-to-end: simulate the original bug scenario (page refresh loses token)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_page_refresh_recovery_via_cookie_then_refresh(client):
    """End-to-end simulation of the bug being fixed:

    1. login -> get csrf cookie
    2. cookie is still readable -> frontend reads it on page load and is happy
    3. simulate cookie being wiped too -> /auth/csrf/refresh mints a new one
    4. new token is set in a fresh cookie and is usable for subsequent state-changing requests
    """
    _, cookie_csrf = await _register_and_login(client)

    # Step 2: refresh scenario — token survives via the cookie.
    # The frontend reads the cookie and sends it in the header for the next POST.
    # Verify the cookie is present and matches what login returned.
    assert client.cookies.get("medexplain_csrf") == cookie_csrf

    # Step 3: simulate cookie being wiped (e.g. user cleared browser data).
    # We keep the session cookie but drop the CSRF cookie.
    session_cookie = client.cookies.get("medexplain_session")
    client.cookies.clear()
    client.cookies.set("medexplain_session", session_cookie)

    refresh = await client.post("/api/auth/csrf/refresh")
    assert refresh.status_code == 200
    new_csrf = refresh.json()["csrf_token"]
    # New token must differ from the original.
    assert new_csrf != cookie_csrf
    # New cookie must be set in the jar.
    assert client.cookies.get("medexplain_csrf") == new_csrf


# ---------------------------------------------------------------------------
# Unit-level: verify_csrf_token dependency logic (double-submit + DB hash)
# ---------------------------------------------------------------------------
async def _seed_session_and_get_tokens(db: AsyncSession) -> tuple[str, str, User]:
    """Create a user + session in the DB and return (session_token, csrf_token, user)."""
    user = User(email="unit@example.com", password_hash=hash_password("password123"))
    db.add(user)
    await db.flush()
    session_token, csrf_token, _ = await create_session(db, user)
    await db.commit()
    return session_token, csrf_token, user


def _make_request(method: str = "POST") -> Request:
    """Build a minimal Starlette Request with the given method."""
    scope = {
        "type": "http",
        "method": method,
        "path": "/",
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 8000),
        "server": ("test", 80),
        "scheme": "http",
    }
    return Request(scope)


@pytest.mark.asyncio
async def test_verify_csrf_token_allows_safe_methods(client):
    """GET / HEAD / OPTIONS skip CSRF verification entirely."""
    # No session, no token — should still pass because method is GET.
    db_gen = get_db()
    db = await db_gen.__anext__()
    try:
        await verify_csrf_token(
            request=_make_request("GET"),
            db=db,
            session_token=None,
            csrf_token=None,
            csrf_cookie=None,
        )
    finally:
        await db_gen.aclose()


@pytest.mark.asyncio
async def test_verify_csrf_token_rejects_when_header_missing(client):
    """POST without X-CSRF-Token header -> 403."""
    db_gen = get_db()
    db = await db_gen.__anext__()
    try:
        session_token, csrf_token, _ = await _seed_session_and_get_tokens(db)
        with pytest.raises(HTTPException) as exc:
            await verify_csrf_token(
                request=_make_request("POST"),
                db=db,
                session_token=session_token,
                csrf_token=None,  # header missing
                csrf_cookie=csrf_token,
            )
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    finally:
        await db_gen.aclose()


@pytest.mark.asyncio
async def test_verify_csrf_token_rejects_when_cookie_missing(client):
    """Double-submit: header present but cookie missing -> 403."""
    db_gen = get_db()
    db = await db_gen.__anext__()
    try:
        session_token, csrf_token, _ = await _seed_session_and_get_tokens(db)
        with pytest.raises(HTTPException) as exc:
            await verify_csrf_token(
                request=_make_request("POST"),
                db=db,
                session_token=session_token,
                csrf_token=csrf_token,
                csrf_cookie=None,  # cookie missing
            )
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    finally:
        await db_gen.aclose()


@pytest.mark.asyncio
async def test_verify_csrf_token_rejects_header_cookie_mismatch(client):
    """Double-submit: header != cookie -> 403, even if header is valid in DB."""
    db_gen = get_db()
    db = await db_gen.__anext__()
    try:
        session_token, csrf_token, _ = await _seed_session_and_get_tokens(db)
        with pytest.raises(HTTPException) as exc:
            await verify_csrf_token(
                request=_make_request("POST"),
                db=db,
                session_token=session_token,
                csrf_token=csrf_token,
                csrf_cookie="a-different-cookie-value",  # mismatch
            )
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN
    finally:
        await db_gen.aclose()


@pytest.mark.asyncio
async def test_verify_csrf_token_accepts_when_header_equals_cookie_and_db_matches(client):
    """Happy path: header == cookie == DB-stored hash."""
    db_gen = get_db()
    db = await db_gen.__anext__()
    try:
        session_token, csrf_token, _ = await _seed_session_and_get_tokens(db)
        # Should not raise.
        await verify_csrf_token(
            request=_make_request("POST"),
            db=db,
            session_token=session_token,
            csrf_token=csrf_token,
            csrf_cookie=csrf_token,
        )
    finally:
        await db_gen.aclose()


@pytest.mark.asyncio
async def test_verify_csrf_token_rejects_rotated_token(client):
    """After /auth/csrf/refresh rotates the token, the old token must stop working."""
    db_gen = get_db()
    db = await db_gen.__anext__()
    try:
        session_token, csrf_token, _ = await _seed_session_and_get_tokens(db)

        # Simulate the refresh endpoint rotating the CSRF token.
        from app.services.auth_service import refresh_csrf_token

        new_csrf = await refresh_csrf_token(db, session_token)
        await db.commit()
        assert new_csrf is not None
        assert new_csrf != csrf_token

        # Old token must now fail (DB hash no longer matches).
        with pytest.raises(HTTPException) as exc:
            await verify_csrf_token(
                request=_make_request("POST"),
                db=db,
                session_token=session_token,
                csrf_token=csrf_token,  # stale
                csrf_cookie=csrf_token,  # stale
            )
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN

        # New token must work.
        await verify_csrf_token(
            request=_make_request("POST"),
            db=db,
            session_token=session_token,
            csrf_token=new_csrf,
            csrf_cookie=new_csrf,
        )
    finally:
        await db_gen.aclose()
