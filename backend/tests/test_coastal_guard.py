import pytest

@pytest.mark.anyio
async def test_sos_trigger_and_acknowledgement(client):
    # 1. Fisherman triggers SOS
    sos_payload = {
        "latitude": 13.1250,
        "longitude": 80.4120,
        "emergency_type": "Engine Failure",
        "description": "Engine failure 14km off Chennai harbour. Drifting NE.",
        "people_affected": 4,
        "priority": "CRITICAL"
    }
    response = await client.post("/api/v1/sos", json=sos_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["emergency_type"] == "Engine Failure"
    assert data["priority"] == "CRITICAL"
    assert data["status"] == "NEW"
    sos_id = data["id"]

    # 2. Coastal Guard views SOS alert details
    detail_resp = await client.get(f"/api/v1/sos/{sos_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == sos_id

    # 3. Coastal Guard acknowledges SOS alert
    ack_resp = await client.patch(f"/api/v1/sos/{sos_id}/acknowledge")
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "ACKNOWLEDGED"

@pytest.mark.anyio
async def test_coastal_guard_dashboard_endpoint(client):
    response = await client.get("/api/v1/coastal-guard/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "active_sos_count" in data
    assert "critical_alerts_count" in data
    assert "active_rescue_missions_count" in data

@pytest.mark.anyio
async def test_rescue_mission_lifecycle(client):
    # Create mission for SOS #1
    mission_payload = {
        "sos_alert_id": 1,
        "officer_name": "Cmdr. V. Raman (ICG)",
        "rescue_team": "ICG Tactical Rescue Unit 04",
        "rescue_vessel": "ICGS C-438 Fast Patrol Vessel",
        "eta_minutes": 15,
        "notes": "Patrol vessel dispatched."
    }
    create_resp = await client.post("/api/v1/coastal-guard/missions", json=mission_payload)
    assert create_resp.status_code == 201
    mission = create_resp.json()
    assert mission["rescue_vessel"] == "ICGS C-438 Fast Patrol Vessel"
    mission_id = mission["id"]

    # Update status to COMPLETED
    update_resp = await client.patch(f"/api/v1/coastal-guard/missions/{mission_id}", json={"status": "COMPLETED"})
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "COMPLETED"

@pytest.mark.anyio
async def test_marine_conditions_and_risk_engine(client):
    response = await client.get("/api/v1/coastal-guard/marine-conditions")
    assert response.status_code == 200
    data = response.json()
    assert "overall_risk_level" in data
    assert "wind" in data
    assert "waves" in data

@pytest.mark.anyio
async def test_risk_zones_endpoint(client):
    response = await client.get("/api/v1/coastal-guard/risk-zones")
    assert response.status_code == 200
    zones = response.json()
    assert isinstance(zones, list)
    assert len(zones) > 0
