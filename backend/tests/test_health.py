import pytest

@pytest.mark.anyio
async def test_health_endpoint(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "samudra-kural-backend"
    }

@pytest.mark.anyio
async def test_db_health_endpoint(client):
    response = await client.get("/api/v1/health/db")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "connected"

@pytest.mark.anyio
async def test_postgis_health_endpoint(client):
    response = await client.get("/api/v1/health/postgis")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["postgis"] == "available"
    assert "version" in response.json()
