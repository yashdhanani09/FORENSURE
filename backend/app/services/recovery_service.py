import os
import re
import uuid
import struct
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Any, Tuple

from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.forensic import ForensicCase, EvidenceItem, RecoveredFile, ChainOfCustodyEvent
from app.schemas.recovery import DeletedFileItem, RestoredItem, RecoveredFileRecord
from app.services.file_carver import raw_file_carver, CarvedFile

logger = logging.getLogger(__name__)

# In-memory cache of scanned deleted files: { file_id: DeletedFileItem }
SCANNED_DELETED_CACHE: Dict[str, DeletedFileItem] = {}
# In-memory cache of raw carved file payloads: { file_id: bytes }
CARVED_DATA_CACHE: Dict[str, bytes] = {}


def _get_category(extension: str) -> str:
    ext = extension.lower().lstrip(".")
    if ext in {"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tiff", "ico"}:
        return "Image"
    if ext in {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "csv", "md", "json", "xml"}:
        return "Document"
    if ext in {"mp4", "mkv", "avi", "mov", "wmv", "mp3", "wav", "flac", "aac", "ogg"}:
        return "Media"
    if ext in {"zip", "rar", "7z", "tar", "gz", "bz2", "xz"}:
        return "Archive"
    if ext in {"py", "ts", "tsx", "js", "html", "css", "c", "cpp", "java", "sql", "sh", "bat", "ps1"}:
        return "Code"
    return "Other"


def _parse_dollar_i_file(i_path: str) -> Tuple[Optional[str], Optional[str], Optional[datetime], Optional[int]]:
    """
    Parses Windows Recycle Bin $I metadata file.
    Returns (orig_name, orig_path, deleted_at, original_size).
    Supports:
      - Version 1 (Windows Vista / 7 / 8): fixed length 520 bytes string at offset 24
      - Version 2 (Windows 10 / 11): 4-byte DWORD character count at offset 24, string at offset 28
    """
    try:
        with open(i_path, "rb") as ifp:
            data = ifp.read()
        if len(data) < 28:
            return None, None, None, None

        version = struct.unpack("<Q", data[:8])[0]
        size = struct.unpack("<Q", data[8:16])[0]
        filetime = struct.unpack("<Q", data[16:24])[0]

        del_time: Optional[datetime] = None
        if filetime > 0:
            try:
                del_time = datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=filetime // 10)
            except Exception:
                del_time = None

        raw_path = ""
        if version >= 2:
            # Windows 10 & Windows 11 format:
            # Offset 24-27: Length of path in UTF-16 characters (DWORD)
            char_count = struct.unpack("<I", data[24:28])[0]
            if char_count > 0 and len(data) >= 28 + char_count * 2:
                raw_path = data[28:28 + char_count * 2].decode("utf-16le", errors="ignore").rstrip("\x00")
            else:
                raw_path = data[28:].decode("utf-16le", errors="ignore").rstrip("\x00")
        else:
            # Version 1 (Windows Vista / 7 / 8):
            # Offset 24-543: Unicode string (up to 260 chars / 520 bytes)
            raw_path = data[24:24 + 520].decode("utf-16le", errors="ignore").rstrip("\x00")

        if not raw_path:
            # Fallback: attempt searching for drive letter colon e.g. "D:\" in data
            try:
                decoded = data[24:].decode("utf-16le", errors="ignore").rstrip("\x00")
                if ":" in decoded:
                    idx = decoded.index(":")
                    if idx > 0:
                        raw_path = decoded[idx - 1:]
            except Exception:
                pass

        if raw_path:
            raw_path = raw_path.strip("\x00 \t\r\n")
            orig_name = Path(raw_path).name
            if orig_name:
                return orig_name, raw_path, del_time, size

        return None, None, del_time, size
    except Exception as exc:
        logger.debug("Could not parse $I file %s: %s", i_path, exc)
        return None, None, None, None


def _parse_ntfs_recycle_bin(mount_root: str) -> List[DeletedFileItem]:
    """Scans Windows NTFS $RECYCLE.BIN directory on the given mount point."""
    items: List[DeletedFileItem] = []
    recycle_bin_path = os.path.join(mount_root, "$RECYCLE.BIN")
    if not os.path.exists(recycle_bin_path):
        recycle_bin_path = os.path.join(mount_root, "$Recycle.Bin")
        if not os.path.exists(recycle_bin_path):
            return items

    logger.info("Scanning NTFS Recycle Bin at %s", recycle_bin_path)

    # Collect $I (metadata) and $R (data) files
    i_files: Dict[str, str] = {}
    r_files: Dict[str, str] = {}

    try:
        for root, dirs, files in os.walk(recycle_bin_path):
            for f in files:
                full_path = os.path.join(root, f)
                if f.startswith("$I") or f.startswith("$i"):
                    key = f[2:].lower()
                    i_files[key] = full_path
                elif f.startswith("$R") or f.startswith("$r"):
                    key = f[2:].lower()
                    r_files[key] = full_path
                else:
                    # Generic deleted file remnant
                    try:
                        sz = os.path.getsize(full_path)
                        if sz > 0:
                            ext = Path(f).suffix.lstrip(".")
                            mtime = datetime.fromtimestamp(os.path.getmtime(full_path), tz=timezone.utc)
                            fid = f"del_{uuid.uuid4().hex[:12]}"
                            item = DeletedFileItem(
                                id=fid,
                                filename=f,
                                original_path=os.path.relpath(full_path, mount_root),
                                source_path=full_path,
                                size_bytes=sz,
                                extension=ext or "bin",
                                category=_get_category(ext),
                                deleted_at=mtime,
                                confidence="HIGH",
                                confidence_score=85,
                                validation_details="Recycle Bin payload file located",
                                recovery_method="ntfs_remnant",
                                recoverable=True,
                            )
                            items.append(item)
                            SCANNED_DELETED_CACHE[fid] = item
                    except Exception:
                        pass
    except Exception as exc:
        logger.warning("Error walking $RECYCLE.BIN: %s", exc)

    # Correlate $I and $R files
    for key, r_path in r_files.items():
        try:
            sz = os.path.getsize(r_path)
            i_path = i_files.get(key)
            orig_name = Path(r_path).name
            orig_path = r_path
            del_time = datetime.fromtimestamp(os.path.getmtime(r_path), tz=timezone.utc)
            method = "ntfs_remnant"

            # Parse original filename and timestamp from companion $I file
            if i_path and os.path.exists(i_path):
                parsed_name, parsed_path, parsed_time, parsed_size = _parse_dollar_i_file(i_path)
                if parsed_name:
                    orig_name = parsed_name
                    method = "ntfs_metadata"
                if parsed_path:
                    orig_path = parsed_path
                if parsed_time:
                    del_time = parsed_time
                if parsed_size and parsed_size > 0:
                    sz = parsed_size

            ext = Path(orig_name).suffix.lstrip(".")
            fid = f"del_{uuid.uuid4().hex[:12]}"
            item = DeletedFileItem(
                id=fid,
                filename=orig_name,
                original_path=orig_path,
                source_path=r_path,
                size_bytes=sz,
                extension=ext or "bin",
                category=_get_category(ext),
                deleted_at=del_time,
                confidence="HIGH",
                confidence_score=95 if method == "ntfs_metadata" else 85,
                validation_details="Verified NTFS Recycle Bin metadata ($I companion record)" if method == "ntfs_metadata" else "Recycle Bin payload file located",
                recovery_method=method,
                recoverable=True,
            )
            items.append(item)
            SCANNED_DELETED_CACHE[fid] = item
        except Exception as exc:
            logger.debug("Error processing $R file %s: %s", r_path, exc)

    # Also capture any historical $I files that may have lost their $R counterpart
    for key, i_path in i_files.items():
        if key not in r_files:
            try:
                parsed_name, parsed_path, parsed_time, parsed_size = _parse_dollar_i_file(i_path)
                if parsed_name:
                    ext = Path(parsed_name).suffix.lstrip(".")
                    fid = f"del_{uuid.uuid4().hex[:12]}"
                    item = DeletedFileItem(
                        id=fid,
                        filename=parsed_name,
                        original_path=parsed_path or i_path,
                        source_path=i_path,
                        size_bytes=parsed_size or 0,
                        extension=ext or "bin",
                        category=_get_category(ext),
                        deleted_at=parsed_time or datetime.fromtimestamp(os.path.getmtime(i_path), tz=timezone.utc),
                        confidence="MEDIUM",
                        confidence_score=60,
                        validation_details="NTFS metadata record preserved ($I); raw payload unallocated",
                        recovery_method="ntfs_metadata_header",
                        recoverable=False,
                    )
                    items.append(item)
                    SCANNED_DELETED_CACHE[fid] = item
            except Exception:
                pass

    return items


def _scan_raw_carver(mount_root: str, max_files: int = 100) -> List[DeletedFileItem]:
    """
    Performs raw binary signature carving from physical/logical storage volumes,
    disk images, or unallocated slack areas. Supports JPG, PNG, PDF, DOCX, XLSX, ZIP, MP4.
    """
    items: List[DeletedFileItem] = []
    logger.info("Initiating forensic raw file carving on %s", mount_root)

    # Strategy A: Direct Raw Disk Handle (if elevated/accessible)
    drive_prefix = mount_root[:2] if len(mount_root) >= 2 and mount_root[1] == ":" else ""
    if drive_prefix:
        raw_handle_path = f"\\\\.\\{drive_prefix}"
        try:
            with open(raw_handle_path, "rb") as rf:
                # Stream first 64MB of raw sectors for fast carving
                raw_chunk = rf.read(64 * 1024 * 1024)
                if raw_chunk:
                    carved = raw_file_carver.carve_bytes(raw_chunk, base_offset=0)
                    for c in carved[:max_files]:
                        item = DeletedFileItem(
                            id=c.id,
                            filename=c.filename,
                            original_path=f"Physical Volume {drive_prefix} @ Sector 0x{c.offset_bytes:08X}",
                            source_path=f"carved://{c.id}",
                            size_bytes=c.size_bytes,
                            extension=c.extension,
                            category=c.category,
                            deleted_at=c.created_at,
                            confidence=c.confidence,
                            confidence_score=c.confidence_score,
                            validation_details=c.validation_details,
                            offset_bytes=c.offset_bytes,
                            recovery_method=f"raw_carver_{c.extension}",
                            recoverable=True,
                        )
                        items.append(item)
                        SCANNED_DELETED_CACHE[c.id] = item
                        CARVED_DATA_CACHE[c.id] = c.data
        except (PermissionError, OSError) as exc:
            logger.debug("Raw volume direct access unprivileged on %s: %s", raw_handle_path, exc)

    # Strategy B: Scan any local forensic disk images (.dd, .raw, .img, .bin, .iso) in target locations
    candidate_images: List[str] = []
    search_dirs = [
        mount_root,
        os.path.join(mount_root, "evidence"),
        os.path.join(mount_root, "evidence", "images"),
        os.path.join(os.path.expanduser("~"), "Downloads"),
        "evidence",
    ]

    for s_dir in search_dirs:
        if os.path.exists(s_dir):
            try:
                for root, _, files in os.walk(s_dir):
                    for fn in files:
                        low = fn.lower()
                        if low.endswith((".dd", ".raw", ".img", ".bin", ".iso")):
                            candidate_images.append(os.path.join(root, fn))
                    if len(candidate_images) >= 5:
                        break
            except Exception:
                pass

    for img_path in candidate_images[:3]:
        if len(items) >= max_files:
            break
        carved_img = raw_file_carver.carve_file_stream(img_path, max_bytes=100 * 1024 * 1024)
        for c in carved_img:
            if len(items) >= max_files:
                break
            item = DeletedFileItem(
                id=c.id,
                filename=c.filename,
                original_path=f"{os.path.basename(img_path)} @ 0x{c.offset_bytes:08X}",
                source_path=f"carved://{c.id}",
                size_bytes=c.size_bytes,
                extension=c.extension,
                category=c.category,
                deleted_at=c.created_at,
                confidence=c.confidence,
                confidence_score=c.confidence_score,
                validation_details=c.validation_details,
                offset_bytes=c.offset_bytes,
                recovery_method=f"raw_carver_{c.extension}",
                recoverable=True,
            )
            items.append(item)
            SCANNED_DELETED_CACHE[c.id] = item
            CARVED_DATA_CACHE[c.id] = c.data

    # Strategy C: Deep scanning of unallocated slack, orphaned caches, and temporary clusters
    unallocated_dirs = [
        os.path.join(mount_root, "AppData", "Local", "Temp"),
        os.path.join(mount_root, "Temp"),
        os.path.join(mount_root, "$Recycle.Bin"),
        os.path.join(mount_root, "$RECYCLE.BIN"),
        os.path.join(mount_root, ".Trash-1000"),
    ]

    for u_dir in unallocated_dirs:
        if len(items) >= max_files:
            break
        if os.path.exists(u_dir):
            try:
                for entry in os.scandir(u_dir):
                    if len(items) >= max_files:
                        break
                    if entry.is_file(follow_symlinks=False):
                        # Carve raw bytes from temporary and unlinked files
                        try:
                            file_sz = entry.stat().st_size
                            if 32 <= file_sz <= 50 * 1024 * 1024:
                                with open(entry.path, "rb") as ef:
                                    buf = ef.read(min(file_sz, 10 * 1024 * 1024))
                                carved_entries = raw_file_carver.carve_bytes(buf)
                                for c in carved_entries:
                                    if len(items) >= max_files:
                                        break
                                    item = DeletedFileItem(
                                        id=c.id,
                                        filename=c.filename,
                                        original_path=f"{os.path.relpath(entry.path, mount_root)} [Carved Remnant]",
                                        source_path=f"carved://{c.id}",
                                        size_bytes=c.size_bytes,
                                        extension=c.extension,
                                        category=c.category,
                                        deleted_at=c.created_at,
                                        confidence=c.confidence,
                                        confidence_score=c.confidence_score,
                                        validation_details=c.validation_details,
                                        offset_bytes=c.offset_bytes,
                                        recovery_method=f"raw_carver_{c.extension}",
                                        recoverable=True,
                                    )
                                    items.append(item)
                                    SCANNED_DELETED_CACHE[c.id] = item
                                    CARVED_DATA_CACHE[c.id] = c.data
                        except Exception:
                            pass
            except Exception:
                pass

    logger.info("Raw carver completed on %s: found %d carved file(s)", mount_root, len(items))
    return items


def carve_forensic_image_file(image_path: str, max_files: int = 150) -> List[DeletedFileItem]:
    """Carves supported files from an external forensic disk image file (.dd, .raw, .img)."""
    items: List[DeletedFileItem] = []
    if not os.path.exists(image_path):
        logger.warning("Forensic image file not found: %s", image_path)
        return items

    carved_files = raw_file_carver.carve_file_stream(image_path)
    for c in carved_files[:max_files]:
        item = DeletedFileItem(
            id=c.id,
            filename=c.filename,
            original_path=f"{os.path.basename(image_path)} @ 0x{c.offset_bytes:08X}",
            source_path=f"carved://{c.id}",
            size_bytes=c.size_bytes,
            extension=c.extension,
            category=c.category,
            deleted_at=c.created_at,
            confidence=c.confidence,
            confidence_score=c.confidence_score,
            validation_details=c.validation_details,
            offset_bytes=c.offset_bytes,
            recovery_method=f"raw_carver_{c.extension}",
            recoverable=True,
        )
        SCANNED_DELETED_CACHE[c.id] = item
        CARVED_DATA_CACHE[c.id] = c.data
        items.append(item)

    return items


def scan_device_deleted_files(
    device: dict,
    scan_type: str = "quick",
    image_path: Optional[str] = None
) -> List[DeletedFileItem]:
    """
    Scans the target storage device or volume for deleted files.
    Supports:
      - 'quick': Fast NTFS Recycle Bin and metadata index parsing.
      - 'deep' / 'carving': Combines NTFS metadata and byte-level Raw Data File Carving
        with Digital Image Analysis & Fragment Reconstruction (JPG, PNG, PDF, DOCX, XLSX, ZIP, MP4).
      - 'forensic_image': Directly carves a raw disk image file (.dd, .raw, .img).
    """
    results: List[DeletedFileItem] = []

    # If an image path is explicitly provided or scan_type is forensic_image
    if image_path and os.path.exists(image_path):
        return carve_forensic_image_file(image_path)

    # Find the mount point
    mount_point = device.get("mount_point")
    if not mount_point:
        for p in device.get("partitions", []):
            if p.get("mount_point"):
                mount_point = p.get("mount_point")
                break

    if not mount_point and os.path.exists(device.get("device_path", "")):
        mount_point = device.get("device_path")

    if not mount_point:
        logger.warning("No mount point found for device %s", device.get("id"))
        return results

    # Normalize Windows mount point (e.g. 'D:\')
    if len(mount_point) == 2 and mount_point[1] == ":":
        mount_point = mount_point + "\\"

    # 1. NTFS Recycle Bin / Trash scanning (Quick and Deep)
    ntfs_items = _parse_ntfs_recycle_bin(mount_point)
    results.extend(ntfs_items)

    # 2. Raw Data File Carving & Fragment Reconstruction (Deep / Carving)
    if scan_type in {"deep", "carving"} or len(results) == 0:
        carved_items = _scan_raw_carver(mount_point)
        results.extend(carved_items)

    # Sort by deleted_at descending
    results.sort(key=lambda x: x.deleted_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    logger.info("Found %d deleted / carved files on %s", len(results), mount_point)
    return results


def restore_files(file_ids: List[str], destination_folder: Optional[str] = None) -> List[RestoredItem]:
    """Restores selected deleted files to the destination directory and computes hashes."""
    output_dir = destination_folder or os.path.join("evidence", "recovered")
    os.makedirs(output_dir, exist_ok=True)

    db: Session = SessionLocal()
    restored: List[RestoredItem] = []

    try:
        # Check or create default recovery case for audit tracking
        default_case = db.query(ForensicCase).filter(ForensicCase.case_id == "CASE-RECOVERY-DEFAULT").first()
        if not default_case:
            default_case = ForensicCase(
                case_id="CASE-RECOVERY-DEFAULT",
                case_name="Direct File Recovery Hub",
                description="Automated case tracking files restored from the File Recovery module.",
                status="ACTIVE",
            )
            db.add(default_case)
            db.commit()
            db.refresh(default_case)

        default_ev = db.query(EvidenceItem).filter(EvidenceItem.case_id == default_case.id).first()
        if not default_ev:
            default_ev = EvidenceItem(
                evidence_id=f"EVD-REC-{uuid.uuid4().hex[:6].upper()}",
                case_id=default_case.id,
                device_id="STORAGE_RECOVERY",
                vendor="Local",
                model="Storage Device",
                size_bytes=0,
            )
            db.add(default_ev)
            db.commit()
            db.refresh(default_ev)

        for fid in file_ids:
            item = SCANNED_DELETED_CACHE.get(fid)
            raw_payload = CARVED_DATA_CACHE.get(fid)

            if not item or (raw_payload is None and not os.path.exists(item.source_path)):
                restored.append(RestoredItem(
                    file_id=fid,
                    filename=item.filename if item else "Unknown",
                    output_path="",
                    size_bytes=0,
                    sha256="",
                    status="FAILED",
                    error="Source file data no longer available on storage.",
                ))
                continue

            try:
                # Sanitize output filename
                safe_name = re.sub(r'[\\/*?:"<>|]', "_", item.filename)
                base_name, ext = os.path.splitext(safe_name)
                out_path = os.path.join(output_dir, safe_name)

                # Avoid collision
                counter = 1
                while os.path.exists(out_path):
                    out_path = os.path.join(output_dir, f"{base_name}_{counter}{ext}")
                    counter += 1

                # Reconstruct and copy: write from CARVED_DATA_CACHE or disk stream
                if raw_payload is not None:
                    with open(out_path, "wb") as dst:
                        dst.write(raw_payload)
                    bytes_copied = len(raw_payload)
                    digest = hashlib.sha256(raw_payload).hexdigest()
                else:
                    hasher = hashlib.sha256()
                    bytes_copied = 0
                    with open(item.source_path, "rb") as src, open(out_path, "wb") as dst:
                        while True:
                            buf = src.read(64 * 1024)
                            if not buf:
                                break
                            dst.write(buf)
                            hasher.update(buf)
                            bytes_copied += len(buf)
                    digest = hasher.hexdigest()

                # Save record to database
                rec_model = RecoveredFile(
                    recovery_id=f"REC-{uuid.uuid4().hex[:8].upper()}",
                    case_id=default_case.id,
                    evidence_id=default_ev.id,
                    filename=os.path.basename(out_path),
                    original_path=item.original_path,
                    output_path=out_path,
                    size_bytes=bytes_copied,
                    recovery_method=item.recovery_method,
                    confidence=item.confidence,
                    sha256=digest,
                    status="RECOVERED",
                )
                db.add(rec_model)

                # Chain of Custody event
                coc = ChainOfCustodyEvent(
                    case_id=default_case.id,
                    evidence_id=default_ev.id,
                    event_type="FILE_RECOVERED",
                    actor="RECOVERY_MODULE",
                    description=f"File {item.filename} restored to {out_path} (Method: {item.recovery_method}).",
                    hash_value=digest,
                )
                db.add(coc)
                db.commit()

                restored.append(RestoredItem(
                    file_id=fid,
                    filename=os.path.basename(out_path),
                    output_path=out_path,
                    size_bytes=bytes_copied,
                    sha256=digest,
                    status="RECOVERED",
                ))
                logger.info("Successfully recovered %s -> %s (SHA-256: %s)", item.filename, out_path, digest)

            except Exception as e:
                logger.error("Failed to recover file %s: %s", fid, e)
                restored.append(RestoredItem(
                    file_id=fid,
                    filename=item.filename,
                    output_path="",
                    size_bytes=0,
                    sha256="",
                    status="FAILED",
                    error=str(e),
                ))

    finally:
        db.close()

    return restored


def list_all_recovered_files() -> List[RecoveredFileRecord]:
    """Retrieves all recovered files from the database."""
    db: Session = SessionLocal()
    try:
        rows = db.query(RecoveredFile).order_by(RecoveredFile.created_at.desc()).all()
        return [
            RecoveredFileRecord(
                recovery_id=r.recovery_id,
                filename=r.filename,
                output_path=r.output_path,
                size_bytes=r.size_bytes,
                sha256=r.sha256,
                confidence=r.confidence,
                recovery_method=r.recovery_method,
                created_at=r.created_at or datetime.now(timezone.utc),
            )
            for r in rows
        ]
    finally:
        db.close()
