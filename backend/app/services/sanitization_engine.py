import traceback
from datetime import datetime
import logging

from sqlalchemy.orm import Session

from app.models.sanitization import SanitizationJob
from app.services.device_safety import DeviceSafetyValidator
from app.services.sanitization_methods import FileOverwriteMethod, FileZeroOverwriteMethod
from app.services.sanitization_verifier import SanitizationVerifier
from app.services.sanitization_logger import SanitizationLogger
from app.services.sanitization_certificate import SanitizationCertificateGenerator
from app.database.database import SessionLocal
import os

logger = logging.getLogger(__name__)

class SanitizationEngine:
    """Orchestrates the complete, secure sanitization workflow in the background."""
    
    @staticmethod
    def _update_job_status(db: Session, job: SanitizationJob, status: str, error_msg: str = None):
        job.status = status
        if error_msg:
            job.error_message = error_msg
        if status in ["COMPLETED", "FAILED", "ABORTED"]:
            job.completed_at = datetime.utcnow()
        db.commit()

    @staticmethod
    def run_sanitization_job(job_id_db: int):
        """The background worker function."""
        
        # We need a fresh DB session for the background task
        db: Session = SessionLocal()
        
        try:
            job = db.query(SanitizationJob).filter(SanitizationJob.id == job_id_db).first()
            if not job:
                logger.error(f"Job {job_id_db} not found in DB.")
                return
                
            SanitizationLogger.log_event(db, job.id, job.device_id, "JOB_STARTED", f"Background sanitization job {job.job_id} started.")
            
            # --- STAGE: SAFETY VALIDATION ---
            SanitizationEngine._update_job_status(db, job, "VALIDATING")
            SanitizationLogger.log_event(db, job.id, job.device_id, "SAFETY_CHECK_STARTED", "Starting independent safety validation.")
            
            validation = DeviceSafetyValidator.validate_for_sanitization(job.device_id)
            if not validation["safe"]:
                SanitizationLogger.log_event(db, job.id, job.device_id, "SAFETY_CHECK_FAILED", f"Validation failed: {validation['warnings']}", "ERROR")
                SanitizationEngine._update_job_status(db, job, "ABORTED", "Failed safety validation just before execution.")
                return
                
            SanitizationLogger.log_event(db, job.id, job.device_id, "SAFETY_CHECK_PASSED", "Device identity and safety checks passed.")
            
            # Resolve absolute target path
            mount_point = validation.get("mount_point")
            if not mount_point or not job.target_file_path:
                SanitizationEngine._update_job_status(db, job, "ABORTED", "Missing mount point or target file path.")
                return
            
            # Remove leading slash from target_file_path if it exists to avoid os.path.join replacing the root
            clean_target = job.target_file_path.lstrip('/')
            abs_target_path = os.path.join(mount_point, clean_target)
            
            if not os.path.exists(abs_target_path):
                SanitizationEngine._update_job_status(db, job, "ABORTED", f"Target file does not exist: {clean_target}")
                return
                
            # Update job size to match the file, not the disk
            try:
                job.size_bytes = os.path.getsize(abs_target_path)
                db.commit()
            except Exception as e:
                SanitizationEngine._update_job_status(db, job, "ABORTED", f"Could not read file size: {str(e)}")
                return
            
            # --- STAGE: SANITIZING ---
            SanitizationEngine._update_job_status(db, job, "SANITIZING")
            job.started_at = datetime.utcnow()
            db.commit()
            SanitizationLogger.log_event(db, job.id, job.device_id, "SANITIZATION_STARTED", f"Starting {job.method} ({job.pattern}) on {clean_target}.")
            
            # Define progress callback
            def progress_callback(processed: int, total: int, speed: float):
                # Update DB every so often
                job.bytes_processed = processed
                job.progress_percent = (processed / total) * 100 if total > 0 else 0
                db.commit()
                # We could log progress events, but they are spammy.
                
            try:
                # Instantiate method based on string
                if job.method == "overwrite":
                    method = FileOverwriteMethod(abs_target_path, job.size_bytes, pattern=job.pattern or "zero")
                else:
                    raise ValueError(f"Unsupported method/pattern: {job.method}/{job.pattern}")
                    
                method.execute(progress_callback)
                SanitizationLogger.log_event(db, job.id, job.device_id, "SANITIZATION_COMPLETED", "File overwritten and deleted.")
                
            except Exception as e:
                SanitizationLogger.log_event(db, job.id, job.device_id, "SANITIZATION_WRITE_ERROR", f"Write error: {str(e)}", "ERROR")
                SanitizationEngine._update_job_status(db, job, "FAILED", f"Write error: {str(e)}")
                return
                
            # --- STAGE: VERIFYING ---
            SanitizationEngine._update_job_status(db, job, "VERIFYING")
            SanitizationLogger.log_event(db, job.id, job.device_id, "VERIFICATION_STARTED", "Starting file absence verification.")
            
            verify_res = SanitizationVerifier.verify_file_erased(abs_target_path)
            
            job.verification_method = verify_res["method"]
            job.verification_scope = verify_res["scope"]
            job.verification_result = verify_res["status"]
            db.commit()
            
            if verify_res["status"] == "PASSED":
                SanitizationLogger.log_event(db, job.id, job.device_id, "VERIFICATION_COMPLETED", "Verification passed.")
                
                # Generate Certificates (Phase 14 & 15)
                try:
                    cert_data = SanitizationCertificateGenerator.generate_reports(job)
                    job.certificate_path = cert_data["pdf_path"]
                    job.certificate_hash = cert_data["pdf_hash"]
                    db.commit()
                    SanitizationLogger.log_event(db, job.id, job.device_id, "REPORT_GENERATED", f"Certificates generated: {cert_data['json_hash']}")
                except Exception as cert_err:
                    logger.error(f"Failed to generate certificates: {cert_err}")
                    SanitizationLogger.log_event(db, job.id, job.device_id, "REPORT_ERROR", f"Failed to generate certs: {cert_err}", "WARNING")
                    
                SanitizationEngine._update_job_status(db, job, "COMPLETED")
            else:
                SanitizationLogger.log_event(db, job.id, job.device_id, "VERIFICATION_FAILED", f"Verification failed: {verify_res.get('reason')}", "ERROR")
                SanitizationEngine._update_job_status(db, job, "FAILED", f"Verification failed: {verify_res.get('reason')}")
                return
                
        except Exception as e:
            logger.error(f"Critical engine failure: {traceback.format_exc()}")
            # Attempt to mark failed
            try:
                job = db.query(SanitizationJob).filter(SanitizationJob.id == job_id_db).first()
                if job:
                    SanitizationEngine._update_job_status(db, job, "FAILED", "Critical engine exception.")
            except:
                pass
        finally:
            db.close()
