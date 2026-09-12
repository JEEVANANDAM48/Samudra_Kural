import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple
import numpy as np
from app.core.config import settings
from app.utils.direction import uv_to_speed_and_direction
from app.utils.time import ensure_utc, calculate_age_minutes

logger = logging.getLogger(__name__)

class CopernicusMarineService:
    """
    Official Copernicus Marine Service client for Ocean Physics and Waves/Stokes drift.
    Retrieves spatial/temporal subsets and performs local interpolation.
    """

    def __init__(self):
        self.username = settings.COPERNICUSMARINE_SERVICE_USERNAME
        self.password = settings.COPERNICUSMARINE_SERVICE_PASSWORD
        self.phy_dataset_id = settings.COPERNICUS_PHY_DATASET_ID
        self.wav_dataset_id = settings.COPERNICUS_WAV_DATASET_ID

    def get_credentials_configured(self) -> bool:
        return bool(self.username and self.password)

    def fetch_point_environment(
        self,
        latitude: float,
        longitude: float,
        target_time: datetime
    ) -> Dict[str, Any]:
        """
        Fetch ocean physics (currents) and waves (Stokes drift, height, period)
        at a specific point and time.
        """
        target_time_utc = ensure_utc(target_time)

        # In DEMO_MODE, return deterministic ocean physics for UI development if credentials are absent
        if settings.DEMO_MODE and not self.get_credentials_configured():
            logger.info("DEMO_MODE=true: Generating deterministic mock Copernicus data for coordinate (%s, %s)", latitude, longitude)
            return self._generate_deterministic_demo_data(latitude, longitude, target_time_utc)

        # In REAL DATA mode, copernicusmarine must be used
        try:
            import copernicusmarine
            
            # If credentials are provided in env, configure session
            if self.get_credentials_configured():
                try:
                    copernicusmarine.login(
                        username=self.username,
                        password=self.password,
                        force_overwrite=True
                    )
                except Exception as login_err:
                    logger.warning("Copernicus login failed: %s", login_err)

            # Define localized bounding box and time slice for efficient subsetting
            min_lat = latitude - 0.25
            max_lat = latitude + 0.25
            min_lon = longitude - 0.25
            max_lon = longitude + 0.25
            start_time = target_time_utc - timedelta(hours=12)
            end_time = target_time_utc + timedelta(hours=12)

            logger.info("Querying Copernicus Marine dataset %s around (%s, %s)", self.phy_dataset_id, latitude, longitude)
            
            # Lazy open or subset dataset
            phy_ds = copernicusmarine.open_dataset(
                dataset_id=self.phy_dataset_id,
                minimum_latitude=min_lat,
                maximum_latitude=max_lat,
                minimum_longitude=min_lon,
                maximum_longitude=max_lon,
                start_datetime=start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                end_datetime=end_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            )

            # Inspect variables dynamically
            uo_var = "uo" if "uo" in phy_ds.data_vars else [v for v in phy_ds.data_vars if "uo" in v.lower() or "eastward" in v.lower()][0]
            vo_var = "vo" if "vo" in phy_ds.data_vars else [v for v in phy_ds.data_vars if "vo" in v.lower() or "northward" in v.lower()][0]

            # Interpolate spatially and temporally
            point_phy = phy_ds.interp(
                latitude=latitude,
                longitude=longitude,
                time=np.datetime64(target_time_utc.replace(tzinfo=None)),
                method="linear"
            )

            uo = float(point_phy[uo_var].values)
            vo = float(point_phy[vo_var].values)

            # Query Waves & Stokes Drift dataset
            stokes_u = 0.0
            stokes_v = 0.0
            wave_height = 1.0
            wave_period = 6.0
            wave_direction = 90.0

            try:
                wav_ds = copernicusmarine.open_dataset(
                    dataset_id=self.wav_dataset_id,
                    minimum_latitude=min_lat,
                    maximum_latitude=max_lat,
                    minimum_longitude=min_lon,
                    maximum_longitude=max_lon,
                    start_datetime=start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    end_datetime=end_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                )
                point_wav = wav_ds.interp(
                    latitude=latitude,
                    longitude=longitude,
                    time=np.datetime64(target_time_utc.replace(tzinfo=None)),
                    method="linear"
                )

                # Inspect wave variables dynamically
                if "VSDX" in wav_ds.data_vars:
                    stokes_u = float(point_wav["VSDX"].values)
                if "VSDY" in wav_ds.data_vars:
                    stokes_v = float(point_wav["VSDY"].values)
                if "VHM0" in wav_ds.data_vars:
                    wave_height = float(point_wav["VHM0"].values)
                if "VTPK" in wav_ds.data_vars:
                    wave_period = float(point_wav["VTPK"].values)
                if "VMDR" in wav_ds.data_vars:
                    wave_direction = float(point_wav["VMDR"].values)
            except Exception as wav_err:
                logger.warning("Wave dataset query non-fatal fallback: %s", wav_err)

            current_speed, current_dir, current_cardinal = uv_to_speed_and_direction(uo, vo, is_oceanographic=True)
            stokes_speed, stokes_dir, _ = uv_to_speed_and_direction(stokes_u, stokes_v, is_oceanographic=True)

            return {
                "status": "available",
                "dataset_id": self.phy_dataset_id,
                "timestamp": target_time_utc.isoformat(),
                "data_age_minutes": calculate_age_minutes(target_time_utc),
                "current": {
                    "uo": round(uo, 4),
                    "vo": round(vo, 4),
                    "speed_mps": round(current_speed, 3),
                    "direction_deg": round(current_dir, 1),
                    "cardinal": current_cardinal,
                },
                "stokes_drift": {
                    "vsdx": round(stokes_u, 4),
                    "vsdy": round(stokes_v, 4),
                    "speed_mps": round(stokes_speed, 3),
                    "direction_deg": round(stokes_dir, 1),
                },
                "wave": {
                    "significant_wave_height_m": round(wave_height, 2),
                    "wave_period_s": round(wave_period, 1),
                    "wave_direction_deg": round(wave_direction, 1),
                },
                "units": {
                    "uo": "m/s",
                    "vo": "m/s",
                    "speed": "m/s",
                    "direction": "degrees",
                    "wave_height": "m",
                    "stokes_drift": "m/s"
                }
            }

        except Exception as e:
            logger.error("Copernicus Marine real data retrieval error: %s", e)
            if settings.DEMO_MODE:
                logger.info("Falling back to deterministic demo data because DEMO_MODE=true")
                return self._generate_deterministic_demo_data(latitude, longitude, target_time_utc)
            
            return {
                "status": "unavailable",
                "dataset_id": self.phy_dataset_id,
                "timestamp": target_time_utc.isoformat(),
                "error": f"Copernicus Marine forecast data temporarily unavailable: {str(e)}",
                "current": {},
                "stokes_drift": {},
                "wave": {},
                "units": {}
            }

    def _generate_deterministic_demo_data(
        self,
        latitude: float,
        longitude: float,
        target_time: datetime
    ) -> Dict[str, Any]:
        """
        Deterministic physics generator for UI development when DEMO_MODE=true.
        Produces smooth, location-dependent continuous vectors based on Coromandel/Arabian Sea currents.
        """
        # Phase variation based on coordinate and hour
        hour_frac = target_time.hour + target_time.minute / 60.0
        phase = (latitude * 1.5 + longitude * 0.8 + hour_frac * 0.2) % (2.0 * math.pi)
        
        # Dominant Indian coastal current is northward/eastward along east coast (0.25 to 0.45 m/s)
        current_speed = 0.32 + 0.12 * math.sin(phase)
        current_dir = (45.0 + 20.0 * math.cos(phase) + 360.0) % 360.0
        
        rad = math.radians(current_dir)
        uo = current_speed * math.sin(rad)
        vo = current_speed * math.cos(rad)

        stokes_speed = current_speed * 0.14  # ~14% of current speed
        stokes_u = stokes_speed * math.sin(rad + 0.1)
        stokes_v = stokes_speed * math.cos(rad + 0.1)

        wave_height = 1.1 + 0.3 * math.sin(phase * 1.2)
        wave_period = 6.2 + 0.8 * math.cos(phase)
        wave_dir = (current_dir + 15.0) % 360.0

        current_speed, current_dir, current_cardinal = uv_to_speed_and_direction(uo, vo, is_oceanographic=True)
        stokes_speed, stokes_dir, _ = uv_to_speed_and_direction(stokes_u, stokes_v, is_oceanographic=True)

        return {
            "status": "available (demo)",
            "dataset_id": self.phy_dataset_id,
            "timestamp": target_time.isoformat(),
            "data_age_minutes": calculate_age_minutes(target_time),
            "current": {
                "uo": round(uo, 4),
                "vo": round(vo, 4),
                "speed_mps": round(current_speed, 3),
                "direction_deg": round(current_dir, 1),
                "cardinal": current_cardinal,
            },
            "stokes_drift": {
                "vsdx": round(stokes_u, 4),
                "vsdy": round(stokes_v, 4),
                "speed_mps": round(stokes_speed, 3),
                "direction_deg": round(stokes_dir, 1),
            },
            "wave": {
                "significant_wave_height_m": round(wave_height, 2),
                "wave_period_s": round(wave_period, 1),
                "wave_direction_deg": round(wave_dir, 1),
            },
            "units": {
                "uo": "m/s",
                "vo": "m/s",
                "speed": "m/s",
                "direction": "degrees",
                "wave_height": "m",
                "stokes_drift": "m/s"
            }
        }

copernicus_service = CopernicusMarineService()
