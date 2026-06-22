"""API integration tests."""

import os

# Set test env before any app imports
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-minimum-32-characters-long")
os.environ.setdefault("CSRF_SECRET", "test-csrf-secret-key-minimum-32-chars")
os.environ.setdefault("ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("CLAMAV_ENABLED", "false")

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.database import Base, engine
from app.main import app

get_settings.cache_clear()


@pytest.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await engine.dispose()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_register_and_login(client):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert reg.status_code == 201
    data = reg.json()
    assert data["user"]["email"] == "test@example.com"
    assert "csrf_token" in data

    login = await client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_unauthenticated_reports(client):
    response = await client.get("/api/reports")
    assert response.status_code == 401
