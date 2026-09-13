import hashlib
import logging
import os
import subprocess
import tempfile
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.schemas.evidence import EvidenceRecord
from app.schemas.forensics import DeletedFileRecord
from app.services.filesystem_analyzer import FileBrowserError
from app.services.hasher import _record_evidence
from app.services.usb_detector import UsbDeviceRecord

logger = logging.getLogger(__name__)

EXPORTS_DIR = Path(tempfile.gettempdir()) / "securedata_exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

def scan_deleted_files(record: UsbDeviceRecord) -> list[DeletedFileRecord]:
    """Scan a device for deleted files using TSK's fls."""

    if not record.device_path:
        raise FileBrowserError("Device path unavailable for scanning.")
        
    try:
        # fls -r -d (recursive, deleted only)
        result = subprocess.run(
            ["fls", "-r", "-d", record.device_path],
            capture_output=True,
            text=True,
            check=True
        )
        
        records = []
        for line in result.stdout.splitlines():
            # Example fls output: r/r * 105-128-1:    passwords.txt
            if "*" not in line:
                continue
                
            parts = line.split(":\t")
            if len(parts) != 2:
                parts = line.split(": ")
            if len(parts) != 2:
                continue
                
            metadata = parts[0].strip()
            filename = parts[1].strip()
            
            # Extract inode: "r/r * 105-128-1" -> "105-128-1"
            meta_parts = metadata.split()
            inode = meta_parts[-1]
            
            records.append(
                DeletedFileRecord(
                    inode=inode,
                    filename=filename,
                    size_bytes=None, # fls doesn't give size by default without -l
                    recoverable=True
                )
            )
        return records
    except FileNotFoundError:
        logger.warning("TSK fls not found on host. Cannot scan deleted files.")
        raise FileBrowserError("Forensic tools (TSK) are not installed on this server.")
    except subprocess.CalledProcessError as exc:
        logger.error("fls failed: %s", exc.stderr)
        raise FileBrowserError("Failed to scan for deleted files. Ensure you have root privileges and the partition is unmounted.")

def recover_file(db: Session, record: UsbDeviceRecord, inode: str, filename: str, case_id: str = "CASE-DEFAULT") -> EvidenceRecord:
    """Recover a deleted file using TSK's icat and record it as evidence."""
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
    export_path = EXPORTS_DIR / f"{record.id}_{inode}_{safe_filename}"
    

    if not record.device_path:
        raise FileBrowserError("Device path unavailable for recovery.")
        
    try:
        # Run icat to recover the file
        with open(export_path, "wb") as out_file:
            subprocess.run(
                ["icat", record.device_path, inode],
                stdout=out_file,
                stderr=subprocess.PIPE,
                check=True
            )
            
        # Hash the recovered file
        sha256_hash = hashlib.sha256()
        with open(export_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256_hash.update(chunk)
                
        computed_hash = sha256_hash.hexdigest()
        
        # Log to evidence
        return _record_evidence(db, record.id, f"recovered/{safe_filename}", computed_hash, case_id)
        
    except FileNotFoundError:
        logger.warning("TSK icat not found on host. Cannot recover files.")
        raise FileBrowserError("Forensic tools (TSK) are not installed on this server.")
    except subprocess.CalledProcessError as exc:
        logger.error("icat failed: %s", exc.stderr.decode(errors='ignore'))
        if export_path.exists():
            export_path.unlink()
        raise FileBrowserError("Failed to recover file. The blocks may have been overwritten.")
    except (OSError, ValueError) as exc:
        logger.error("Failed to hash recovered file: %s", exc)
        raise FileBrowserError("File was recovered but failed to hash.")
