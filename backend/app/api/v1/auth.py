from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.models.fisherman import Fisherman
from app.schemas.auth import FishermanRegister, FishermanLogin, TokenResponse
from app.schemas.fisherman import FishermanResponse
from app.core.security import get_password_hash, verify_password, create_access_token
from app.services.spatial import location_to_wkt, spatial_to_location_point
from app.api.deps import get_current_fisherman

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=FishermanResponse, status_code=status.HTTP_201_CREATED)
async def register_fisherman(
    register_in: FishermanRegister,
    db: AsyncSession = Depends(get_db)
) -> FishermanResponse:
    email_str = str(register_in.email).strip().lower()
    # Check if email is already registered
    existing = await db.execute(select(Fisherman.id).where(func.lower(Fisherman.email) == email_str))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    shore_pt = register_in.shore_location
    shore_wkt = location_to_wkt(shore_pt)
    pwd_hash = get_password_hash(register_in.password)

    db_fisherman = Fisherman(
        name=register_in.name,
        email=email_str,
        phone=register_in.phone,
        password_hash=pwd_hash,
        is_active=True,
        shore_location=shore_wkt,
    )
    db.add(db_fisherman)
    await db.flush()

    res_id = db_fisherman.id
    res_created = db_fisherman.created_at
    res_updated = db_fisherman.updated_at
    await db.commit()

    return FishermanResponse(
        id=res_id,
        name=register_in.name,
        email=email_str,
        phone=register_in.phone,
        is_active=True,
        shore_location=shore_pt,
        created_at=res_created,
        updated_at=res_updated,
    )

@router.post("/login", response_model=TokenResponse)
async def login_fisherman(
    login_in: FishermanLogin,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    email_str = str(login_in.email).strip().lower()
    result = await db.execute(select(Fisherman).where(func.lower(Fisherman.email) == email_str))
    fisherman = result.scalar_one_or_none()

    if fisherman:
        verified = verify_password(login_in.password, fisherman.password_hash)
        print(f"DEBUG LOGIN: email={email_str}, pass={login_in.password!r}, hash={fisherman.password_hash!r}, verified={verified}")
    else:
        print(f"DEBUG LOGIN: fisherman NOT FOUND for email={email_str}")

    if not fisherman or not verify_password(login_in.password, fisherman.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not fisherman.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account"
        )

    access_token = create_access_token(subject=fisherman.id)
    return TokenResponse(access_token=access_token, token_type="bearer")

@router.get("/me", response_model=FishermanResponse)
async def get_current_fisherman_profile(
    current_user: Fisherman = Depends(get_current_fisherman)
) -> FishermanResponse:
    return FishermanResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        is_active=current_user.is_active,
        shore_location=spatial_to_location_point(current_user.shore_location),
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
    )
