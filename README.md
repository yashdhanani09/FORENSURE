# FORENSURE — Physical Storage Forensics & Secure Sanitization Suite

<p align="center">
  <img src="frontend/public/vite.svg" alt="FORENSURE Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>Enterprise-Grade Digital Forensics, Physical Sector Data Recovery, Bit-Stream Evidence Acquisition, and Cryptographic NIST SP 800-88 Rev. 1 / DoD 5220.22-M Sanitization Platform.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS%20%7C%20Android%20MTP-blue?style=flat-square" alt="Platform Support" />
  <img src="https://img.shields.io/badge/Compliance-ISO%2FIEC%2027037%20%7C%20NIST%20SP%20800--88%20Rev.1%20%7C%20DoD%205220.22--M-success?style=flat-square" alt="Forensic Standards" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11%2B%20%7C%20Win32%20API-teal?style=flat-square" alt="Backend" />
  <img src="https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Tailwind-indigo?style=flat-square" alt="Frontend" />
  <img src="https://img.shields.io/badge/Tests-26%20Passed%20(Pytest%20%2B%20Vitest)-brightgreen?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-gray?style=flat-square" alt="License" />
</p>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Core Features & Modules](#-core-features--modules)
  - [1. Real-Time Hardware Discovery & Profiling](#1-real-time-hardware-discovery--profiling)
  - [2. Universal Forensic Recovery Pipeline](#2-universal-forensic-recovery-pipeline)
  - [3. Standards-Compliant Data Sanitization Engine](#3-standards-compliant-data-sanitization-engine)
  - [4. ISO/IEC 27037 Evidence Acquisition & Forensics](#4-isoiec-27037-evidence-acquisition--forensics)
  - [5. Native Hardware Bridge & UAC Elevation](#5-native-hardware-bridge--uac-elevation)
  - [6. Interactive Hardware Guide Wizard](#6-interactive-hardware-guide-wizard)
- [Repository Structure](#-repository-structure)
- [Installation & Quick Start](#-installation--quick-start)
  - [Option A: One-Click Full Suite (Windows)](#option-a-one-click-full-suite-windows-recommended)
  - [Option B: Elevated Administrator Bridge (Windows)](#option-b-elevated-administrator-bridge-windows)
  - [Option C: Manual Developer Setup (Windows / Linux / macOS)](#option-c-manual-developer-setup-windows--linux--macos)
- [REST API Reference](#-rest-api-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Forensic Standards & Regulatory Compliance](#-forensic-standards--regulatory-compliance)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [License & Authors](#-license--authors)

---

## 🔬 Overview

**FORENSURE** (SecureData) is a unified, cross-platform digital forensics, physical sector file carving, and secure sanitization platform engineered for law enforcement investigators, cyber forensic analysts, and enterprise incident response teams.

Traditional forensic suites either require expensive proprietary hardware dongles or lack modern web-native operational dashboards. Conversely, web applications cannot interact directly with raw physical disk sectors or issue kernel-level disk commands due to browser sandbox constraints. 

**FORENSURE solves this challenge** by introducing a high-performance **Local Hardware Bridge Architecture** on `http://127.0.0.1:8000` with **Private Network Access (PNA)** and automated **Windows UAC (User Account Control) Elevation**. The web console communicates with the bridge via strict, opaque device identities to execute low-level physical sector reads (`\\.\PhysicalDriveX`, `\\.\D:`), unallocated NTFS Master File Table (`$MFT`) record carving, bit-stream RAW/DD evidence acquisition, and multi-pass cryptographic disk sanitization.

### Core Tenets:
1. **Never Trust Raw Paths**: The web interface never transmits raw kernel device paths or arbitrary shell commands. All operations target opaque, cryptographically verifiable IDs resolved server-side.
2. **Strict System Disk Protection**: Multi-layered safeguards prevent accidental destructive operations on host operating system partitions (`C:\`, kernel boot volumes, EFI partitions).
3. **Chain of Custody Assurance**: Dual-pass cryptographic hashing (MD5, SHA-256, SHA-512) and ISO/IEC 27037 compliance ensure every byte recovered or acquired is legally defensible in court.

---

## 🏛 System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FORENSURE Web Console (Client SPA)                   │
│          React 18 · TypeScript · Vite · Tailwind CSS · Recharts        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / Private Network Access (PNA)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             FORENSURE Local Hardware Bridge (FastAPI / Win32)          │
│                Listening on http://127.0.0.1:8000                      │
├───────────────────────────────────┬────────────────────────────────────┤
│  • Automated UAC RunAs Elevation │  • Port 8000 Collision Takeover    │
│  • Opaque Device ID Resolution    │  • Audit Logging & Session Caches  │
└─────────┬─────────────────────────┴────────────┬───────────────────────┘
          │                                      │
          ▼ Direct Win32 / Kernel API             ▼ Cross-Platform CLI
┌───────────────────────────────────┐  ┌─────────────────────────────────┐
│     Windows Kernel Subsystem      │  │ Linux / macOS / Android Subsys │
│  • CreateFileW (FILE_SHARE_READ)  │  │  • Linux: lsblk / dd / hdparm   │
│  • Raw Sector Reader (\\.\D:)     │  │  • macOS: diskutil / dd         │
│  • NTFS $MFT Unallocated Parser   │  │  • Android: MTP / ADB Scoped    │
│  • Win32 SID Recycle Bin Scanner  │  │  • Hashers: SHA256 / SHA512/MD5 │
└───────────────────────────────────┘  └─────────────────────────────────┘
```

---

## ⚡ Core Features & Modules

### 1. Real-Time Hardware Discovery & Profiling
- **Universal Storage Support**: Automatic detection and real-time polling (5-second intervals) of:
  - **Removable Media**: USB Flash Drives, External HDDs/SSDs, SD Cards.
  - **Internal Fixed Storage**: NVMe PCIe SSDs, SATA HDDs/SSDs, host volumes (`C:\`, `D:\`).
  - **Mobile Devices**: Android smartphones and tablets connected via MTP (Media Transfer Protocol).
- **Deep Hardware Profiling**: Vendor name, model string, serial number, bus interface (USB, NVMe, SATA, SCSI), total byte capacity, partition table type (GPT / MBR), partition boundaries, and mount points.
- **Read-Only Filesystem Analysis**: Safe capacity calculation, filesystem type identification (NTFS, FAT32, exFAT, ext4, APFS), and directory browsing bound strictly inside volume boundaries to prevent directory traversal exploits.

### 2. Universal Forensic Recovery Pipeline
- **NTFS Master File Table ($MFT) Carving**:
  - Automatically locates the volume `$MFT` base cluster from the NTFS Volume Boot Record (VBR).
  - Inspects unallocated MFT records (`0x454C4946` / `FILE` magic signature).
  - Decodes resident and non-resident `$FILE_NAME` and `$DATA` attributes to recover file records emptied from the Recycle Bin.
- **Physical Sector Raw Carver**:
  - Direct Win32 sector reading (`CreateFileW` with `FILE_SHARE_READ | FILE_SHARE_WRITE`) that bypasses Windows file system locks on active drives (`\\.\D:`).
  - Deep magic byte signature and footer detection for:
    - **Images**: JPEG (`FF D8 FF` ... `FF D9`), PNG (`89 50 4E 47` ... `49 45 4E 44`).
    - **Documents**: PDF (`%PDF-` ... `%%EOF`), Office Open XML (`PK\x03\x04` DOCX, XLSX).
    - **Archives & Media**: ZIP, MP4 / QuickTime (`ftyp` atom).
    - **Plain-Text Documents**: UTF-8 and ASCII text document recovery with entropy heuristics.
- **Windows Recycle Bin Forensic Parser**:
  - Recursively navigates `$Recycle.Bin` across all storage drives.
  - Resolves Windows User Security Identifiers (SIDs).
  - Parses `$I` index metadata headers (original deletion timestamp, absolute file path, byte size) and reconstructs files from `$R` data payloads.
- **Mobile / Android MTP Forensic Recovery**:
  - Scans Android file trees for scoped `.trashed-*` items.
  - Carves cache directories, `DCIM/.thumbnails`, WhatsApp media directories, and temporary database stores.
- **Forensic Confidence Scoring**: Every recovered artifact receives an automated score (0–100%) and confidence tier (**HIGH**, **MEDIUM**, **LOW**) based on signature integrity, EOF verification, and header validity.
- **Instant Preview & Direct Binary Streaming**: Stream recovered binary files directly to the analyst's workstation with proper MIME-types and RFC 6266 `Content-Disposition` attachment headers.
- **ISO/IEC 27037 Recovery Examination Report**: Export comprehensive PDF/JSON reports including investigator details, device profile, acquisition hash, and itemized file manifests.

### 3. Standards-Compliant Data Sanitization Engine
- **Cryptographic & Physical Sanitization Algorithms**:
  - **Zero Fill (Single Pass)**: Overwrites all sectors with `0x00` (NIST SP 800-88 Rev. 1 Clear).
  - **Random Overwrite**: Fills all addressable storage blocks with cryptographically secure pseudo-random bytes.
  - **DoD 5220.22-M (3-Pass)**:
    - Pass 1: Fixed binary zeros (`0x00`).
    - Pass 2: Fixed binary complement ones (`0xFF`).
    - Pass 3: Cryptographically random byte sequence followed by bit-level verification.
  - **Gutmann Method (35-Pass)**: Magnetic media legacy overwrite algorithm for specialized media.
- **Fail-Safe Security Barriers**:
  - **Host System Disk Lock**: Hard-coded blocking of system drive letters (`C:\`), boot partitions, and EFI system volumes to prevent bricking the host operating system.
  - **Dual-Confirmation Safety Gating**: Destructive wiping requires entering an explicit confirmation phrase matching the target device vendor and model.
  - **Orchestrated Volume Unmounting**: Dismounts and locks filesystem handles prior to zeroing sector blocks.
- **Post-Wipe Verification & Entropy Analysis**:
  - Multi-point sector sampling across beginning, middle, and end of the storage media.
  - Shannon Entropy calculation ($H \approx 0.0$ for Zero Fill; $H \approx 8.0$ for Random Overwrite) to mathematically prove elimination of residual data.
- **Certificate of Sanitization**: Generates an audit-ready, tamper-evident digital certificate with execution duration, algorithm used, serial number, technician name, and cryptographic verification hash.

### 4. ISO/IEC 27037 Evidence Acquisition & Forensics
- **Forensic Case Management**: Create structured investigation cases with Case ID, Lead Examiner, Agency, and Description.
- **Bit-Stream Disk Acquisition**: Bit-for-bit raw image generation (RAW/DD format) from physical devices or logical volumes.
- **Dual-Pass Integrity Hashing**: Real-time streaming hash calculation (MD5, SHA-256, SHA-512) computed before and verified after acquisition to guarantee legal evidence integrity.
- **Chain of Custody Tracking**: Chronological, immutable logging of all evidence interactions, custodians, timestamps, and physical storage locations.

### 5. Native Hardware Bridge & UAC Elevation
- **Zero-Dependency Portable Bridge**: Pre-packaged standalone binary ([FORENSURE-Bridge-Windows.zip](frontend/public/FORENSURE-Bridge-Windows.zip)) built with PyInstaller for Windows machines without Python installed.
- **One-Click In-App UAC Elevation**:
  - If FORENSURE is started under a standard user account, Windows kernel blocks raw sector reads (`\\.\D:`).
  - Clicking **"Grant Administrator Access (UAC)"** in the web UI triggers a native Windows privilege escalation prompt via PowerShell / ShellExecute `runas`.
  - Automatically frees port 8000 if occupied by the non-elevated bridge and restarts the service in elevated mode.
- **Private Network Access (PNA) Compliance**: Emits `Access-Control-Allow-Private-Network: true` headers to support modern Chromium Private Network Access security requirements when web apps hosted on external domains communicate with `localhost:8000`.

### 6. Interactive Hardware Guide Wizard
- Built-in visual wizard accessible at `/agent-guide` with step-by-step guidance for connecting physical devices, extracting the bridge, and verifying administrator status.

---

## 📂 Repository Structure

```
d:\SIH/
├── START.bat                            # Master 1-click launcher (Backend + Frontend + Browser)
├── RUN-AS-ADMIN.bat                     # Elevated UAC launcher for Hardware Bridge
├── FORENSURE-Bridge-Windows.zip         # Pre-compiled standalone Windows Bridge package
│
├── backend/                             # FastAPI Forensic & Sanitization Engine
│   ├── agent_entry.py                   # Standalone Bridge entry point with port-takeover
│   ├── START-BRIDGE.bat                 # Launches Hardware Bridge
│   ├── RUN-AS-ADMIN.bat                 # Elevated bridge launcher
│   ├── requirements.txt                 # Python dependencies
│   ├── pytest.ini                       # Test configuration
│   ├── securedata.db                    # SQLite forensic database
│   │
│   ├── app/
│   │   ├── main.py                      # FastAPI app entry & CORS/PNA configuration
│   │   ├── api/                         # REST API Route Controllers
│   │   │   ├── devices.py               # Device enumeration & file browsing
│   │   │   ├── forensics.py             # Case management & bit-stream acquisition
│   │   │   ├── recovery.py              # Deleted file scanning, MFT carving & restore
│   │   │   ├── sanitization.py          # NIST/DoD sanitization & verification
│   │   │   └── system.py                # Health & platform capabilities
│   │   ├── core/                        # Configuration, logging & admin verification
│   │   ├── database/                    # SQLAlchemy models & database initialization
│   │   ├── models/                      # Forensic case, evidence, recovery & sanitization models
│   │   ├── schemas/                     # Pydantic request/response validation schemas
│   │   └── services/                    # Core Forensic Services
│   │       ├── recovery_service.py      # Unified full-spectrum recovery coordinator
│   │       ├── file_carver.py           # Multi-signature raw sector carving engine
│   │       ├── ntfs_mft_parser.py       # NTFS $MFT unallocated record parser
│   │       ├── mobile_recovery.py       # Android/MTP scoped recovery engine
│   │       ├── fat_recovery.py          # FAT12/16/32 directory entry parser
│   │       ├── sanitization_engine.py   # Multi-pass disk overwrite engine
│   │       ├── sanitization_verifier.py # Shannon entropy & sector verification
│   │       ├── sanitization_certificate.py # Certificate generation
│   │       ├── storage_scanner.py       # Storage scanner orchestrator
│   │       ├── hasher.py                # MD5 / SHA-256 / SHA-512 streaming hashers
│   │       └── adapters/                # OS-specific hardware adapters
│   │           ├── windows/             # Win32 / PowerShell / WMIC storage adapters
│   │           ├── linux/               # lsblk / util-linux storage adapters
│   │           └── macos/               # diskutil storage adapters
│   │
│   ├── evidence/                        # Local forensic evidence & recovered files vault
│   │   └── recovered/                   # Output folder for restored carved files
│   └── tests/                           # Pytest test suite (27 unit & integration tests)
│
├── frontend/                            # React 18 Web Console
│   ├── src/
│   │   ├── App.tsx                      # Root routes & cybernetic ambient theme
│   │   ├── pages/                       # Application Views
│   │   │   ├── LandingPortal.tsx        # Flagship landing page
│   │   │   ├── Dashboard.tsx            # Operations console & forensic metrics
│   │   │   ├── Devices.tsx              # Real-time hardware inspector
│   │   │   ├── DeviceDetails.tsx        # Device filesystem explorer & health
│   │   │   ├── Forensics.tsx            # Case management & disk acquisition
│   │   │   ├── CaseDetail.tsx           # Case timeline & chain of custody
│   │   │   ├── Recovery.tsx             # Universal Forensic Recovery Console
│   │   │   ├── Sanitization.tsx         # NIST/DoD Data Sanitization Console
│   │   │   └── AgentGuide.tsx           # Step-by-step Hardware Guide Wizard
│   │   ├── components/                  # Reusable UI widgets & AgentStatusBar
│   │   ├── services/                    # Axios API client integrations
│   │   └── types/                       # TypeScript interfaces & enums
│   ├── public/
│   │   └── FORENSURE-Bridge-Windows.zip # Downloadable Bridge bundle
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                                # Technical & Architectural Documentation
└── logs/                                # System & API audit logs
```

---

## 🚀 Installation & Quick Start

### Option A: One-Click Full Suite (Windows — Recommended)

The fastest way to start both the Frontend and the Backend Bridge on Windows:

1. Double-click `START.bat` in the repository root.
2. The script will:
   - Self-elevate to Administrator (prompting UAC).
   - Start the FastAPI backend on `http://127.0.0.1:8000`.
   - Start the Vite frontend server on `http://localhost:5174` (or `5173`).
   - Automatically launch your default browser to the FORENSURE console.

---

### Option B: Elevated Administrator Bridge (Windows)

If you are running the frontend on the web (e.g. Vercel) or want to run the bridge independently:

1. Right-click `RUN-AS-ADMIN.bat` and select **"Run as administrator"**.
2. Alternatively, open PowerShell as Administrator and run:
   ```powershell
   powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/k cd /d D:\SIH && RUN-AS-ADMIN.bat' -Verb RunAs"
   ```
3. The bridge will free port 8000 from any non-elevated instances and listen on `http://127.0.0.1:8000` with full raw disk access.

---

### Option C: Manual Developer Setup (Windows / Linux / macOS)

#### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/yashdhanani09/FORENSURE.git
cd FORENSURE/backend

# Create and activate virtual environment
# Windows:
python -m venv .wvenv
.wvenv\Scripts\activate

# Linux / macOS:
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI engine
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Frontend Setup
In a second terminal:
```bash
cd FORENSURE/frontend

# Install node dependencies
npm install

# Start Vite dev server
npm run dev
```

Open your browser at `http://localhost:5173` (or `http://localhost:5174`).

---

## 📡 REST API Reference

The backend provides interactive OpenAPI documentation at:
- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

### API Group Overview

| Method | Endpoint | Description |
|---|---|---|
| **GET** | `/api/devices` | Lists all detected storage devices (USB, NVMe, SATA, MTP) |
| **GET** | `/api/devices/{id}` | Returns hardware profiles, partition layout, and mount points |
| **POST** | `/api/devices/{id}/analyze` | Analyzes filesystem capacity, block size, and read-only integrity |
| **GET** | `/api/devices/{id}/files` | Explores mounted filesystem directories securely |
| **POST** | `/api/devices/{id}/hash` | Calculates SHA-256 hash of a file on a mounted volume |
| **POST** | `/api/recovery/scan` | Initiates Full-Spectrum scan (NTFS MFT, Sector Carver, Recycle Bin, Mobile) |
| **POST** | `/api/recovery/restore` | Extracts and recovers selected deleted files to evidence storage |
| **GET** | `/api/recovery/recovered` | Returns list of all historically recovered files with SHA-256 hashes |
| **GET** | `/api/recovery/download/{filename}` | Streams binary payload of a recovered file directly to client |
| **GET** | `/api/recovery/report` | Generates ISO/IEC 27037 Forensic Recovery Examination Report |
| **GET** | `/api/recovery/privileges` | Checks whether backend is elevated with raw sector access (`\\.\D:`) |
| **POST** | `/api/recovery/elevate` | Triggers native Windows UAC RunAs prompt to elevate backend |
| **POST** | `/api/sanitization/validate` | Validates target eligibility and verifies it is not a system disk |
| **POST** | `/api/sanitization/execute` | Executes NIST SP 800-88 / DoD 5220.22-M sanitization with safety lock |
| **GET** | `/api/sanitization/status/{job_id}` | Polls real-time progress, speed, pass count, and active pattern |
| **POST** | `/api/sanitization/verify` | Performs post-wipe Shannon entropy and byte sampling verification |
| **GET** | `/api/sanitization/certificate/{job_id}` | Generates cryptographic Certificate of Sanitization |
| **GET** | `/api/forensics/cases` | Lists all forensic cases and evidence items |
| **POST** | `/api/forensics/cases` | Creates a new formal forensic investigation case |
| **POST** | `/api/forensics/acquire` | Starts bit-stream disk image acquisition (RAW/DD format) with dual-pass hashing |
| **GET** | `/health` | System health check and bridge availability |

---

## 🧪 Testing & Quality Assurance

FORENSURE includes a comprehensive test suite covering device adapters, file carvers, NTFS MFT parsing, mobile forensics, and sanitization engines.

### Running Backend Unit & Integration Tests (Pytest)
```bash
cd backend
# Windows:
.wvenv\Scripts\pytest.exe tests/ -v

# Linux / macOS:
pytest tests/ -v
```
*Current test suite: **26 passed, 1 skipped, 0 failed**.*

### Running Frontend Tests (Vitest)
```bash
cd frontend
npm test -- --run
```

### Production Build Verification
```bash
cd frontend
npm run build
```
*Ensures TypeScript types pass validation and compiles assets cleanly into `frontend/dist`.*

---

## 📜 Forensic Standards & Regulatory Compliance

| Standard | Organization | Scope within FORENSURE |
|---|---|---|
| **ISO/IEC 27037:2012** | International Organization for Standardization | Digital evidence handling, identification, collection, acquisition, and preservation of digital evidence with cryptographic chain-of-custody logging. |
| **NIST SP 800-88 Rev. 1** | National Institute of Standards and Technology | Guidelines for Media Sanitization. Implements **Clear** (logical technique overwrite) and **Purge** (cryptographic pseudo-random overwrite). |
| **DoD 5220.22-M** | National Industrial Security Program (NISP) | 3-Pass overwrite specification (Zeros, Ones, Pseudo-random sequence with read verification). |
| **RFC 6266 / RFC 2183** | Internet Engineering Task Force (IETF) | Standardized Content-Disposition headers for direct streaming forensic evidence downloads. |
| **W3C Private Network Access** | World Wide Web Consortium | Secure cross-origin communication between public cloud web apps and local loopback (`127.0.0.1`) hardware bridges. |

---

## ❓ Troubleshooting & FAQ

#### 1. Why does Drive D: show "Administrator Privileges Required"?
Windows kernel blocks non-privileged user processes from opening direct handles to physical storage volumes (`\\.\PhysicalDriveX` or `\\.\D:`). To scan unallocated sectors for deleted files, click **"Grant Administrator Access (UAC)"** in the Recovery console or run `RUN-AS-ADMIN.bat`.

#### 2. What happens if port 8000 is already in use?
The bridge includes an intelligent port takeover mechanism. When you run `RUN-AS-ADMIN.bat`, it checks whether the running process on port 8000 is an unprivileged bridge; if so, it terminates it and promotes itself to Administrator without requiring manual task manager intervention.

#### 3. Can FORENSURE accidentally wipe my Windows C: drive?
**No.** FORENSURE includes multiple hard-coded safety barriers in `system_disk_detector.py` and `device_safety.py`. Any device marked as `is_system_disk: True` or mounted to the system root (`C:\`, `/`, `/boot`) is rejected immediately by the sanitization engine. Furthermore, destructive operations require typing an exact case-sensitive confirmation phrase.

#### 4. Can I use FORENSURE with Android devices?
**Yes.** Connect your Android device via USB and set the connection mode to **File Transfer (MTP)**. FORENSURE detects the device and enables scoped mobile recovery across `.trashed`, cache, and media directories.

---

## 👥 License & Authors

- **Developed for**: Smart India Hackathon (SIH) — Digital Forensics & Storage Security.
- **Repository**: [https://github.com/yashdhanani09/FORENSURE](https://github.com/yashdhanani09/FORENSURE)
- **Author**: Yash Dhanani ([@yashdhanani09](https://github.com/yashdhanani09))
- **License**: MIT License — open for academic, forensic, and security research use.
