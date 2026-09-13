import sys
import os
import platform
import time

def is_admin():
    """Check if running with administrator privileges."""
    if platform.system() != "Windows":
        return True
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def relaunch_as_admin():
    """Re-launch this exact executable with UAC elevation, then exit the non-elevated copy."""
    import ctypes
    # When frozen by PyInstaller, sys.executable IS the .exe — use it directly.
    exe = sys.executable
    # Pass all original args (skip argv[0] which is the exe path itself)
    args = " ".join(f'"{a}"' for a in sys.argv[1:]) if len(sys.argv) > 1 else ""
    print("[*] Requesting Administrator privileges — please click Yes on the UAC prompt...")
    time.sleep(1)
    # SW_SHOW = 1 so the new elevated window is visible
    ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", exe, args, None, 1)
    if ret <= 32:
        print(f"[!] UAC elevation failed (code {ret}). Please right-click the .exe and choose 'Run as administrator'.")
        input("\nPress Enter to exit...")
    sys.exit(0)

def main():
    # ── Admin check ─────────────────────────────────────────────
    if platform.system() == "Windows" and not is_admin():
        relaunch_as_admin()
        return  # never reached, but keeps linters happy

    # ── Console title ────────────────────────────────────────────
    if platform.system() == "Windows":
        os.system("title FORENSURE Hardware Bridge  ^|  Port 8000")

    # ── Banner ───────────────────────────────────────────────────
    print("""
======================================================================
  FORENSURE  |  VERIFY. SANITIZE. RECOVER.
  Physical Storage Forensic Engine & Bridge  v1.0
======================================================================
 [+] Hardware Probe       : ACTIVE (Physical Disk, NVMe, SATA, MTP)
 [+] Local API Endpoint   : http://127.0.0.1:8000
 [+] Raw File Carver      : READY (JPG, PNG, PDF, DOCX, XLSX, ZIP, MP4)
 [+] Status               : LISTENING FOR WEB CLIENTS
----------------------------------------------------------------------
 HOW TO USE:
  1. Keep THIS WINDOW OPEN the entire time you are inspecting hardware.
  2. Open the FORENSURE web app in Chrome or Edge.
  3. The portal auto-connects — the status bar turns GREEN when live.
  4. To stop: close this window or press Ctrl+C.
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
        print(f"\n[!] FATAL ERROR: {e}")
        print("\n--- Traceback ---")
        import traceback
        traceback.print_exc()
        print("\n-----------------")
        print("[!] The bridge could not start. Common causes:")
        print("    • Port 8000 is already in use (close other apps and retry)")
        print("    • Missing _internal folder next to the .exe (re-extract the zip)")
        print("    • Antivirus blocking the executable (add an exception)")
        print()
        input("Press Enter to close this window...")

if __name__ == "__main__":
    main()
