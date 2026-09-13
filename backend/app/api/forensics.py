import os
import json
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.forensic import ForensicCase, EvidenceItem, ChainOfCustodyEvent, RecoveredFile
from app.schemas.forensic import (
    CaseCreateRequest, CaseResponse, ForensicCaseDetailResponse,
    EvidenceResponse, ChainOfCustodyEventResponse, RecoverRequest, RecoverResponse,
    ForensicJobProgress
)
from app.services.forensic_validator import ForensicValidator
from app.services.forensics.acquisition_engine import AcquisitionEngine
from app.services.forensics.analysis_engine import AnalysisEngine
from app.services.forensics.recovery_engine import RecoveryEngine
from app.services.forensics.forensic_report import ForensicReportGenerator

router = APIRouter(prefix="/forensics", tags=["Forensics"])
logger = logging.getLogger(__name__)

# In-memory job tracker for the prototype
FORENSIC_JOBS: Dict[str, Dict[str, Any]] = {}

def get_job(job_id: str):
    if job_id not in FORENSIC_JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return FORENSIC_JOBS[job_id]

def update_job_progress(job_id: str, bytes_processed: int, total_bytes: int, stage: str):
    if job_id in FORENSIC_JOBS:
        job = FORENSIC_JOBS[job_id]
        job["bytes_processed"] = bytes_processed
        job["total_bytes"] = total_bytes
        job["stage"] = stage
        job["progress_percent"] = (bytes_processed / total_bytes * 100) if total_bytes > 0 else 0
        
        if bytes_processed > 0 and job.get("start_time"):
            elapsed = (datetime.utcnow() - job["start_time"]).total_seconds()
            if elapsed > 0:
                speed = bytes_processed / elapsed
                job["speed_bytes_per_second"] = speed
                job["estimated_seconds_remaining"] = int((total_bytes - bytes_processed) / speed)
        
        if stage == "COMPLETED" or stage == "FAILED":
            job["status"] = stage

def add_coc_event(db: Session, case_id: int, event_type: str, description: str, evidence_id: int = None, hash_val: str = None):
    event = ChainOfCustodyEvent(
        case_id=case_id,
        evidence_id=evidence_id,
        event_type=event_type,
        description=description,
        hash_value=hash_val
    )
    db.add(event)
    db.commit()

@router.post("/cases", response_model=CaseResponse)
def create_case(req: CaseCreateRequest, db: Session = Depends(get_db)):
    case_id = f"CASE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    val = ForensicValidator.validate_for_acquisition(req.device_id)
    if not val["safe"]:
        raise HTTPException(status_code=400, detail=f"Device unsafe for acquisition: {val['warnings']}")
        
    case = ForensicCase(
        case_id=case_id,
        case_name=req.case_name,
        description=req.description
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    
    add_coc_event(db, case.id, "CASE_CREATED", f"Case {case_id} created.")
    
    evidence_id = f"EVD-{uuid.uuid4().hex[:8].upper()}"
    evidence = EvidenceItem(
        evidence_id=evidence_id,
        case_id=case.id,
        device_id=req.device_id,
        vendor=val.get("vendor"),
        model=val.get("model"),
        serial_number=val.get("serial"),
        size_bytes=val.get("size_bytes")
    )
    db.add(evidence)
    db.commit()
    
    add_coc_event(db, case.id, "EVIDENCE_REGISTERED", f"Evidence {evidence_id} registered.", evidence.id)
    
    return case

@router.post("/cases/{case_id}/acquire")
def acquire_evidence(case_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    case = db.query(ForensicCase).filter(ForensicCase.case_id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
        
    evidence = db.query(EvidenceItem).filter(EvidenceItem.case_id == case.id).first()
    if not evidence:
        raise HTTPException(404, "Evidence not found")
        
    val = ForensicValidator.validate_for_acquisition(evidence.device_id)
    if not val["safe"]:
        raise HTTPException(status_code=400, detail=f"Device unsafe: {val['warnings']}")
        
    job_id = f"JOB-{uuid.uuid4().hex[:8]}"
    FORENSIC_JOBS[job_id] = {
        "job_id": job_id, "case_id": case_id, "type": "acquisition",
        "status": "ACQUIRING", "progress_percent": 0, "bytes_processed": 0,
        "total_bytes": evidence.size_bytes, "speed_bytes_per_second": 0,
        "estimated_seconds_remaining": 0, "stage": "PREPARING", "start_time": datetime.utcnow()
    }
    
    case.status = "ACQUIRING"
    db.commit()
    add_coc_event(db, case.id, "ACQUISITION_STARTED", "Read-only acquisition started.", evidence.id)
    
    def run_acquisition():
        with next(get_db()) as db_session:
            try:
                base_dir = os.path.join("evidence", case_id)
                image_path = os.path.join(base_dir, f"{evidence.evidence_id}.img")
                
                final_hash = AcquisitionEngine.acquire_image(
                    device_path=val["device_path"],
                    image_path=image_path,
                    total_size=evidence.size_bytes,
                    progress_callback=lambda b, t, s: update_job_progress(job_id, b, t, s)
                )
                
                db_ev = db_session.query(EvidenceItem).filter(EvidenceItem.id == evidence.id).first()
                db_ev.image_path = image_path
                db_ev.image_hash = final_hash
                
                db_case = db_session.query(ForensicCase).filter(ForensicCase.id == case.id).first()
                db_case.status = "ACQUIRED"
                db_session.commit()
                
                add_coc_event(db_session, case.id, "ACQUISITION_COMPLETED", "Image acquired successfully.", evidence.id, final_hash)
            except Exception as e:
                logger.error(f"Acquisition error: {e}")
                update_job_progress(job_id, 0, 0, "FAILED")
                FORENSIC_JOBS[job_id]["error_message"] = str(e)
                
                db_case = db_session.query(ForensicCase).filter(ForensicCase.id == case.id).first()
                db_case.status = "FAILED"
                db_session.commit()

    background_tasks.add_task(run_acquisition)
    return {"job_id": job_id, "message": "Acquisition started."}

@router.post("/cases/{case_id}/analyze")
def analyze_evidence(case_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    case = db.query(ForensicCase).filter(ForensicCase.case_id == case_id).first()
    evidence = db.query(EvidenceItem).filter(EvidenceItem.case_id == case.id).first()
    
    if not evidence or not evidence.image_path or not os.path.exists(evidence.image_path):
        raise HTTPException(400, "Acquisition required before analysis.")
        
    job_id = f"JOB-{uuid.uuid4().hex[:8]}"
    FORENSIC_JOBS[job_id] = {
        "job_id": job_id, "case_id": case_id, "type": "analysis",
        "status": "ANALYZING", "progress_percent": 0, "bytes_processed": 0,
        "total_bytes": 100, "speed_bytes_per_second": 0,
        "estimated_seconds_remaining": 0, "stage": "PREPARING", "start_time": datetime.utcnow()
    }
    
    case.status = "ANALYZING"
    db.commit()
    add_coc_event(db, case.id, "ANALYSIS_STARTED", "Forensic image analysis started.", evidence.id)
    
    def run_analysis():
        with next(get_db()) as db_session:
            try:
                base_dir = os.path.join("evidence", case_id)
                AnalysisEngine.analyze_image(
                    image_path=evidence.image_path,
                    case_id=case_id,
                    output_dir=base_dir,
                    progress_callback=lambda b, t, s: update_job_progress(job_id, b, t, s)
                )
                db_case = db_session.query(ForensicCase).filter(ForensicCase.id == case.id).first()
                db_case.status = "ANALYZED"
                db_session.commit()
                add_coc_event(db_session, case.id, "ANALYSIS_COMPLETED", "Forensic analysis completed.", evidence.id)
            except Exception as e:
                logger.error(f"Analysis error: {e}")
                update_job_progress(job_id, 0, 0, "FAILED")
                FORENSIC_JOBS[job_id]["error_message"] = str(e)
                
    background_tasks.add_task(run_analysis)
    return {"job_id": job_id, "message": "Analysis started."}

@router.get("/cases/{case_id}/files")
def get_case_files(case_id: str, deleted_only: bool = False):
    index_path = os.path.join("evidence", case_id, f"{case_id}_file_index.json")
    if not os.path.exists(index_path):
        raise HTTPException(404, "Analysis index not found.")
        
    with open(index_path, "r") as f:
        data = json.load(f)
        
    files = data.get("files", [])
    if deleted_only:
        files = [f for f in files if f.get("is_deleted")]
        
    return files

@router.post("/cases/{case_id}/recover", response_model=RecoverResponse)
def recover_files(case_id: str, req: RecoverRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    case = db.query(ForensicCase).filter(ForensicCase.case_id == case_id).first()
    evidence = db.query(EvidenceItem).filter(EvidenceItem.case_id == case.id).first()
    
    if not evidence or not evidence.image_path:
        raise HTTPException(400, "Image required.")
        
    index_path = os.path.join("evidence", case_id, f"{case_id}_file_index.json")
    if not os.path.exists(index_path):
        raise HTTPException(404, "Analysis index not found.")
        
    with open(index_path, "r") as f:
        data = json.load(f)
        
    # Filter requested files
    files_to_recover = [f for f in data.get("files", []) if f.get("path") in req.file_paths]
    
    if req.method == "file_carving":
        files_to_recover = [{"name": "carve"}] # Just a dummy to trigger carving
        
    job_id = f"JOB-{uuid.uuid4().hex[:8]}"
    FORENSIC_JOBS[job_id] = {
        "job_id": job_id, "case_id": case_id, "type": "recovery",
        "status": "RECOVERING", "progress_percent": 0, "bytes_processed": 0,
        "total_bytes": len(files_to_recover), "speed_bytes_per_second": 0,
        "estimated_seconds_remaining": 0, "stage": "PREPARING", "start_time": datetime.utcnow()
    }
    
    add_coc_event(db, case.id, "RECOVERY_STARTED", f"Started {req.method} recovery for {len(req.file_paths)} paths.", evidence.id)
    
    def run_recovery():
        with next(get_db()) as db_session:
            try:
                out_dir = os.path.join("evidence", case_id, "recovered")
                results = RecoveryEngine.recover_files(
                    image_path=evidence.image_path,
                    files_to_recover=files_to_recover,
                    output_dir=out_dir,
                    method=req.method,
                    progress_callback=lambda b, t, s: update_job_progress(job_id, b, t, s)
                )
                
                for r in results:
                    rec_file = RecoveredFile(
                        recovery_id=f"REC-{uuid.uuid4().hex[:8].upper()}",
                        case_id=case.id,
                        evidence_id=evidence.id,
                        filename=os.path.basename(r.get("output_path", "")),
                        original_path=r.get("original_meta", {}).get("path"),
                        output_path=r.get("output_path", ""),
                        size_bytes=r.get("size_bytes", 0),
                        filesystem=r.get("original_meta", {}).get("filesystem"),
                        is_deleted=r.get("original_meta", {}).get("is_deleted", True),
                        recovery_method=req.method,
                        confidence="HIGH" if req.method == "metadata" else "LOW",
                        sha256=r.get("sha256"),
                        status=r.get("status")
                    )
                    db_session.add(rec_file)
                    
                    if r.get("status") == "RECOVERED":
                        add_coc_event(db_session, case.id, "FILE_RECOVERED", f"Recovered {rec_file.filename}", evidence.id, rec_file.sha256)
                
                db_session.commit()
                add_coc_event(db_session, case.id, "RECOVERY_COMPLETED", f"Recovery finished. {len(results)} items processed.", evidence.id)
            except Exception as e:
                logger.error(f"Recovery error: {e}")
                update_job_progress(job_id, 0, 0, "FAILED")
                FORENSIC_JOBS[job_id]["error_message"] = str(e)
                
    background_tasks.add_task(run_recovery)
    return {"message": "Recovery started", "job_id": job_id}

@router.post("/cases/{case_id}/report")
def generate_report(case_id: str, db: Session = Depends(get_db)):
    case = db.query(ForensicCase).filter(ForensicCase.case_id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
        
    base_dir = os.path.join("evidence", case_id, "reports")
    os.makedirs(base_dir, exist_ok=True)
    
    json_path = os.path.join(base_dir, f"report_{case_id}.json")
    pdf_path = os.path.join(base_dir, f"report_{case_id}.pdf")
    
    json_hash = ForensicReportGenerator.generate_json_report(db, case_id, json_path)
    pdf_hash = ForensicReportGenerator.generate_pdf_report(db, case_id, pdf_path)
    
    add_coc_event(db, case.id, "REPORT_GENERATED", "PDF and JSON reports generated", hash_val=pdf_hash)
    
    case.status = "COMPLETED"
    case.completed_at = datetime.utcnow()
    db.commit()
    
    return {"json_hash": json_hash, "pdf_hash": pdf_hash, "json_url": f"/{json_path}", "pdf_url": f"/{pdf_path}"}

@router.get("/jobs/{job_id}", response_model=ForensicJobProgress)
def get_job_status(job_id: str):
    return get_job(job_id)

@router.get("/cases", response_model=List[CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    cases = db.query(ForensicCase).order_by(ForensicCase.created_at.desc()).all()
    return cases

@router.get("/cases/{case_id}", response_model=ForensicCaseDetailResponse)
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(ForensicCase).filter(ForensicCase.case_id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
        
    evidence = db.query(EvidenceItem).filter(EvidenceItem.case_id == case.id).all()
    events = db.query(ChainOfCustodyEvent).filter(ChainOfCustodyEvent.case_id == case.id).order_by(ChainOfCustodyEvent.timestamp.desc()).all()
    
    return {
        "case": case,
        "evidence": evidence,
        "events": events
    }


@router.delete("/cases/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(ForensicCase).filter(ForensicCase.case_id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
        
    import shutil
    base_dir = os.path.join("evidence", case_id)
    if os.path.exists(base_dir):
        try:
            shutil.rmtree(base_dir)
        except Exception as e:
            logger.error(f"Failed to delete evidence directory: {e}")
            
    # SQLAlchemy relationship cascades should handle evidence items, events, and recovered files 
    # if configured, but if not we can manually delete them or rely on DB constraints.
    db.query(ChainOfCustodyEvent).filter(ChainOfCustodyEvent.case_id == case.id).delete()
    db.query(RecoveredFile).filter(RecoveredFile.case_id == case.id).delete()
    db.query(EvidenceItem).filter(EvidenceItem.case_id == case.id).delete()
    db.delete(case)
    db.commit()
    
    return {"message": "Case deleted"}
