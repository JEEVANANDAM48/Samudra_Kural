from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
from app.schemas.environment import EnvironmentTestResponse
from app.services.environment_service import environment_service
from app.utils.time import ensure_utc

router = APIRouter(tags=["Environment"])

@router.get("/environment/test", response_model=EnvironmentTestResponse)
async def test_ocean_environment(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude coordinate", openapi_examples={"chennai": {"value": 13.05}}),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude coordinate", openapi_examples={"chennai": {"value": 80.35}}),
    target_time: Optional[datetime] = Query(None, description="Target datetime (ISO format)", alias="datetime")
):
    """
    CRITICAL REAL-DATA VALIDATION ENDPOINT
    
    Retrieves operational ocean and atmospheric forecast data from:
    1. INCOIS (Ocean State Forecast - surface currents, winds, waves, swells)
    2. Copernicus Marine Service (Physics currents, Stokes drift, wave parameters)
    
    Performs cross-validation comparison (HIGH / MEDIUM / LOW agreement)
    and normalizes into the unified EnvironmentalState format.
    """
    try:
        dt = ensure_utc(target_time)
        _, test_response = await environment_service.get_normalized_environment(latitude, longitude, dt)
        return test_response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve environmental ocean data: {str(e)}"
        )
