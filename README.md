# Samudra Kural

Samudra Kural is a modern ocean intelligence and fishermen safety platform.

## Backend Architecture

This repository contains the backend core foundation built with Python and FastAPI.

### Tech Stack
* **Language:** Python 3.13
* **Framework:** FastAPI
* **Configuration:** Pydantic / Pydantic Settings
* **ASGI Server:** Uvicorn
* **Database Layer:** PostgreSQL + PostGIS extension
* **ORM & Driver:** Async SQLAlchemy 2.x + `asyncpg`
* **Migrations:** Alembic
* **Containerization:** Docker & Docker Compose
* **Testing:** Pytest & HTTPX

---

## Phase 2: Database Foundation

In Phase 2, the PostgreSQL database with the PostGIS extension is added to the architecture.

> **Note:** Application domain models (Fisherman, Boat, Net, Weather, Emergency, PFZ) will be introduced in Phase 3. Phase 2 strictly establishes the database layer, session management, and health checks.

---

## Getting Started

### Prerequisites
* Python 3.13+ installed.
* Docker Desktop installed and running.

### 1. Database Setup (Docker)

Start the PostgreSQL + PostGIS container using Docker Compose from the root directory:

```bash
# Start PostgreSQL/PostGIS in background
docker compose up -d

# Check status of container
docker compose ps

# View container logs
docker compose logs -f postgres

# Stop PostgreSQL container
docker compose down
```

### 2. Backend Setup Instructions

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   * **Windows (PowerShell):** `.\.venv\Scripts\Activate.ps1`
   * **Linux/macOS:** `source .venv/bin/activate`

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Environment configuration:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

---

## Running the Application

Start the FastAPI development server:
```bash
uvicorn app.main:app --reload --port 8000
```

### API Endpoints
* **Base Health Check:** `http://127.0.0.1:8000/api/v1/health`
* **Database Health Check:** `http://127.0.0.1:8000/api/v1/health/db`
* **PostGIS Health Check:** `http://127.0.0.1:8000/api/v1/health/postgis`
* **Swagger UI Documentation:** `http://127.0.0.1:8000/docs`
* **ReDoc Documentation:** `http://127.0.0.1:8000/redoc`

---

## Database Migrations (Alembic)

```bash
# Run migrations
alembic upgrade head
```

---

## Running Tests

Execute the automated test suite using `pytest`:
```bash
pytest
```
