import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "samudra-kural-backend"
    }

def test_db_health_endpoint():
    response = client.get("/api/v1/health/db")
    # Response code depends on whether PostgreSQL is actively running
    assert response.status_code in (200, 503)
    if response.status_code == 200:
        assert response.json()["status"] == "ok"
        assert response.json()["database"] == "connected"
    else:
        assert response.status_code == 503
        assert "detail" in response.json()

def test_postgis_health_endpoint():
    response = client.get("/api/v1/health/postgis")
    # Response code depends on whether PostGIS container is actively running
    assert response.status_code in (200, 503)
    if response.status_code == 200:
        assert response.json()["status"] == "ok"
        assert response.json()["postgis"] == "available"
        assert "version" in response.json()
    else:
        assert response.status_code == 503
        assert "detail" in response.json()
