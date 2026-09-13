import hashlib
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.evidence import Evidence
from app.models.operation import Operation
from app.schemas.evidence import EvidenceRecord
from app.services.filesystem_analyzer import _normalise_relative_path, FileBrowserError
from app.services.usb_detector import UsbDeviceRecord

logger = logging.getLogger(__name__)


def hash_file(db: Session, record: UsbDeviceRecord, path: str, case_id: str = "CASE-DEFAULT") -> EvidenceRecord:
    current_path = _normalise_relative_path(path)
    if not record.mount_point:
        raise FileBrowserError("USB is not mounted. Cannot calculate hash.")
    try:
        mount_root = Path(record.mount_point).resolve(strict=True)
        candidate = (mount_root / current_path).resolve(strict=True)
        candidate.relative_to(mount_root)
        if not candidate.is_file():
            raise FileBrowserError("The requested path is not a file.")
        sha256_hash = hashlib.sha256()
        with open(candidate, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256_hash.update(chunk)
        computed_hash = sha256_hash.hexdigest()
        return _record_evidence(db, record.id, current_path, computed_hash, case_id)
    except (OSError, ValueError) as exc:
        logger.error("Hashing failed for %s on %s: %s", current_path, record.id, str(exc))
        raise FileBrowserError("Failed to calculate SHA-256 hash. Ensure file is accessible.")


def _record_evidence(db: Session, device_id: str, path: str, sha256: str, case_id: str) -> EvidenceRecord:
    operation_id = f"op_{uuid.uuid4().hex[:12]}"
    op = Operation(
        id=operation_id,
        device_id=device_id,
        operation_type="hashing",
        status="completed",
        created_at=datetime.now(UTC)
    )
    db.add(op)
    evidence_id = f"ev_{uuid.uuid4().hex[:12]}"
    ev = Evidence(
        id=evidence_id,
        operation_id=operation_id,
        case_id=case_id,
        path=path,
        sha256=sha256,
        created_at=datetime.now(UTC)
    )
    db.add(ev)
    db.commit()
    return EvidenceRecord(
        id=ev.id,
        case_id=ev.case_id,
        path=ev.path,
        sha256=ev.sha256,
        created_at=ev.created_at,
        operation_id=ev.operation_id
    )


def list_evidence(db: Session, device_id: str) -> list[EvidenceRecord]:
    ops = db.query(Operation).filter(Operation.device_id == device_id).all()
    op_ids = [op.id for op in ops]
    if not op_ids:
        return []
    records = db.query(Evidence).filter(Evidence.operation_id.in_(op_ids)).order_by(Evidence.created_at.desc()).all()
    return [
        EvidenceRecord(
            id=ev.id,
            case_id=ev.case_id,
            path=ev.path,
            sha256=ev.sha256,
            created_at=ev.created_at,
            operation_id=ev.operation_id
        )
        for ev in records
    ]
