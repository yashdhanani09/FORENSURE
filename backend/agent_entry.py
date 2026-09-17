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

    # ── Check if port 8000 is already running ───────────────────
    import socket
    def is_port_in_use(port: int) -> bool:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.8)
                return s.connect_ex(("127.0.0.1", port)) == 0
        except Exception:
            return False

    if is_port_in_use(8000):
        # If this instance is running as Administrator, check if the running bridge is non-elevated
        if is_admin:
            try:
                import urllib.request
                import json
                req = urllib.request.Request("http://127.0.0.1:8000/api/recovery/privileges", headers={"User-Agent": "FORENSURE-Bridge"})
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    pdata = json.loads(resp.read().decode())
                    if not pdata.get("is_admin", False):
                        print("[*] Detected non-elevated bridge on port 8000. Terminating it to promote to Administrator mode...")
                        os.system("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %a >nul 2>&1")
                        time.sleep(1.2)
            except Exception:
                pass

    # Re-check port 8000 after potential takeover
    if is_port_in_use(8000):
        print("""
======================================================================
  [OK] FORENSURE BRIDGE IS ALREADY RUNNING & ACTIVE!
======================================================================
  Port 8000 is currently active and listening for web connections.
  The bridge is ALREADY live and ready for your web application!

  Next Steps:
   1. Open the FORENSURE web application in your browser:
      http://localhost:5174  (or https://forensure.vercel.app)
   2. The status bar will show GREEN:
      [PHYSICAL HARDWARE BRIDGE CONNECTED (PORT 8000)]
   3. To restart or replace the bridge, close the other terminal window
      or run RUN-AS-ADMIN.bat.
======================================================================
""")
        try:
            input("Press Enter to close this notification window...")
        except Exception:
            pass
        return

    # ── Start server ─────────────────────────────────────────────
    try:
        import uvicorn
        from app.main import app
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    except KeyboardInterrupt:
        print("\n[+] Bridge stopped by user.")
    except SystemExit as se:
        if se.code not in (0, None):
            print(f"\n[!] Bridge process exited with code {se.code}.")
            print("[!] If port 8000 was already in use, the bridge is already running in another window.")
            try:
                input("\nPress Enter to close this window...")
            except Exception:
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
        try:
            input("Press Enter to close this window...")
        except Exception:
            pass

if __name__ == "__main__":
    main()
