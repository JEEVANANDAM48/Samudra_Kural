from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class MissionCreate(BaseModel):
    sos_alert_id: int = Field(..., example=1)
    assigned_officer_id: Optional[int] = None
    officer_name: str = Field("Officer Command HQ", example="Cmdr. R. Sharma")
    rescue_team: str = Field(..., example="ICG Tactical Squadron 04")
    rescue_vessel: str = Field(..., example="ICGS C-438 Fast Patrol Vessel")
    eta_minutes: int = Field(25, ge=1, example=20)
    notes: Optional[str] = Field(None, example="Dispatched with medical crew & tow equipment.")

class MissionStatusUpdate(BaseModel):
    status: str = Field(..., example="DEPARTED") # ASSIGNED, DEPARTED, APPROACHING, VICTIM_LOCATED, RETURNING, COMPLETED, CANCELLED
    notes: Optional[str] = Field(None, example="Vessel departed port heading 045 degrees.")
    eta_minutes: Optional[int] = Field(None, example=15)

class MissionResponse(BaseModel):
    id: int
    sos_alert_id: int
    assigned_officer_id: Optional[int] = None
    officer_name: str
    rescue_team: str
    rescue_vessel: str
    status: str
    eta_minutes: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
