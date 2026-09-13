from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SOSCreate(BaseModel):
    latitude: float = Field(..., example=13.0827)
    longitude: float = Field(..., example=80.3800)
    emergency_type: str = Field(..., example="Engine Failure") # Medical, Engine Failure, Capsizing, Storm/Stranded, Fire, Collision, Other
    description: Optional[str] = Field(None, example="Engine died 12km off Chennai port. Drifting NE.")
    people_affected: int = Field(1, ge=1, example=4)
    priority: Optional[str] = Field("CRITICAL", example="CRITICAL") # CRITICAL, HIGH, MEDIUM, LOW

class SOSStatusUpdate(BaseModel):
    status: str = Field(..., example="ACKNOWLEDGED")
    notes: Optional[str] = Field(None, example="Coast Guard Command Center acknowledged distress call.")

class FishermanMinimal(BaseModel):
    id: Optional[int] = None
    name: str
    phone: str
    emergency_phone: Optional[str] = None
    home_port: Optional[str] = None

class BoatMinimal(BaseModel):
    id: Optional[int] = None
    name: str
    registration: Optional[str] = None
    vessel_type: Optional[str] = None

class RescueMissionSummary(BaseModel):
    id: int
    rescue_team: str
    rescue_vessel: str
    status: str
    eta_minutes: int

class SOSResponse(BaseModel):
    id: int
    fisherman_id: Optional[int] = None
    boat_id: Optional[int] = None
    fisherman: Optional[FishermanMinimal] = None
    boat: Optional[BoatMinimal] = None
    latitude: float
    longitude: float
    emergency_type: str
    description: Optional[str] = None
    people_affected: int
    priority: str
    status: str
    distance_to_nearest_port_km: Optional[float] = 12.4
    nearest_port_name: Optional[str] = "Chennai Port HQ"
    created_at: datetime
    updated_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    rescue_mission: Optional[RescueMissionSummary] = None

    class Config:
        from_attributes = True

class CoastalGuardDashboardResponse(BaseModel):
    active_sos_count: int
    critical_alerts_count: int
    active_rescue_missions_count: int
    resolved_today_count: int
    high_risk_zones_count: int
    monitored_fishermen_count: int
    last_updated: str
