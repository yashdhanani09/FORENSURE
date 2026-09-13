# SecureData Forensics — Setup Guide for New Machine

## Prerequisites
- Windows 10 or Windows 11
- Python 3.11 or higher → https://www.python.org/downloads/
- Node.js 20 or higher → https://nodejs.org/
- Git (optional) if you cloned the repo

---

## ⚠️ CRITICAL — Run as Administrator

> The backend uses PowerShell to detect physical storage devices.
> PowerShell's Get-Disk / Get-Partition commands require elevated privileges.
> **You MUST open your terminal as Administrator**, otherwise no devices will appear.

**How to open PowerShell as Administrator:**
1. Press Win key → type "PowerShell"
2. Right-click → "Run as Administrator"
3. Click "Yes" on the UAC prompt

---

## Step 1 — Backend Setup (Run as Administrator)

`powershell
cd SIH\backend

# Create Python virtual environment
python -m venv .wvenv

# Activate it
.\.wvenv\Scripts\activate

# Install all dependencies
pip install -r requirements.txt

# Run database migrations
python -m alembic upgrade head

# Start the backend server
.\.wvenv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
`

The backend should print:
  INFO: Application startup complete.
  INFO: Uvicorn running on http://127.0.0.1:8000

---

## Step 2 — Frontend Setup (New terminal window)

`powershell
cd SIH\frontend

# Install Node packages
npm install

# Start the frontend dev server
npm run dev
`

The frontend should print:
  Local:   http://localhost:5174/

---

## Step 3 — Open the App

Open your browser and go to: http://localhost:5174

---

## Troubleshooting

### "No devices detected"
- Make sure the backend terminal was opened as Administrator (Step 1 above)
- Try clicking the "Refresh" button in the app

### "Cannot connect to backend"
- Make sure both the backend (port 8000) AND frontend (port 5174) are running
- Check that no firewall is blocking localhost ports

### "Amazon device / unknown device showing"
- This was a known bug (fixed in this version)
- The app now only shows real smartphones/tablets, not Kindle or Echo devices

### "pip install fails"
- Make sure Python is installed and added to PATH
- Run: python --version (should show 3.11+)
- Try: pip install --upgrade pip first

### "npm install fails"
- Make sure Node.js is installed
- Run: node --version (should show v20+)
