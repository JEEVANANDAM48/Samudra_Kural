from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, cast
from geoalchemy2 import Geometry
from app.db.session import get_db
from app.models.fisherman import Fisherman
from app.models.location import FishingLocation
from app.schemas.location import FishingLocationCreate, FishingLocationResponse, NearbyLocationResponse
from app.services.spatial import location_to_wkt, spatial_to_location_point, wkt_from_lat_lon
from app.api.deps import get_current_fisherman

router = APIRouter(prefix="/locations", tags=["Locations"])

@router.post("", response_model=FishingLocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_in: FishingLocationCreate,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> FishingLocationResponse:
    loc_pt = location_in.location
    wkt_loc = location_to_wkt(loc_pt)
    db_location = FishingLocation(
        fisherman_id=current_user.id,
        name=location_in.name,
        location=wkt_loc,
        notes=location_in.notes,
    )
    db.add(db_location)
    await db.flush()
    res_id = db_location.id
    res_created = db_location.created_at
    res_updated = db_location.updated_at
    await db.commit()

    return FishingLocationResponse(
        id=res_id,
        fisherman_id=current_user.id,
        name=location_in.name,
        location=loc_pt,
        notes=location_in.notes,
        created_at=res_created,
        updated_at=res_updated,
    )

@router.get("/nearby", response_model=List[NearbyLocationResponse])
async def get_nearby_locations(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Center point latitude"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Center point longitude"),
    radius_meters: float = Query(..., gt=0.0, description="Search radius in meters"),
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> List[NearbyLocationResponse]:
    ref_point = wkt_from_lat_lon(latitude, longitude)
    
    distance_expr = func.ST_Distance(FishingLocation.location, ref_point).label("distance_meters")
    lat_expr = func.ST_Y(cast(FishingLocation.location, Geometry)).label("latitude")
    lon_expr = func.ST_X(cast(FishingLocation.location, Geometry)).label("longitude")

    query = (
        select(
            FishingLocation.id,
            FishingLocation.fisherman_id,
            FishingLocation.name,
            lat_expr,
            lon_expr,
            distance_expr
        )
        .where(
            FishingLocation.fisherman_id == current_user.id,
            func.ST_DWithin(FishingLocation.location, ref_point, radius_meters)
        )
        .order_by(distance_expr.asc())
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        NearbyLocationResponse(
            id=row.id,
            fisherman_id=row.fisherman_id,
            name=row.name,
            latitude=float(row.latitude),
            longitude=float(row.longitude),
            distance_meters=float(row.distance_meters),
        )
        for row in rows
    ]

@router.get("/{location_id}", response_model=FishingLocationResponse)
async def get_location(
    location_id: int,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> FishingLocationResponse:
    result = await db.execute(select(FishingLocation).where(FishingLocation.id == location_id))
    db_location = result.scalar_one_or_none()
    if not db_location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fishing location not found")

    if db_location.fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this fishing location"
        )

    return FishingLocationResponse(
        id=db_location.id,
        fisherman_id=db_location.fisherman_id,
        name=db_location.name,
        location=spatial_to_location_point(db_location.location),
        notes=db_location.notes,
        created_at=db_location.created_at,
        updated_at=db_location.updated_at,
    )

@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: int,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(FishingLocation).where(FishingLocation.id == location_id))
    db_location = result.scalar_one_or_none()
    if not db_location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fishing location not found")

    if db_location.fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this fishing location"
        )

    await db.execute(delete(FishingLocation).where(FishingLocation.id == location_id))
    await db.commit()
    return None
