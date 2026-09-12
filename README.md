# Samudra Kural

Samudra Kural is a modern ocean intelligence and fishermen safety platform. This repository contains the complete core backend foundation (Phases 1–5).

---

## Mobile GPS Architecture & Navigation Service

The backend navigation service is built around the following architecture:

```
Mobile GPS/GNSS Hardware
        ↓
latitude + longitude (obtained on device)
        ↓
FastAPI Backend (/api/v1/navigation)
        ↓
PostGIS & Navigation Service
        ↓
distance_meters / bearing_degrees / cardinal direction
        ↓
Mobile UI Presentation
```

### Key Navigation Principles
- **No External Mapping Dependencies**: Calculations are performed locally using PostGIS spatial functions and geographic formulas (Haversine & initial bearing). No Google Maps, Mapbox, or external routing APIs are required.
- **GPS Independence**: Obtaining GPS coordinates on the mobile device requires no cellular data or internet connection. Sending coordinates to backend endpoints requires a network connection.
- **Offline-First Preparation**: Response payloads include exact target coordinates (`shore` and `saved location`), enabling the mobile app to cache coordinates and perform basic offline navigation when disconnected.

---

## Tech Stack

- **Language:** Python 3.13
- **Framework:** FastAPI
- **Security & Authentication:** PyJWT, pwdlib (Argon2), bcrypt
- **Configuration:** Pydantic / Pydantic Settings
- **ASGI Server:** Uvicorn
- **Database Layer:** PostgreSQL 18 + PostGIS extension
- **ORM & Geospatial:** Async SQLAlchemy 2.x + `asyncpg` + `GeoAlchemy2`
- **Migrations:** Alembic
- **Testing:** Pytest & HTTPX

---

## API Classification & Classification Matrix

### PUBLIC ENDPOINTS (No Authentication Required)
- `GET /api/v1/health`: API service health check
- `GET /api/v1/health/db`: PostgreSQL database connectivity check
- `GET /api/v1/health/postgis`: PostGIS extension status check
- `POST /api/v1/auth/register`: Fisherman account registration
- `POST /api/v1/auth/login`: Fisherman authentication (returns JWT access token)

### AUTHENTICATED ENDPOINTS (Requires `Authorization: Bearer <access_token>`)
- **Fisherman Profile**:
  - `GET /api/v1/auth/me`: Get profile of authenticated fisherman
  - `GET /api/v1/fishermen/{id}`: Get fisherman profile by ID (Ownership enforced: `id` must match token)
- **Boats**:
  - `POST /api/v1/boats`: Register a new boat (Assigned to authenticated fisherman)
  - `GET /api/v1/boats/{id}`: Get boat by ID (Ownership enforced)
  - `GET /api/v1/fishermen/{id}/boat`: Get boat owned by fisherman (Ownership enforced)
- **Fishing Locations**:
  - `POST /api/v1/locations`: Save a new fishing location (Assigned to authenticated fisherman)
  - `GET /api/v1/locations/{id}`: Get location by ID (Ownership enforced)
  - `DELETE /api/v1/locations/{id}`: Delete a saved location (Ownership enforced)
  - `GET /api/v1/locations/nearby`: Query authenticated fisherman's nearby locations via PostGIS
  - `GET /api/v1/fishermen/{id}/locations`: List all saved locations for fisherman (Ownership enforced)
- **GPS Navigation**:
  - `GET /api/v1/navigation/to-shore`: Calculate distance, bearing, and direction to shore
  - `GET /api/v1/navigation/to-location/{location_id}`: Navigate to a saved fishing location (Ownership enforced)
  - `GET /api/v1/navigation/nearest-location`: Find nearest saved fishing location within radius via PostGIS
  - `GET /api/v1/navigation/status`: Get basic navigation facts relative to shore

---

## Frontend Handoff API Contract

| Endpoint | Method | Auth | Query Parameters | Request Body | Response Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/health` | GET | Public | None | None | `{"status": "ok"}` | 200 |
| `/api/v1/health/db` | GET | Public | None | None | `{"status": "ok", "database": "connected"}` | 200, 500 |
| `/api/v1/health/postgis` | GET | Public | None | None | `{"status": "ok", "postgis_version": "..."}` | 200, 500 |
| `/api/v1/auth/register` | POST | Public | None | `FishermanRegister` | `FishermanResponse` | 201, 409, 422 |
| `/api/v1/auth/login` | POST | Public | None | `FishermanLogin` | `TokenResponse` | 200, 401, 422 |
| `/api/v1/auth/me` | GET | Bearer | None | None | `FishermanResponse` | 200, 401 |
| `/api/v1/fishermen/{id}` | GET | Bearer | None | None | `FishermanResponse` | 200, 401, 403, 404 |
| `/api/v1/fishermen/{id}/boat` | GET | Bearer | None | None | `BoatResponse` | 200, 401, 403, 404 |
| `/api/v1/fishermen/{id}/locations` | GET | Bearer | None | None | `List[FishingLocationResponse]` | 200, 401, 403 |
| `/api/v1/boats` | POST | Bearer | None | `BoatCreate` | `BoatResponse` | 201, 401, 422 |
| `/api/v1/boats/{id}` | GET | Bearer | None | None | `BoatResponse` | 200, 401, 403, 404 |
| `/api/v1/locations` | POST | Bearer | None | `FishingLocationCreate` | `FishingLocationResponse` | 201, 401, 422 |
| `/api/v1/locations/{id}` | GET | Bearer | None | None | `FishingLocationResponse` | 200, 401, 403, 404 |
| `/api/v1/locations/{id}` | DELETE | Bearer | None | None | None (204) | 204, 401, 403, 404 |
| `/api/v1/locations/nearby` | GET | Bearer | `latitude`, `longitude`, `radius_meters` | None | `List[NearbyLocationResponse]` | 200, 401, 422 |
| `/api/v1/navigation/to-shore` | GET | Bearer | `latitude`, `longitude` | None | `ShoreNavigationResponse` | 200, 401, 404, 422 |
| `/api/v1/navigation/to-location/{id}` | GET | Bearer | `latitude`, `longitude` | None | `LocationNavigationResponse` | 200, 401, 403, 404, 422 |
| `/api/v1/navigation/nearest-location` | GET | Bearer | `latitude`, `longitude`, `radius_meters` | None | `LocationNavigationResponse` | 200, 401, 404, 422 |
| `/api/v1/navigation/status` | GET | Bearer | `latitude`, `longitude` | None | `NavigationStatusResponse` | 200, 401, 404, 422 |

---

## Example Navigation Requests & Responses

### 1. Navigation to Shore
`GET /api/v1/navigation/to-shore?latitude=13.0827&longitude=80.3707`
**Response (200 OK):**
```json
{
  "target": "shore",
  "current_location": {
    "latitude": 13.0827,
    "longitude": 80.3707
  },
  "target_location": {
    "latitude": 13.0827,
    "longitude": 80.2707
  },
  "distance_meters": 10834.12,
  "bearing_degrees": 270.0,
  "direction": "W"
}
```

### 2. Nearest Saved Fishing Location
`GET /api/v1/navigation/nearest-location?latitude=13.0000&longitude=80.3000&radius_meters=10000`
**Response (200 OK):**
```json
{
  "target": {
    "id": 1,
    "name": "Nearest Spot (2km)"
  },
  "current_location": {
    "latitude": 13.0,
    "longitude": 80.3
  },
  "target_location": {
    "latitude": 13.02,
    "longitude": 80.3
  },
  "distance_meters": 2218.45,
  "bearing_degrees": 0.0,
  "direction": "N"
}
```

---

## Developer Setup Instructions

### 1. Start PostgreSQL & PostGIS Extension
From project root:
```bash
wsl -u root -- bash -c "service postgresql start"
```

### 2. Run Database Migrations
```bash
cd backend
.venv\Scripts\alembic upgrade head
```

### 3. Start Backend Server
```bash
cd backend
.venv\Scripts\uvicorn app.main:app --reload --port 8000
```
Swagger UI available at `http://localhost:8000/docs`.

### 4. Run Test Suite
```bash
cd backend
.venv\Scripts\pytest -v
```
