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
    import subprocess

    def is_port_in_use(port: int) -> bool:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.6)
                return s.connect_ex(("127.0.0.1", port)) == 0
        except Exception:
            return False

    def kill_process_on_port(port: int):
        if platform.system() == "Windows":
            my_pid = os.getpid()
            try:
                ps_cmd = (
                    f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | "
                    f"Select-Object -ExpandProperty OwningProcess -Unique | "
                    f"Where-Object {{ $_ -gt 4 -and $_ -ne {my_pid} }} | "
                    f"ForEach-Object {{ Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }}"
                )
                subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=4)
            except Exception:
                pass
            try:
                res = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=3)
                for line in res.stdout.splitlines():
                    if f":{port}" in line and "LISTENING" in line:
                        parts = line.strip().split()
                        if parts:
                            pid = parts[-1]
                            if pid.isdigit() and int(pid) > 4 and int(pid) != my_pid:
                                subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
            except Exception:
                pass

    if is_port_in_use(8000):
        # If this instance is running as Administrator, check if the running bridge is non-elevated
        if is_admin:
            already_elevated = False
            try:
                import urllib.request
                import json
                req = urllib.request.Request("http://127.0.0.1:8000/api/recovery/privileges", headers={"User-Agent": "FORENSURE-Bridge"})
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    pdata = json.loads(resp.read().decode())
                    if pdata.get("is_admin", False):
                        already_elevated = True
            except Exception:
                already_elevated = False

            if already_elevated:
                print("[OK] FORENSURE Bridge is already running in elevated Administrator mode on port 8000.")
                time.sleep(2.0)
                return

            print("[*] Detected non-elevated bridge on port 8000. Terminating it to promote to Administrator mode...")
            kill_process_on_port(8000)
            for _ in range(15):
                time.sleep(0.2)
                if not is_port_in_use(8000):
                    break
        else:
            print("[OK] FORENSURE Bridge is already running on port 8000.")
            time.sleep(2.0)
            return

    # ── Start server ─────────────────────────────────────────────
    import uvicorn
    from app.main import app

    try:
        for attempt in range(3):
            try:
                uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
                break
            except OSError as oe:
                if "10048" in str(oe) and attempt < 2:
                    print(f"[*] Port 8000 temporarily busy (TIME_WAIT). Retrying in 1s (attempt {attempt + 1}/3)...")
                    kill_process_on_port(8000)
                    time.sleep(1.0)
                else:
                    raise
            except KeyboardInterrupt:
                print("\n[+] Bridge stopped by user.")
                break
            except SystemExit as se:
                if se.code not in (0, None):
                    print(f"\n[!] Bridge process exited with code {se.code}.")
                break
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
            if sys.stdin and hasattr(sys.stdin, "isatty") and sys.stdin.isatty():
                input("Press Enter to close this window...")
            else:
                time.sleep(3.0)
        except Exception:
            pass

if __name__ == "__main__":
    main()
