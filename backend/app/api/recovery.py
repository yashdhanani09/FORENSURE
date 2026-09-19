import os
import logging
import mimetypes
import urllib.parse
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response

from app.core.config import BACKEND_ROOT, PROJECT_ROOT

from app.schemas.recovery import (
    RecoveryScanRequest,
    RecoveryScanResponse,
    RestoreFileRequest,
    RestoreFileResponse,
    RecoveredFileRecord,
    ForensicReportResponse,
)
from app.services.storage_scanner import StorageScannerService
from app.services.recovery_service import (
    scan_device_deleted_files,
    restore_files,
    list_all_recovered_files,
    get_last_scan_metadata,
    generate_forensic_recovery_report,
)

router = APIRouter(prefix="/recovery", tags=["Recovery"])
logger = logging.getLogger(__name__)


@router.post("/scan", response_model=RecoveryScanResponse)
def scan_deleted_files_endpoint(req: RecoveryScanRequest):
    """Scans the specified storage device/drive or forensic image for deleted files."""
    if req.scan_type == "forensic_image" or (req.image_path and os.path.exists(req.image_path)):
        if not req.image_path or not os.path.exists(req.image_path):
            raise HTTPException(status_code=400, detail=f"Forensic image file not found: {req.image_path}")
        logger.info("Starting forensic image file carving on %s", req.image_path)
        img_id = os.path.basename(req.image_path)
        files = scan_device_deleted_files({"id": img_id}, scan_type="forensic_image", image_path=req.image_path)
        profile, acq_hash = get_last_scan_metadata(img_id)
        return RecoveryScanResponse(
            device_id=img_id,
            device_name=f"Forensic Image ({img_id})",
            scan_type="forensic_image",
            scanned_at=datetime.now(timezone.utc),
            total_found=len(files),
            files=files,
            device_profile=profile,
            acquisition_hash=acq_hash,
        )

    if req.device_id in ("all", "all_drives", "machine"):
        target = {
            "id": "all",
            "model": "All Machine Storage & Recycle Bins",
            "vendor": "Local System",
            "device_type": "INTERNAL_STORAGE",
            "is_system_disk": True,
            "mount_point": "C:\\",
        }
    else:
        # Fast path for drive letter targets (e.g. "vol_D", "D:", "D:\", "Volume-D")
        target = None
        clean_id = (req.device_id or "").strip()
        if len(clean_id) == 1 and clean_id.isalpha():
            dl = clean_id.upper()
            target = {"id": f"vol_{dl}", "device_path": f"{dl}:\\", "mount_point": f"{dl}:\\", "model": f"Volume ({dl}:)", "vendor": "Local Storage"}
        elif clean_id.upper().startswith("VOL_") and len(clean_id) >= 5 and clean_id[4].isalpha():
            dl = clean_id[4].upper()
            target = {"id": clean_id, "device_path": f"{dl}:\\", "mount_point": f"{dl}:\\", "model": f"Volume ({dl}:)", "vendor": "Local Storage"}
        elif len(clean_id) >= 2 and clean_id[1] == ":":
            dl = clean_id[0].upper()
            target = {"id": clean_id, "device_path": f"{dl}:\\", "mount_point": f"{dl}:\\", "model": f"Volume ({dl}:)", "vendor": "Local Storage"}

        if not target:
            devices = StorageScannerService.scan_devices()
            target = next((d for d in devices if d["id"] == req.device_id), None)
            if not target and devices:
                target = next((d for d in devices if d.get("device_path") == req.device_id), None)
            if not target and devices:
                target = next((d for d in devices if req.device_id in d.get("device_path", "") or req.device_id in d.get("kernel_name", "") or req.device_id in d.get("model", "")), None)
            if not target and devices:
                target = devices[0]
            if not target:
                target = {"id": "default_drive", "device_path": "C:\\", "mount_point": "C:\\", "is_system_disk": True}

    logger.info("Starting deleted files scan on device %s (%s)", target.get("model", target.get("device_path")), req.scan_type)
    files = scan_device_deleted_files(target, scan_type=req.scan_type, image_path=req.image_path)
    profile, acq_hash = get_last_scan_metadata(target["id"])

    # Check if process is running as Administrator
    import ctypes
    is_admin = False
    try:
        is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        is_admin = (os.geteuid() == 0) if hasattr(os, "geteuid") else False

    elevation_required = False
    elevation_message = None
    if not is_admin and len(files) == 0:
        elevation_required = True
        elevation_message = (
            "No files detected. Low-level physical sector access is restricted on drive D: "
            "because FORENSURE is currently running with standard user permissions. "
            "Windows requires Administrator privileges (UAC) to scan unallocated clusters for files emptied from the Recycle Bin."
        )

    return RecoveryScanResponse(
        device_id=target["id"],
        device_name=f"{target.get('vendor', '')} {target.get('model', '')}".strip() or target.get("device_path", ""),
        scan_type=req.scan_type,
        scanned_at=datetime.now(timezone.utc),
        total_found=len(files),
        files=files,
        device_profile=profile,
        acquisition_hash=acq_hash,
        elevation_required=elevation_required,
        elevation_message=elevation_message,
    )


@router.post("/restore", response_model=RestoreFileResponse)
def restore_files_endpoint(req: RestoreFileRequest):
    """Restores selected deleted files to a secure evidence folder and logs forensic hashes."""
    if not req.file_ids:
        raise HTTPException(status_code=400, detail="No files selected for recovery.")

    logger.info("Restoring %d file(s) for device %s", len(req.file_ids), req.device_id)
    restored = restore_files(req.file_ids, destination_folder=req.destination_folder)

    success_count = sum(1 for item in restored if item.status == "RECOVERED")
    return RestoreFileResponse(
        total_requested=len(req.file_ids),
        total_recovered=success_count,
        restored_items=restored,
    )


@router.get("/recovered", response_model=List[RecoveredFileRecord])
def get_recovered_history_endpoint():
    """Retrieves all recovered files from the forensic database."""
    return list_all_recovered_files()


@router.get("/download/{filename}")
def download_recovered_file(filename: str):
    """Downloads a recovered file from the evidence directory with multi-location resolution."""
    raw_name = urllib.parse.unquote(filename)
    safe_name = os.path.basename(raw_name)

    candidate_paths = [
        os.path.join(str(BACKEND_ROOT), "evidence", "recovered", safe_name),
        os.path.join(str(PROJECT_ROOT), "evidence", "recovered", safe_name),
        os.path.join(os.getcwd(), "evidence", "recovered", safe_name),
        os.path.join("evidence", "recovered", safe_name),
    ]

    file_path = None
    for cp in candidate_paths:
        if os.path.isfile(cp):
            file_path = cp
            break

    if not file_path:
        from app.database import SessionLocal
        from app.models.forensic import RecoveredFile
        db = SessionLocal()
        try:
            rec = (
                db.query(RecoveredFile)
                .filter((RecoveredFile.filename == safe_name) | (RecoveredFile.recovery_id == safe_name))
                .order_by(RecoveredFile.created_at.desc())
                .first()
            )
            if rec and rec.output_path:
                if os.path.isfile(rec.output_path):
                    file_path = rec.output_path
                else:
                    for base in (str(BACKEND_ROOT), str(PROJECT_ROOT), os.getcwd()):
                        alt = os.path.join(base, rec.output_path)
                        if os.path.isfile(alt):
                            file_path = alt
                            break
        finally:
            db.close()

    # Fallback to session cache if payload or source is present
    if not file_path:
        from app.services.recovery_service import SCANNED_DELETED_CACHE, CARVED_DATA_CACHE
        for fid, item in SCANNED_DELETED_CACHE.items():
            if item.filename == safe_name or item.id == safe_name or fid == safe_name:
                if fid in CARVED_DATA_CACHE:
                    payload = CARVED_DATA_CACHE[fid]
                    mtype, _ = mimetypes.guess_type(safe_name)
                    return Response(
                        content=payload,
                        media_type=mtype or "application/octet-stream",
                        headers={
                            "Content-Disposition": f'attachment; filename="{safe_name}"',
                            "Content-Length": str(len(payload)),
                            "Access-Control-Expose-Headers": "Content-Disposition",
                        },
                    )
                if item.source_path and os.path.isfile(item.source_path):
                    file_path = item.source_path
                    break

    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"Recovered file '{safe_name}' not found on storage.")

    mtype, _ = mimetypes.guess_type(safe_name)
    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type=mtype or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/report", response_model=ForensicReportResponse)
def get_recovery_report_endpoint(device_id: str = Query(..., description="Device ID or 'all' to generate report")):
    """Generates a formal ISO/IEC 27037 forensic examination report with device profiling and hashes."""
    try:
        return generate_forensic_recovery_report(device_id)
    except Exception as exc:
        logger.error("Failed to generate forensic report for device %s: %s", device_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to generate forensic report: {exc}")


@router.get("/privileges")
def get_recovery_privileges_endpoint():
    """Checks whether the running process has elevated Administrator rights to perform raw physical sector reads."""
    import platform
    is_admin = False
    can_read_raw = False

    if platform.system() == "Windows":
        try:
            import ctypes
            is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            is_admin = False

        # Verify direct sector access
        for drv in ["C:", "D:"]:
            try:
                with open(f"\\\\.\\{drv}", "rb") as rf:
                    rf.read(512)
                    can_read_raw = True
                    break
            except Exception:
                pass
    else:
        is_admin = (os.geteuid() == 0) if hasattr(os, "geteuid") else False
        can_read_raw = is_admin

    return {
        "is_admin": is_admin,
        "can_read_raw_disk": can_read_raw,
        "platform": platform.system(),
        "elevation_required": not is_admin,
        "advisory": (
            "Kernel Administrator privileges active. Full raw physical sector carving enabled."
            if is_admin
            else "Running with standard user permissions. Windows kernel blocks raw disk sectors (\\\\.\\D:) unless Administrator access is granted."
        ),
    }


@router.post("/elevate")
def request_elevation_endpoint():
    """Triggers native Windows UAC (runas) dialog to grant the backend/bridge Administrator privileges."""
    import platform
    if platform.system() != "Windows":
        return {"status": "UNSUPPORTED", "message": "Elevation is only applicable on Windows operating systems."}

    try:
        import ctypes
        if ctypes.windll.shell32.IsUserAnAdmin() != 0:
            return {"status": "ALREADY_ADMIN", "message": "The system is already running with full Administrator privileges."}

        import sys
        import subprocess

        # Locate suitable startup batch file
        candidates = [
            os.path.join(str(PROJECT_ROOT), "RUN-AS-ADMIN.bat"),
            os.path.join(str(BACKEND_ROOT), "RUN-AS-ADMIN.bat"),
            os.path.join(str(PROJECT_ROOT), "START.bat"),
            os.path.join(str(BACKEND_ROOT), "START-BRIDGE.bat"),
        ]
        target_bat = None
        for c in candidates:
            if os.path.exists(c):
                target_bat = os.path.abspath(c)
                break

        script_dir = os.path.dirname(target_bat) if target_bat else str(PROJECT_ROOT)
        manual_cmd = f'powershell -Command "Start-Process cmd -ArgumentList \'/k cd /d \\"{script_dir}\\" && RUN-AS-ADMIN.bat\' -Verb RunAs"'
        launched = False

        # Method 0: Check if silent elevated task "FORENSURE_Bridge" is registered
        try:
            chk = subprocess.run(["schtasks", "/query", "/tn", "FORENSURE_Bridge"], capture_output=True, text=True, timeout=2)
            if chk.returncode == 0:
                subprocess.Popen(["schtasks", "/run", "/tn", "FORENSURE_Bridge"], shell=False)
                return {
                    "status": "AUTO_ELEVATED",
                    "message": "Silent Administrator elevation triggered automatically via registered Windows task.",
                    "manual_command": "schtasks /run /tn \"FORENSURE_Bridge\"",
                }
        except Exception as exc:
            logger.debug("Scheduled task check failed: %s", exc)

        # Method 1: If running as bundled standalone executable (e.g. FORENSURE-Bridge.exe)
        if getattr(sys, "frozen", False):
            try:
                exe_dir = os.path.dirname(os.path.abspath(sys.executable))
                ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv[1:]), exe_dir, 1)
                if int(ret) > 32:
                    launched = True
            except Exception as exc:
                logger.debug("Frozen ShellExecuteW failed: %s", exc)

        # Method 1b: If FORENSURE-Bridge.exe exists in current or project directory
        if not launched:
            for exe_candidate in [
                os.path.join(os.getcwd(), "FORENSURE-Bridge.exe"),
                os.path.join(str(PROJECT_ROOT), "FORENSURE-Bridge.exe"),
                os.path.join(str(BACKEND_ROOT), "dist", "FORENSURE-Bridge", "FORENSURE-Bridge.exe"),
            ]:
                if os.path.isfile(exe_candidate):
                    try:
                        exe_d = os.path.dirname(os.path.abspath(exe_candidate))
                        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", os.path.abspath(exe_candidate), "", exe_d, 1)
                        if int(ret) > 32:
                            launched = True
                            break
                    except Exception as exc:
                        logger.debug("Bridge exe ShellExecuteW failed: %s", exc)

        # Method 1c: ShellExecuteW directly on target_bat with "runas"
        if not launched and target_bat:
            try:
                ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", target_bat, "", script_dir, 1)
                if int(ret) > 32:
                    launched = True
            except Exception as exc:
                logger.debug("target_bat ShellExecuteW failed: %s", exc)

        # Method 2: Launch via PowerShell Start-Process with -Verb RunAs
        if not launched and target_bat:
            try:
                ps_args = f'/k cd /d "{script_dir}" && "{target_bat}"'
                ps_script = f"Start-Process cmd -ArgumentList '{ps_args}' -Verb RunAs"
                subprocess.Popen(
                    ["powershell", "-NoProfile", "-Command", ps_script],
                    cwd=script_dir,
                    shell=False,
                )
                launched = True
            except Exception as exc:
                logger.debug("PowerShell RunAs failed: %s", exc)

        # Method 3: ShellExecuteW on cmd.exe with runas verb
        if not launched and target_bat:
            try:
                comspec = os.environ.get("COMSPEC", "C:\\Windows\\system32\\cmd.exe")
                ret = ctypes.windll.shell32.ShellExecuteW(
                    None,
                    "runas",
                    comspec,
                    f'/k cd /d "{script_dir}" && "{target_bat}"',
                    script_dir,
                    1,
                )
                if int(ret) > 32:
                    launched = True
            except Exception as exc:
                logger.debug("ShellExecuteW cmd.exe failed: %s", exc)

        if launched:
            # Cleanly release port 8000 by terminating the non-elevated instance
            # after a 1.2s delay to allow the HTTP response to reach the browser.
            import threading
            import time
            def _delayed_exit():
                time.sleep(1.2)
                logger.info("Non-elevated bridge process exiting to yield port 8000 to elevated Administrator bridge.")
                os._exit(0)
            threading.Thread(target=_delayed_exit, daemon=True).start()

            return {
                "status": "UAC_TRIGGERED",
                "message": "Windows Administrator prompt requested. Please look at your screen or taskbar and click 'Yes'.",
                "manual_command": manual_cmd,
            }
        else:
            return {
                "status": "MANUAL_ACTION_REQUIRED",
                "message": (
                    "Windows security requires manual administrator approval. "
                    f"Please right-click 'RUN-AS-ADMIN.bat' in {script_dir} and select 'Run as administrator'."
                ),
                "manual_command": manual_cmd,
            }

    except Exception as exc:
        logger.error("Error during elevation request: %s", exc)
        return {
            "status": "MANUAL_ACTION_REQUIRED",
            "message": "Please right-click 'RUN-AS-ADMIN.bat' in your FORENSURE folder and select 'Run as administrator'.",
            "manual_command": 'powershell -Command "Start-Process cmd -ArgumentList \'/k cd /d D:\\SIH && RUN-AS-ADMIN.bat\' -Verb RunAs"',
        }

