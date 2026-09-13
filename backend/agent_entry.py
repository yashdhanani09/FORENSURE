import sys
import os
import platform
import subprocess
import time

def check_admin():
    if platform.system() == "Windows":
        try:
            import ctypes
            is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
            if not is_admin:
                print("[*] Requesting Administrator privileges for hardware storage access...")
                ctypes.windll.shell32.ShellExecuteW(
                    None, "runas", sys.executable, " ".join([f'\"{arg}\"' for arg in sys.argv]), None, 1
                )
                sys.exit(0)
        except Exception as e:
            print(f"[!] Warning: Could not auto-elevate: {e}")

def main():
    check_admin()
    
    # Set window title on Windows
    if platform.system() == "Windows":
        os.system("title FORENSURE Hardware Bridge - Port 8000")

    print("""
======================================================================
  FORENSURE | VERIFY. SANITIZE. RECOVER.
  Physical Storage Forensic Engine & Bridge v1.0
======================================================================
 [+] Hardware Probe       : ACTIVE (Physical Disk, NVMe, SATA, MTP)
 [+] Local API Endpoint   : http://127.0.0.1:8000
 [+] Raw File Carver      : READY (JPG, PNG, PDF, DOCX, XLSX, ZIP, MP4)
 [+] Status               : LISTENING FOR WEB CLIENTS
----------------------------------------------------------------------
 INSTRUCTIONS:
 1. Keep this terminal open while inspecting physical hardware.
 2. Open the web interface in Chrome or Edge.
 3. The web portal will automatically establish a secure local bridge.
======================================================================
""")

    import uvicorn
    from app.main import app

    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    main()
