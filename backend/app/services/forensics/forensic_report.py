import os
import json
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.models.forensic import ForensicCase, EvidenceItem, RecoveredFile, ChainOfCustodyEvent

class ForensicReportGenerator:

    @staticmethod
    def generate_json_report(db: Session, case_id: str, output_path: str) -> str:
        case = db.query(ForensicCase).filter(ForensicCase.case_id == case_id).first()
        if not case:
            raise Exception("Case not found.")
            
        evidence = db.query(EvidenceItem).filter(EvidenceItem.case_id == case.id).all()
        recovered = db.query(RecoveredFile).filter(RecoveredFile.case_id == case.id).all()
        events = db.query(ChainOfCustodyEvent).filter(ChainOfCustodyEvent.case_id == case.id).order_by(ChainOfCustodyEvent.timestamp).all()
        
        data = {
            "case": {
                "case_id": case.case_id,
                "name": case.case_name,
                "description": case.description,
                "status": case.status,
                "created_at": case.created_at.isoformat(),
            },
            "evidence": [{
                "evidence_id": e.evidence_id,
                "device": e.device_id,
                "vendor": e.vendor,
                "model": e.model,
                "serial": e.serial_number,
                "size_bytes": e.size_bytes,
                "image_hash": e.image_hash
            } for e in evidence],
            "recovered_files": [{
                "filename": r.filename,
                "size_bytes": r.size_bytes,
                "status": r.status,
                "method": r.recovery_method,
                "sha256": r.sha256
            } for r in recovered],
            "chain_of_custody": [{
                "timestamp": e.timestamp.isoformat(),
                "event": e.event_type,
                "actor": e.actor,
                "description": e.description
            } for e in events]
        }
        
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
            
        hasher = hashlib.sha256()
        with open(output_path, "rb") as f:
            hasher.update(f.read())
        return hasher.hexdigest()

    @staticmethod
    def generate_pdf_report(db: Session, case_id: str, output_path: str) -> str:
        case = db.query(ForensicCase).filter(ForensicCase.case_id == case_id).first()
        if not case:
            raise Exception("Case not found.")
            
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []
        
        title_style = styles['Title']
        h2 = styles['Heading2']
        normal = styles['Normal']
        
        elements.append(Paragraph(f"Forensic Report: {case.case_id}", title_style))
        elements.append(Spacer(1, 12))
        
        elements.append(Paragraph("Case Information", h2))
        elements.append(Paragraph(f"<b>Name:</b> {case.case_name}", normal))
        elements.append(Paragraph(f"<b>Created:</b> {case.created_at}", normal))
        elements.append(Paragraph(f"<b>Status:</b> {case.status}", normal))
        elements.append(Spacer(1, 12))
        
        evidence = db.query(EvidenceItem).filter(EvidenceItem.case_id == case.id).first()
        if evidence:
            elements.append(Paragraph("Evidence Acquired", h2))
            elements.append(Paragraph(f"<b>Evidence ID:</b> {evidence.evidence_id}", normal))
            elements.append(Paragraph(f"<b>Model:</b> {evidence.vendor} {evidence.model}", normal))
            elements.append(Paragraph(f"<b>Serial:</b> {evidence.serial_number}", normal))
            elements.append(Paragraph(f"<b>Image Hash (SHA-256):</b> {evidence.image_hash}", normal))
            elements.append(Spacer(1, 12))
            
        recovered = db.query(RecoveredFile).filter(RecoveredFile.case_id == case.id).all()
        elements.append(Paragraph(f"Recovered Files ({len(recovered)})", h2))
        if recovered:
            data = [["Filename", "Size", "Method", "Status"]]
            for r in recovered[:50]: # Limit in PDF
                data.append([r.filename, str(r.size_bytes), r.recovery_method, r.status])
            t = Table(data)
            t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), colors.grey),
                                   ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                                   ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                                   ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                                   ('BOTTOMPADDING', (0,0), (-1,0), 12),
                                   ('BACKGROUND', (0,1), (-1,-1), colors.beige),
                                   ('GRID', (0,0), (-1,-1), 1, colors.black)]))
            elements.append(t)
            if len(recovered) > 50:
                elements.append(Paragraph("... (see JSON report for full list)", normal))
        
        elements.append(Spacer(1, 12))
        
        events = db.query(ChainOfCustodyEvent).filter(ChainOfCustodyEvent.case_id == case.id).order_by(ChainOfCustodyEvent.timestamp).all()
        elements.append(Paragraph("Chain of Custody", h2))
        for e in events:
            elements.append(Paragraph(f"[{e.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] <b>{e.event_type}</b> - {e.description}", normal))
            
        doc.build(elements)
        
        hasher = hashlib.sha256()
        with open(output_path, "rb") as f:
            hasher.update(f.read())
        return hasher.hexdigest()
