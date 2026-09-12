from typing import Optional, Dict
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Samudra Kural Backend"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    DEMO_MODE: bool = False  # If False, real data is mandatory; if True, mock is permitted for UI testing

    # Database Settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "samudra"
    POSTGRES_PASSWORD: str = "samudra_dev_password"
    POSTGRES_DB: str = "samudra_kural"
    ASYNC_DATABASE_URL: Optional[str] = None

    # JWT Settings
    JWT_SECRET_KEY: str = "samudra_kural_dev_secret_key_change_in_production_32bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Copernicus Marine Toolbox Authentication & Datasets
    COPERNICUSMARINE_SERVICE_USERNAME: Optional[str] = os.getenv("COPERNICUSMARINE_SERVICE_USERNAME")
    COPERNICUSMARINE_SERVICE_PASSWORD: Optional[str] = os.getenv("COPERNICUSMARINE_SERVICE_PASSWORD")
    COPERNICUS_PHY_DATASET_ID: str = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"
    COPERNICUS_WAV_DATASET_ID: str = "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i"

    # INCOIS Operational Ocean State Forecast Services
    INCOIS_BASE_URL: str = "https://incois.gov.in"
    INCOIS_DATA_DIR: str = "data/incois"
    INCOIS_CACHE_TTL_MINUTES: int = 180

    # Net Drift Physics & Model Configuration
    # NOTE: Windage coefficients are model assumptions representing surface leeway drag
    # based on net construction, floats, and submerged mesh resistance.
    # They are versioned, configurable, and subject to future empirical calibration.
    DRIFT_MODEL_VERSION: str = "v1.0.0-surface-leeway"
    DEFAULT_TIMESTEP_MINUTES: int = 15  # Trajectory integration step
    MAX_PREDICTION_HOURS: int = 48      # Maximum forward horizon
    
    WINDAGE_COEFFICIENTS: Dict[str, float] = {
        "FLOATING_GILL_NET": 0.028,    # 2.8% leeway wind drag
        "DRIFTING_NET": 0.020,         # 2.0% leeway wind drag
        "SURFACE_NET": 0.035,          # 3.5% leeway wind drag (high surface exposure)
        "OTHER_FLOATING_NET": 0.025,   # 2.5% leeway wind drag
    }

    @property
    def database_url(self) -> str:
        if self.ASYNC_DATABASE_URL:
            return self.ASYNC_DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
