import math
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Dict, Any, Optional
from app.core.config import settings
from app.services.environment_service import environment_service
from app.services.uncertainty_engine import uncertainty_engine
from app.schemas.prediction import TrajectoryPointSchema, SearchAreaSchema, TrajectoryResponse
from app.utils.geo import forward_geodesic_point, haversine_distance_km, calculate_bearing_degrees
from app.utils.direction import uv_to_speed_and_direction
from app.utils.units import mps_to_kmh
from app.utils.time import ensure_utc, to_ist

logger = logging.getLogger(__name__)

class DeterministicDriftEngine:
    """
    Deterministic Physics-based Net Drift Simulation Engine.
    Integrates surface current, Stokes drift, and windage leeway over discrete time steps.
    """

    def __init__(self):
        self.model_version = settings.DRIFT_MODEL_VERSION
        self.windage_map = settings.WINDAGE_COEFFICIENTS
        self.default_timestep_minutes = settings.DEFAULT_TIMESTEP_MINUTES

    def get_windage_coefficient(self, net_type: str) -> float:
        return self.windage_map.get(net_type, self.windage_map.get("FLOATING_GILL_NET", 0.028))

    async def calculate_trajectory(
        self,
        net_id: int,
        net_name: str,
        net_type: str,
        release_lat: float,
        release_lon: float,
        release_time: datetime,
        retrieval_time: datetime,
        timestep_minutes: Optional[int] = None
    ) -> TrajectoryResponse:
        dt_minutes = timestep_minutes or self.default_timestep_minutes
        dt_seconds = dt_minutes * 60.0

        release_utc = ensure_utc(release_time)
        retrieval_utc = ensure_utc(retrieval_time)

        # Enforce valid forward horizon (at least 15 min, at most MAX_PREDICTION_HOURS)
        if retrieval_utc <= release_utc:
            retrieval_utc = release_utc + timedelta(hours=4)

        max_horizon = release_utc + timedelta(hours=settings.MAX_PREDICTION_HOURS)
        if retrieval_utc > max_horizon:
            retrieval_utc = max_horizon

        total_duration_hours = max(0.25, (retrieval_utc - release_utc).total_seconds() / 3600.0)
        num_steps = max(1, int(math.ceil((retrieval_utc - release_utc).total_seconds() / dt_seconds)))

        windage_coeff = self.get_windage_coefficient(net_type)
        logger.info(
            "Calculating drift trajectory for Net %s (%s). Steps: %s, Timestep: %sm, Windage: %s",
            net_id, net_type, num_steps, dt_minutes, windage_coeff
        )

        current_lat = release_lat
        current_lon = release_lon
        current_time = release_utc
        cumulative_dist_km = 0.0

        points: List[TrajectoryPointSchema] = []
        data_sources = set()

        # Step 0: Initial release point
        env_state_0, _ = await environment_service.get_normalized_environment(current_lat, current_lon, current_time)
        data_sources.update(env_state_0.data_sources)

        points.append(
            TrajectoryPointSchema(
                step_number=0,
                prediction_time_utc=current_time,
                prediction_time_ist=to_ist(current_time).strftime("%d %b %Y, %I:%M %p"),
                latitude=round(current_lat, 5),
                longitude=round(current_lon, 5),
                drift_speed_mps=0.0,
                drift_speed_kmh=0.0,
                drift_direction_deg=0.0,
                drift_direction_cardinal="Release Point",
                cumulative_distance_km=0.0,
                uncertainty_radius_km=0.4,
                confidence="HIGH",
                environmental_summary={
                    "current_speed_mps": env_state_0.current_speed_mps,
                    "wind_speed_kmh": env_state_0.wind_speed_kmh,
                    "wave_height_m": env_state_0.wave_height,
                    "sea_state": env_state_0.sea_state,
                }
            )
        )

        latest_wave_height = env_state_0.wave_height
        latest_wind_speed = env_state_0.wind_speed_mps
        latest_speed_mps = 0.0
        latest_direction_deg = 0.0
        latest_cardinal = "Northeast"

        # Time-step numerical integration
        for step in range(1, num_steps + 1):
            step_time = release_utc + timedelta(seconds=step * dt_seconds)
            if step_time > retrieval_utc:
                step_time = retrieval_utc
                dt_step_seconds = (retrieval_utc - (release_utc + timedelta(seconds=(step - 1) * dt_seconds))).total_seconds()
            else:
                dt_step_seconds = dt_seconds

            # Fetch normalized environmental fields (cached locally)
            env_state, _ = await environment_service.get_normalized_environment(current_lat, current_lon, step_time)
            data_sources.update(env_state.data_sources)

            latest_wave_height = env_state.wave_height
            latest_wind_speed = env_state.wind_speed_mps

            # Deterministic Drift Equation:
            # U_net = current_u + stokes_u + windage_coeff * wind_u
            # V_net = current_v + stokes_v + windage_coeff * wind_v
            u_net = env_state.current_u + env_state.stokes_u + (windage_coeff * env_state.wind_u)
            v_net = env_state.current_v + env_state.stokes_v + (windage_coeff * env_state.wind_v)

            step_speed_mps, step_direction_deg, step_cardinal = uv_to_speed_and_direction(
                u_net, v_net, is_oceanographic=True
            )
            latest_speed_mps = step_speed_mps
            latest_direction_deg = step_direction_deg
            latest_cardinal = step_cardinal

            # Advance position along geodesic
            step_dist_km = (step_speed_mps * dt_step_seconds) / 1000.0
            next_lat, next_lon = forward_geodesic_point(
                current_lat, current_lon, step_dist_km, step_direction_deg
            )

            cumulative_dist_km += step_dist_km
            current_lat = next_lat
            current_lon = next_lon
            current_time = step_time

            # Calculate uncertainty for this checkpoint
            step_hours = (step_time - release_utc).total_seconds() / 3600.0
            step_uncertainty_km, step_confidence, _ = uncertainty_engine.compute_uncertainty_and_search_area(
                release_lat=release_lat,
                release_lon=release_lon,
                predicted_lat=current_lat,
                predicted_lon=current_lon,
                displacement_km=cumulative_dist_km,
                drift_direction_deg=step_direction_deg,
                duration_hours=step_hours,
                wave_height_m=env_state.wave_height,
                wind_speed_mps=env_state.wind_speed_mps,
                agreement_modifier=1.0,
                data_age_minutes=env_state.data_age_minutes
            )

            points.append(
                TrajectoryPointSchema(
                    step_number=step,
                    prediction_time_utc=current_time,
                    prediction_time_ist=to_ist(current_time).strftime("%d %b %Y, %I:%M %p"),
                    latitude=round(current_lat, 5),
                    longitude=round(current_lon, 5),
                    drift_speed_mps=round(step_speed_mps, 3),
                    drift_speed_kmh=round(mps_to_kmh(step_speed_mps), 1),
                    drift_direction_deg=round(step_direction_deg, 1),
                    drift_direction_cardinal=step_cardinal,
                    cumulative_distance_km=round(cumulative_dist_km, 2),
                    uncertainty_radius_km=step_uncertainty_km,
                    confidence=step_confidence,
                    environmental_summary={
                        "current_speed_mps": env_state.current_speed_mps,
                        "wind_speed_kmh": env_state.wind_speed_kmh,
                        "wave_height_m": env_state.wave_height,
                        "sea_state": env_state.sea_state,
                    }
                )
            )

        # Overall search area & confidence from release to final predicted coordinate
        overall_bearing = calculate_bearing_degrees(release_lat, release_lon, current_lat, current_lon)
        final_uncertainty_km, final_confidence, search_area = uncertainty_engine.compute_uncertainty_and_search_area(
            release_lat=release_lat,
            release_lon=release_lon,
            predicted_lat=current_lat,
            predicted_lon=current_lon,
            displacement_km=cumulative_dist_km,
            drift_direction_deg=overall_bearing,
            duration_hours=total_duration_hours,
            wave_height_m=latest_wave_height,
            wind_speed_mps=latest_wind_speed,
            agreement_modifier=1.0,
            data_age_minutes=0
        )

        latest_point = points[-1]

        return TrajectoryResponse(
            net_id=net_id,
            net_name=net_name,
            net_type=net_type,
            release_time_utc=release_utc,
            expected_retrieval_time_utc=retrieval_utc,
            total_duration_hours=round(total_duration_hours, 2),
            points_count=len(points),
            points=points,
            latest_predicted_point=latest_point,
            search_area=search_area,
            model_version=self.model_version,
            data_sources=list(data_sources) if data_sources else ["COPERNICUS_MARINE", "INCOIS_OSF"],
            forecast_updated_at=datetime.now(timezone.utc)
        )

drift_engine = DeterministicDriftEngine()
