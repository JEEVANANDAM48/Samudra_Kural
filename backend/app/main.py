from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.health import router as health_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(health_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": "Welcome to Samudra Kural API",
        "docs": "/docs"
    }
