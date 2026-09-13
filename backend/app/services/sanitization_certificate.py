import json
import hashlib
import os
from datetime import datetime
import logging

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from app.models.sanitization import SanitizationJob

logger = logging.getLogger(__name__)

class SanitizationCertificateGenerator:
    """Generates immutable JSON and PDF reports for successful sanitizations."""
    
    @staticmethod
    def generate_reports(job: SanitizationJob, output_dir: str = "reports") -> dict:
        """
        Generates both JSON and PDF certificates for a completed job.
        Returns a dict containing file paths and SHA-256 hashes.
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Prepare data
        report_data = {
            "certificate_id": f"CERT-{job.job_id}",
            "job_id": job.job_id,
            "device": {
                "device_id": job.device_id,
                "vendor": job.vendor,
                "model": job.model,
                "serial": job.serial_number,
                "capacity_bytes": job.size_bytes,
                "connection": "Storage Device"
            },
            "sanitization": {
                "target_file_path": job.target_file_path or "FULL_DEVICE",
                "method": job.method,
                "pattern": job.pattern,
                "passes": job.passes,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None
            },
            "verification": {
                "method": job.verification_method,
                "scope": job.verification_scope,
                "result": job.verification_result
            },
            "result": job.status,
            "limitations": [
                "Software overwrite cannot guarantee physical NAND-cell erasure on all flash storage due to wear-leveling and spare blocks."
            ]
        }
        
        # Generate JSON
        json_path = os.path.join(output_dir, f"report_{job.job_id}.json")
        with open(json_path, "w") as f:
            json.dump(report_data, f, indent=2)
            
        # Hash JSON
        with open(json_path, "rb") as f:
            json_hash = hashlib.sha256(f.read()).hexdigest()
            
        report_data["json_sha256"] = json_hash
        
        # Generate PDF
        pdf_path = os.path.join(output_dir, f"certificate_{job.job_id}.pdf")
        SanitizationCertificateGenerator._generate_pdf(pdf_path, report_data)
        
        # Hash PDF
        with open(pdf_path, "rb") as f:
            pdf_hash = hashlib.sha256(f.read()).hexdigest()
            
        return {
            "json_path": json_path,
            "json_hash": json_hash,
            "pdf_path": pdf_path,
            "pdf_hash": pdf_hash
        }
        
    @staticmethod
    def _generate_pdf(pdf_path: str, data: dict):
        doc = SimpleDocTemplate(pdf_path, pagesize=letter)
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            alignment=1,
            spaceAfter=20
        )
        
        elements = []
        
        elements.append(Paragraph("SECURE STORAGE SANITIZATION CERTIFICATE", title_style))
        elements.append(Spacer(1, 12))
        
        elements.append(Paragraph(f"<b>Certificate ID:</b> {data['certificate_id']}", styles['Normal']))
        elements.append(Paragraph(f"<b>Job ID:</b> {data['job_id']}", styles['Normal']))
        elements.append(Paragraph(f"<b>Result:</b> {data['result']}", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        elements.append(Paragraph("<b>Device Information</b>", styles['Heading2']))
        dev = data['device']
        device_data = [
            ["Vendor", dev.get('vendor', 'N/A')],
            ["Model", dev.get('model', 'N/A')],
            ["Serial Number", dev.get('serial', 'N/A')],
            ["Device ID", dev.get('device_id', 'N/A')],
            ["Capacity (Bytes)", str(dev.get('capacity_bytes', 0))],
        ]
        t = Table(device_data, colWidths=[150, 300])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))
        
        elements.append(Paragraph("<b>Sanitization & Verification</b>", styles['Heading2']))
        san = data['sanitization']
        ver = data['verification']
        san_data = [
            ["Target File Path", san.get('target_file_path', 'N/A')],
            ["Method", san.get('method')],
            ["Pattern", san.get('pattern')],
            ["Verification Method", ver.get('method')],
            ["Verification Scope", ver.get('scope')],
            ["Verification Result", ver.get('result')],
            ["Completed At", san.get('completed_at')]
        ]
        t2 = Table(san_data, colWidths=[150, 300])
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(t2)
        elements.append(Spacer(1, 20))
        
        elements.append(Paragraph("<b>Limitations</b>", styles['Heading2']))
        for lim in data['limitations']:
            elements.append(Paragraph(f"- {lim}", styles['Normal']))
            
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"<b>JSON Report SHA-256:</b> {data['json_sha256']}", styles['Normal']))
        
        doc.build(elements)
