import io
from datetime import datetime, UTC

from sqlalchemy.orm import Session

from app.schemas.device import DeviceDetail
from app.services.filesystem_analyzer import analyze_device
from app.services.hasher import list_evidence
from app.services.usb_detector import usb_detector

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

def gather_report_data(device_detail: DeviceDetail, db: Session) -> dict:
    """Aggregates all device data for reporting."""
    device_id = device_detail.id
    
    # Try to get analysis, if it fails gracefully continue
    try:
        analysis = analyze_device(device_id)
        analysis_dict = analysis.model_dump()
    except Exception:
        analysis_dict = {"status": "unavailable", "message": "Analysis not performed or failed"}
        
    evidence = list_evidence(db, device_id)
    evidence_list = [ev.model_dump() for ev in evidence]
    
    return {
        "report_generated_at": datetime.now(UTC).isoformat(),
        "device": device_detail.model_dump(),
        "analysis": analysis_dict,
        "evidence_records": evidence_list,
    }


def generate_json_report(device_detail: DeviceDetail, db: Session) -> dict:
    return gather_report_data(device_detail, db)


def generate_pdf_report(device_detail: DeviceDetail, db: Session) -> io.BytesIO:
    data = gather_report_data(device_detail, db)
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    h2_style = styles['Heading2']
    normal_style = styles['Normal']
    
    elements = []
    
    # Title
    elements.append(Paragraph(f"SecureData Audit Report", title_style))
    elements.append(Spacer(1, 12))
    
    elements.append(Paragraph(f"Generated at: {data['report_generated_at']}", normal_style))
    elements.append(Spacer(1, 24))
    
    # Device Identity
    elements.append(Paragraph("Device Identity", h2_style))
    device = data['device']
    dev_data = [
        ["Vendor", device.get('vendor') or 'N/A'],
        ["Model", device.get('model') or 'N/A'],
        ["Serial", device.get('serial') or 'N/A'],
        ["Capacity (Bytes)", str(device.get('capacity_bytes', 0))],
        ["Device Path", device.get('device_path') or 'N/A']
    ]
    
    t_dev = Table(dev_data, colWidths=[150, 350])
    t_dev.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(t_dev)
    elements.append(Spacer(1, 24))
    
    # Partitions
    elements.append(Paragraph("Partitions", h2_style))
    partitions = device.get('partitions', [])
    if partitions:
        part_data = [["Path", "Filesystem", "Capacity (Bytes)", "Mount Point"]]
        for p in partitions:
            mounts = p.get('mount_points', [])
            mount_str = ", ".join(mounts) if mounts else "Not mounted"
            part_data.append([
                p.get('device_path', ''),
                p.get('filesystem') or 'Unknown',
                str(p.get('capacity_bytes', 0)),
                mount_str
            ])
            
        t_part = Table(part_data, colWidths=[120, 100, 100, 180])
        t_part.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(t_part)
    else:
        elements.append(Paragraph("No partitions found.", normal_style))
        
    elements.append(Spacer(1, 24))
    
    # Evidence Records
    elements.append(Paragraph("Evidence Records", h2_style))
    evidence = data.get('evidence_records', [])
    if evidence:
        ev_data = [["Path", "SHA-256 Hash", "Logged At"]]
        for e in evidence:
            ev_data.append([
                Paragraph(e.get('path', ''), normal_style),
                Paragraph(e.get('sha256', ''), normal_style),
                e.get('created_at', '')[:19]
            ])
            
        t_ev = Table(ev_data, colWidths=[150, 230, 120])
        t_ev.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ]))
        elements.append(t_ev)
    else:
        elements.append(Paragraph("No evidence records logged.", normal_style))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer
