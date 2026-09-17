import sys
import os
import platform
import time

def check_admin():
    if platform.system() == "Windows":
        try:
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            return False
    return (os.geteuid() == 0) if hasattr(os, "geteuid") else False


def main():
    # ── Console title ────────────────────────────────────────────
    if platform.system() == "Windows":
        os.system("title FORENSURE Hardware Bridge  ^|  Port 8000")

    is_admin = check_admin()
    priv_str = "ELEVATED ADMINISTRATOR (Full Raw Disk Access)" if is_admin else "STANDARD USER (UAC Elevation Available in Web UI)"

    # ── Banner ───────────────────────────────────────────────────
    print(f"""
======================================================================
  FORENSURE  |  VERIFY. SANITIZE. RECOVER.
  Physical Storage Forensic Engine & Bridge  v1.0
======================================================================
 [+] Privilege Level     : {priv_str}
 [+] Hardware Probe       : ACTIVE (USB, NVMe, SATA, MTP)
 [+] Local API Endpoint   : http://127.0.0.1:8000
 [+] Raw File Carver      : READY (NTFS MFT, JPG, PNG, PDF, TXT, DOCX)
 [+] Status               : LISTENING FOR WEB CLIENTS
----------------------------------------------------------------------
 HOW TO USE:
  1. Keep THIS WINDOW OPEN the entire time you are inspecting hardware.
  2. Open the FORENSURE web app in Chrome or Edge.
  3. The portal auto-connects -- the status bar turns GREEN when live.
  4. Use the in-app "Run as Administrator (UAC)" button if raw D: access is needed.
  5. To stop: close this window or press Ctrl+C.
======================================================================
""")

    # ── Start server ─────────────────────────────────────────────
    try:
        import uvicorn
        from app.main import app
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    except SystemExit:
        pass
    except Exception as e:
        print(f"\n[!] ERROR: {e}")
        print("\n--- Details ---")
        import traceback
        traceback.print_exc()
        print("\n---------------")
        print("[!] The bridge could not start. Common causes:")
        print("    • Port 8000 is already in use — close other apps and retry")
        print("    • Missing _internal folder — re-extract the zip file")
        print("    • Antivirus blocking the exe — add an exception and retry")
        print()
        input("Press Enter to close this window...")

if __name__ == "__main__":
    main()
