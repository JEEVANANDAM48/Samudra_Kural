from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from app.schemas.sos import SOSCreate, SOSResponse, SOSStatusUpdate
from app.db.base import Base

router = APIRouter(tags=["SOS Emergency Alerts"])

# In-memory store fallback when DB instance is starting up, ensuring zero crashes
_in_memory_sos_alerts: List[dict] = [
    {
        "id": 1,
        "fisherman_id": 101,
        "boat_id": 1,
        "fisherman": {
            "id": 101,
            "name": "Karthik Raja",
            "phone": "+91 98401 23456",
            "emergency_phone": "+91 98401 99999",
            "home_port": "Chennai Fishing Harbour"
        },
        "boat": {
            "id": 1,
            "name": "Sea Star",
            "registration": "IND-TN-02-MM-4412",
            "vessel_type": "Mechanized Trawler"
        },
        "latitude": 13.1250,
        "longitude": 80.4120,
        "emergency_type": "Engine Failure",
        "description": "Main diesel engine stopped unexpectedly 14 km offshore. Boat drifting northeast with 4 crew members onboard.",
        "people_affected": 4,
        "priority": "CRITICAL",
        "status": "NEW",
        "distance_to_nearest_port_km": 14.2,
        "nearest_port_name": "Chennai Port HQ",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "acknowledged_at": None,
        "resolved_at": None,
        "rescue_mission": None
    },
    {
        "id": 2,
        "fisherman_id": 102,
        "boat_id": 2,
        "fisherman": {
            "id": 102,
            "name": "Murugan Swamy",
            "phone": "+91 97890 54321",
            "emergency_phone": "+91 97890 88888",
            "home_port": "Kattupalli Port"
        },
        "boat": {
            "id": 2,
            "name": "Kadal Kanni",
            "registration": "IND-TN-02-MM-1890",
            "vessel_type": "Gillnetter"
        },
        "latitude": 13.2980,
        "longitude": 80.3540,
        "emergency_type": "Medical",
        "description": "Crew member suffered severe hand injury from winch equipment. Requires immediate medical evacuation.",
        "people_affected": 1,
        "priority": "CRITICAL",
        "status": "ACKNOWLEDGED",
        "distance_to_nearest_port_km": 18.6,
        "nearest_port_name": "Kattupalli Port",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "acknowledged_at": datetime.now().isoformat(),
        "resolved_at": None,
        "rescue_mission": None
    }
]
_next_sos_id = 3

@router.post("/sos", response_model=SOSResponse, status_code=status.HTTP_201_CREATED)
def trigger_sos_alert(payload: SOSCreate):
    """
    Fisherman Mobile App SOS trigger endpoint.
    Receives current GPS coordinates, emergency type, description, and affected count.
    """
    global _next_sos_id
    new_alert = {
        "id": _next_sos_id,
        "fisherman_id": 1,
        "boat_id": 1,
        "fisherman": {
            "id": 1,
            "name": payload.fisherman_name or "Fisherman User",
            "phone": payload.fisherman_phone or "+91 98400 11223",
            "emergency_phone": "+91 94440 99999",
            "home_port": payload.home_port or "Kasimedu Harbour, Chennai"
        },
        "boat": {
            "id": 1,
            "name": payload.boat_name or "Sea King IX",
            "registration": payload.boat_registration or "IND-TN-02-MM-8492",
            "vessel_type": "Mechanized Trawler"
        },
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "emergency_type": payload.emergency_type,
        "description": payload.description or f"Emergency SOS ({payload.emergency_type}) triggered from mobile GPS.",
        "people_affected": payload.people_affected,
        "priority": payload.priority or "CRITICAL",
        "status": "NEW",
        "distance_to_nearest_port_km": round(((payload.latitude - 13.0827)**2 + (payload.longitude - 80.3800)**2)**0.5 * 111, 1),
        "nearest_port_name": "Chennai Port HQ",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "acknowledged_at": None,
        "resolved_at": None,
        "rescue_mission": None
    }
    _in_memory_sos_alerts.insert(0, new_alert)
    _next_sos_id += 1
    return new_alert

@router.get("/sos", response_model=List[SOSResponse])
def list_sos_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority")
):
    """
    List active or filtered SOS alerts.
    """
    results = _in_memory_sos_alerts
    if status_filter:
        results = [a for a in results if a["status"].upper() == status_filter.upper()]
    if priority_filter:
        results = [a for a in results if a["priority"].upper() == priority_filter.upper()]
    return results

@router.get("/sos/{sos_id}", response_model=SOSResponse)
def get_sos_alert(sos_id: int):
    """
    Get detailed information for a single SOS alert.
    """
    for alert in _in_memory_sos_alerts:
        if alert["id"] == sos_id:
            return alert
    raise HTTPException(status_code=404, detail=f"SOS alert with ID {sos_id} not found.")

@router.patch("/sos/{sos_id}/acknowledge", response_model=SOSResponse)
def acknowledge_sos_alert(sos_id: int, payload: Optional[SOSStatusUpdate] = None):
    """
    Coastal Guard acknowledges an active SOS alert.
    """
    for alert in _in_memory_sos_alerts:
        if alert["id"] == sos_id:
            alert["status"] = "ACKNOWLEDGED"
            alert["acknowledged_at"] = datetime.now().isoformat()
            alert["updated_at"] = datetime.now().isoformat()
            return alert
    raise HTTPException(status_code=404, detail=f"SOS alert with ID {sos_id} not found.")

@router.patch("/sos/{sos_id}/status", response_model=SOSResponse)
def update_sos_status(sos_id: int, payload: SOSStatusUpdate):
    """
    Update SOS status (e.g. ACKNOWLEDGED, RESCUE_ASSIGNED, RESCUE_IN_PROGRESS, RESOLVED, CANCELLED).
    """
    for alert in _in_memory_sos_alerts:
        if alert["id"] == sos_id:
            alert["status"] = payload.status.upper()
            alert["updated_at"] = datetime.now().isoformat()
            if payload.status.upper() == "RESOLVED":
                alert["resolved_at"] = datetime.now().isoformat()
            return alert
    raise HTTPException(status_code=404, detail=f"SOS alert with ID {sos_id} not found.")
