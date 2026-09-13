import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.db.session import engine

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.fixture(autouse=True)
async def cleanup_database():
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM fishing_locations;"))
            await conn.execute(text("DELETE FROM boats;"))
            await conn.execute(text("DELETE FROM fishermen;"))
        yield
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM fishing_locations;"))
            await conn.execute(text("DELETE FROM boats;"))
            await conn.execute(text("DELETE FROM fishermen;"))
    except Exception:
        # DB not active, allow non-database tests to run
        yield
