"""FastAPI dependencies for auth and CSRF."""

from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.services.auth_service import get_user_by_session, verify_csrf

SESSION_COOKIE = "medexplain_session"
# Double-submit cookie: stores the raw CSRF token so the frontend can read it
# after a page refresh. Must NOT be HttpOnly — JS needs to read it. Stays safe
# because (a) SameSite=Lax blocks cross-site sends, and (b) we still verify the
# token against the DB hash on every state-changing request.
CSRF_COOKIE = "medexplain_csrf"
CSRF_HEADER = "X-CSRF-Token"


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user = await get_user_by_session(db, session_token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    return user


async def get_optional_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User | None:
    if not session_token:
        return None
    return await get_user_by_session(db, session_token)


async def verify_csrf_token(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
    csrf_token: Annotated[str | None, Header(alias=CSRF_HEADER)] = None,
    csrf_cookie: Annotated[str | None, Cookie(alias=CSRF_COOKIE)] = None,
) -> None:
    """CSRF protection for state-changing requests.

    Uses a hybrid double-submit + server-side hash scheme:
      1. The header value must match the readable CSRF cookie value (double-submit).
      2. The hash of that value must match the hash stored on the session row in
         the DB (defense-in-depth; an attacker who could plant a cookie still
         could not forge a valid hash without compromising the session).
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    if not session_token or not csrf_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")

    # Double-submit check: header must equal the readable cookie value.
    if not csrf_cookie or csrf_cookie != csrf_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")

    if not await verify_csrf(db, session_token, csrf_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
