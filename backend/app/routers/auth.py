"""Authentication routes."""

import logging
from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status
from app.config import get_settings
from app.limiter import limiter
from app.dependencies import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, CurrentUser, DbSession
from app.schemas import AuthResponse, CsrfResponse, LoginRequest, MessageResponse, RegisterRequest, UserResponse
from app.services.auth_service import (
    AccountLockedError,
    AuthError,
    authenticate_user,
    create_session,
    invalidate_session,
    refresh_csrf_token,
    register_user,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, session_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.session_expire_minutes * 60,
        path="/",
    )


def _set_csrf_cookie(response: Response, csrf_token: str) -> None:
    """Set the raw CSRF token in a JS-readable cookie (double-submit pattern).

    HttpOnly is intentionally False so the SPA can read it after a page
    refresh. SameSite=Lax and Secure (in prod) keep it from being sent on
    cross-site requests.
    """
    settings = get_settings()
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        httponly=False,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.session_expire_minutes * 60,
        path="/",
    )


def _clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(CSRF_COOKIE, path="/")


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(lambda: get_settings().rate_limit_login)
async def register(
    request: Request,  # noqa: F821 — injected by slowapi
    body: RegisterRequest,
    response: Response,
    db: DbSession,
):
    try:
        user = await register_user(db, body.email, body.password)
        session_token, csrf_token, _ = await create_session(db, user)
        _set_session_cookie(response, session_token)
        _set_csrf_cookie(response, csrf_token)
        return AuthResponse(user=UserResponse.model_validate(user), csrf_token=csrf_token)
    except AuthError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/login", response_model=AuthResponse)
@limiter.limit(lambda: get_settings().rate_limit_login)
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: DbSession,
):
    try:
        user = await authenticate_user(db, body.email, body.password)
        session_token, csrf_token, _ = await create_session(db, user)
        _set_session_cookie(response, session_token)
        _set_csrf_cookie(response, csrf_token)
        return AuthResponse(user=UserResponse.model_validate(user), csrf_token=csrf_token)
    except AccountLockedError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e)) from e
    except AuthError:
        # Security: generic message, never reveal which field failed
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    db: DbSession,
    user: CurrentUser,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
):
    if session_token:
        await invalidate_session(db, session_token)
    response.delete_cookie(SESSION_COOKIE, path="/")
    _clear_csrf_cookie(response)
    logger.info("Logout: user_id=%s", user.id)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser):
    return UserResponse.model_validate(user)


@router.post("/csrf/refresh", response_model=CsrfResponse)
async def refresh_csrf(
    response: Response,
    db: DbSession,
    user: CurrentUser,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
):
    """Issue a new CSRF token for an existing session.

    Use this when the frontend lost its in-memory token AND the CSRF cookie
    (e.g. cookie was cleared by the browser). Requires a valid session cookie
    — if the session itself is dead, this returns 401 and the user must log in
    again. Persists the new token hash in the DB and sets a fresh readable
    CSRF cookie so subsequent page refreshes can restore it without another
    round-trip.
    """
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    new_csrf = await refresh_csrf_token(db, session_token)
    if not new_csrf:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    _set_csrf_cookie(response, new_csrf)
    return CsrfResponse(csrf_token=new_csrf)
