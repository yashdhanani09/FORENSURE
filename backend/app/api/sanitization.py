from datetime import datetime, timezone
import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.sanitization import SanitizationJob
from app.schemas.sanitization import (
    ValidationRequest,
    ValidationResponse,
    SanitizationStartRequest,
    SanitizationStartResponse,
    SanitizationJobProgress,
    SanitizationJobHistory
)
from app.services.device_safety import DeviceSafetyValidator
from app.services.sanitization_engine import SanitizationEngine
from app.services.storage_scanner import StorageScannerService

router = APIRouter(prefix="/sanitization", tags=["Sanitization"])

@router.post("/validate", response_model=ValidationResponse)
def validate_device(req: ValidationRequest):
    res = DeviceSafetyValidator.validate_for_sanitization(req.device_id)
    return ValidationResponse(**res)

@router.post("/start", response_model=SanitizationStartResponse)
def start_sanitization(req: SanitizationStartRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not req.confirmation:
        raise HTTPException(status_code=400, detail="Explicit confirmation is required.")
        
    validation = DeviceSafetyValidator.validate_for_sanitization(req.device_id)
    if not validation["safe"]:
        raise HTTPException(status_code=400, detail=f"Safety checks failed: {validation['warnings']}")
        
    # Get current hardware info to store in the job
    devices = StorageScannerService.scan_devices()
    target = next((d for d in devices if d["id"] == req.device_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Device disappeared.")
        
    job = SanitizationJob(
        device_id=target["id"],
        device_path=target["device_path"],
        target_file_path=req.target_file_path,
        vendor=target.get("vendor"),
        model=target.get("model"),
        serial_number=target.get("serial"),
        size_bytes=target.get("size_bytes", 0),
        method=req.method,
        pattern=req.pattern,
        status="PENDING"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    background_tasks.add_task(SanitizationEngine.run_sanitization_job, job.id)
    
    return SanitizationStartResponse(job_id=job.job_id, status=job.status)

@router.get("/history", response_model=List[SanitizationJobHistory])
def get_history(db: Session = Depends(get_db)):
    jobs = db.query(SanitizationJob).order_by(SanitizationJob.created_at.desc()).all()
    res = []
    for j in jobs:
        res.append(SanitizationJobHistory(
            job_id=j.job_id,
            device_id=j.device_id,
            status=j.status,
            started_at=j.started_at,
            completed_at=j.completed_at,
            method=j.method,
            pattern=j.pattern,
            target_file_path=j.target_file_path,
            verification_result=j.verification_result,
            certificate_hash=j.certificate_hash,
            events=[{"timestamp": e.timestamp, "event_type": e.event_type, "message": e.message, "severity": e.severity} for e in j.events]
        ))
    return res

@router.get("/{job_id}", response_model=SanitizationJobProgress)
def get_job_progress(job_id: str, db: Session = Depends(get_db)):
    job = db.query(SanitizationJob).filter(SanitizationJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    # Calculate speed manually if needed or just return what's in DB.
    # The progress_percent and bytes_processed are updated by the engine.
    speed = 0
    if job.started_at and job.bytes_processed > 0 and job.status == "SANITIZING":
        elapsed = (datetime.utcnow() - job.started_at).total_seconds()
        if elapsed > 0:
            speed = int(job.bytes_processed / elapsed)
            
    estimated = 0
    if speed > 0:
        estimated = int((job.size_bytes - job.bytes_processed) / speed)
        
    return SanitizationJobProgress(
        job_id=job.job_id,
        device_id=job.device_id,
        status=job.status,
        progress_percent=job.progress_percent,
        bytes_processed=job.bytes_processed,
        total_bytes=job.size_bytes,
        speed_bytes_per_second=speed,
        estimated_seconds_remaining=estimated,
        current_stage=job.status,
        error_message=job.error_message
    )

@router.post("/{job_id}/abort")
def abort_job(job_id: str, db: Session = Depends(get_db)):
    # V1 Limitation: Since we use pure Python synchronous blocking writes (os.write in a loop),
    # gracefully interrupting a thread is complex without event flags. 
    # For now, we update the DB to ABORTED, but the thread might continue until its next check.
    # A true abort would pass an Event to the `execute` method.
    job = db.query(SanitizationJob).filter(SanitizationJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    if job.status in ["COMPLETED", "FAILED", "ABORTED"]:
        return {"status": job.status, "message": "Job already finished."}
        
    job.status = "ABORTED"
    job.error_message = "User requested abort."
    db.commit()
    return {"status": "ABORTED", "message": "Abort signal sent."}

@router.get("/{job_id}/certificate")
def get_sanitization_certificate(job_id: str, db: Session = Depends(get_db)):
    """Download the forensic sanitization certificate as a PDF report."""
    job = db.query(SanitizationJob).filter(SanitizationJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job.certificate_path and os.path.exists(job.certificate_path):
        return FileResponse(
            job.certificate_path,
            media_type="application/pdf",
            filename=f"certificate_{job.job_id}.pdf"
        )

    # Fallback to reports folder
    fallback_pdf = os.path.join("reports", f"certificate_{job.job_id}.pdf")
    if os.path.exists(fallback_pdf):
        return FileResponse(
            fallback_pdf,
            media_type="application/pdf",
            filename=f"certificate_{job.job_id}.pdf"
        )

    fallback_json = os.path.join("reports", f"report_{job.job_id}.json")
    if os.path.exists(fallback_json):
        return FileResponse(
            fallback_json,
            media_type="application/json",
            filename=f"report_{job.job_id}.json"
        )

    raise HTTPException(status_code=404, detail="Certificate file not found or not yet generated.")
