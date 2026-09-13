# Development

Use Python 3.11+ and Node 20+. Linux/Ubuntu is required for actual device discovery. macOS and Windows return a capability message unless Demo Mode is enabled.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Run backend tests from `backend/` with `pytest`, and frontend tests from `frontend/` with `npm test`. For a safe presentation, create a root `.env` with `SECUREDATA_DEMO_MODE=true` before starting the backend. File browser tests use a temporary filesystem fixture and do not access any actual USB device.
