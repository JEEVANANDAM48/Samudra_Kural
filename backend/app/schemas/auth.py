from pydantic import BaseModel, Field, EmailStr
from app.schemas.common import LocationPoint

class FishermanRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Full name")
    email: EmailStr = Field(..., description="Unique login email address")
    phone: str = Field(..., min_length=1, max_length=50, description="Contact phone number")
    password: str = Field(..., min_length=6, max_length=128, description="Secure account password")
    shore_location: LocationPoint

class FishermanLogin(BaseModel):
    email: EmailStr = Field(..., description="Login email address")
    password: str = Field(..., min_length=1, description="Account password")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
