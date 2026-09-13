import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.sanitization import SanitizationEvent

logger = logging.getLogger(__name__)

class SanitizationLogger:
    """Handles persistent, immutable audit logging for sanitization jobs."""
    
    @staticmethod
    def log_event(db: Session, job_id: int, device_id: str, event_type: str, message: str, severity: str = "INFO"):
        """Logs an event to the database and standard logger."""
        try:
            event = SanitizationEvent(
                job_id=job_id,
                device_id=device_id,
                event_type=event_type,
                message=message,
                severity=severity,
                timestamp=datetime.utcnow()
            )
            db.add(event)
            db.commit()
            
            log_msg = f"[JOB-{job_id}] [{event_type}] {message}"
            if severity == "ERROR":
                logger.error(log_msg)
            elif severity == "WARNING":
                logger.warning(log_msg)
            else:
                logger.info(log_msg)
                
        except Exception as e:
            logger.error(f"Failed to log sanitization event: {e}")
