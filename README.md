# SecureData — USB Forensics & Secure Sanitization

SecureData is a cross-platform (Linux · macOS · **Windows**) Smart India Hackathon prototype for USB digital forensics and secure sanitization. This repository currently implements **Phases 1–2**: real, read-only discovery of eligible USB drives, mounted-filesystem inventory and file browsing, a FastAPI device API, SQLite/Alembic scaffolding, and a professional React dashboard. Forensics, recovery, evidence acquisition, sanitization, verification, and reporting have deliberately not been exposed yet.

> **Safety status:** Implemented phases have no destructive endpoint and never write to, mount, unmount, or sanitize a device. They accept opaque server-issued device IDs, not raw device paths or shell commands.

## What works now

- Server-side USB detection on **Linux** (`lsblk`), **macOS** (`diskutil`), and **Windows** (PowerShell `Get-Disk`/`Get-Volume`).
- Strict filtering to whole-disk, removable USB storage.
- Device identity, capacity, transport, filesystem, partitions, and mount-point discovery.
- Automatic UI refresh every five seconds, with click-through device inspection.
- Read-only storage capacity analysis for mounted filesystems (cross-platform via `shutil.disk_usage`).
- Metadata-only, paginated directory browsing with search, file/folder filtering, sorting, metadata panel, and mount-bound path validation.
- Explicit capability response on unsupported operating systems.
- Safe, clearly labelled Demo Mode with sample data.
- Typed FastAPI responses, OpenAPI documentation, SQLite models, initial Alembic migration, and audit logging.

## Architecture

See [architecture.md](docs/architecture.md). The key safety rule is simple: the browser cannot authorize a device path. It can only use an opaque ID that the backend resolves afresh from the current device inventory.

## Repository layout

```
securedata/
├── frontend/              React + TypeScript + Vite + Tailwind dashboard
├── backend/               FastAPI, SQLAlchemy, Alembic, SQLite, USB detector
│   └── app/services/adapters/
│       ├── linux/         lsblk-based adapter (Linux)
│       ├── macos/         diskutil-based adapter (macOS)
│       └── windows/       PowerShell/Get-Disk adapter (Windows)  ← new
├── forensic-tools/        Reserved for vetted integrations (next phases)
├── evidence/              Reserved immutable case data (next phases)
├── reports/               Reserved JSON/PDF reports (next phases)
├── logs/                  Runtime audit logs
├── docs/                  Architecture, API, safety, workflows
├── scripts/               Project helpers
│   ├── check-linux-usb.sh
│   └── check-windows-usb.ps1                                      ← new
└── tests/                 Cross-service test documentation
```

## Prerequisites

### Linux

- Ubuntu/Linux with `util-linux` (`lsblk`) for **real** discovery.
- Python 3.11+, Node.js 20+ and npm.
- An unprivileged account that can inspect block-device metadata.

Confirm the detector prerequisite:

```bash
lsblk --version
lsblk --json --bytes --output NAME,PATH,TYPE,TRAN,RM,SIZE,VENDOR,MODEL,SERIAL,FSTYPE,LABEL,UUID,MOUNTPOINTS,RO,PKNAME
```

### macOS

- Python 3.11+, Node.js 20+ and npm.
- `diskutil` (bundled with macOS).

### Windows

- Windows 10 or Windows 11 (PowerShell 5.1+ included — **no extra tools needed**).
- Python 3.11+, Node.js 20+ and npm.
- A standard user account is sufficient for USB enumeration via PowerShell `Get-Disk`.

Confirm the detector prerequisite (PowerShell):

```powershell
Get-Disk | Where-Object { $_.BusType -eq 'USB' } | Select-Object Number, FriendlyName, Size
```

Or use the provided helper script:

```powershell
.\scripts\check-windows-usb.ps1
```

## Install and run (development)

### Linux / macOS

From the project root, configure the desired mode. For **real detection**, use `false`; for a safe SIH presentation, use `true`.

```bash
cp .env.example .env
# Edit .env: SECUREDATA_DEMO_MODE=false for a real USB test
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Windows

```powershell
copy .env.example .env
# Edit .env: SECUREDATA_DEMO_MODE=false for a real USB test
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

In another terminal (all platforms):

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). API reference is at [http://localhost:8000/docs](http://localhost:8000/docs) and [http://localhost:8000/redoc](http://localhost:8000/redoc).

## Tests

```bash
# Linux / macOS
cd backend && source .venv/bin/activate && pytest
# Windows
cd backend && .\.venv\Scripts\Activate.ps1 && pytest

cd frontend && npm test
cd frontend && npm run build
```

The detector parser/API tests use safe fixtures, and the UI uses a mocked API. No test touches a real device.

## Demo Mode

Set `SECUREDATA_DEMO_MODE=true`. The UI displays a labelled SanDisk sample drive and returns predictable filesystem analysis. No demo control performs an actual device operation. This is intended for presentations on any OS when a test USB is not available.

## Real USB test procedure

### Linux

1. Run on Linux with `SECUREDATA_DEMO_MODE=false`.
2. Insert a disposable removable USB flash drive.
3. Verify it appears in the `lsblk` command above as a `disk`, `usb`, and `RM=1`.
4. Open the dashboard and allow one refresh cycle (five seconds).
5. Select **Inspect**, validate vendor/model/serial/capacity, and optionally run the read-only analysis.

If the device is absent, check whether it is removable according to Linux and whether the current user can run `lsblk`. The app intentionally excludes internal/system disks and non-removable USB-attached disks in Phase 1.

### Windows

1. Run with `SECUREDATA_DEMO_MODE=false`.
2. Insert a disposable removable USB flash drive.
3. Verify it appears in PowerShell: `Get-Disk | Where-Object BusType -eq USB`.
4. Open the dashboard and allow one refresh cycle (five seconds).
5. Select **Inspect**, validate vendor/model/serial/capacity, and optionally run the read-only analysis.

## API and security

Read [api.md](docs/api.md) and [security.md](docs/security.md). The automatic FastAPI docs are the source of truth for request/response schemas.

## Later phases

The planned implementation order is hashing and evidence metadata → forensic tooling/recovery → safe sanitization → verification → reports. Each destructive stage will require separate review and an explicit confirmation gate before it is implemented.

## Troubleshooting

- **"USB detection requires Linux (lsblk), macOS (diskutil), or Windows (PowerShell)."** Use a supported OS or enable Demo Mode.
- **No device shown (Linux):** the device may not meet the removable-USB eligibility filter. Inspect `lsblk` output.
- **No device shown (Windows):** run `Get-Disk` in PowerShell. If the disk appears there but not in the app, try running the backend as Administrator.
- **No device shown (macOS):** run `diskutil list` and confirm the drive appears as external.
- **Analysis unavailable:** the drive must be mounted by the OS. On Windows, ensure it has a drive letter (check Disk Management).
- **CORS error:** set `SECUREDATA_CORS_ORIGINS` in `.env` to the frontend origin, separated by commas for multiple origins.
- **Database migration error:** remove only the development `backend/securedata.db` if no data must be retained, then rerun `alembic upgrade head`; never remove evidence or production databases casually.
- **PowerShell execution policy (Windows):** if `.ps1` scripts are blocked, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once in an elevated PowerShell prompt.
