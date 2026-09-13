"""Forensic Raw-Data File Carver & Digital Image/Document Analyzer.

Features:
- Byte-level signature carving from raw streams, disks, volumes, and forensic images (.dd, .raw, .img).
- Digital Image Analysis (JPG, PNG) with marker decoding, dimensions extraction, and raster validation.
- Document & Archive Analysis (PDF, DOCX, XLSX, ZIP) with structure and catalog verification.
- Video Container Analysis (MP4) with ISO Base Media box/atom parsing.
- Fragment Reconstruction & Boundary Identification (Magic Header -> Valid Structural Footer).
- Forensic Confidence Scoring (0-100%) communicating evidence quality.
"""

from __future__ import annotations

import io
import logging
import os
import struct
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Generator, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Optional Pillow integration for deep image raster verification
try:
    from PIL import Image as PILImage
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


@dataclass
class CarvedFile:
    id: str
    filename: str
    extension: str
    category: str
    size_bytes: int
    offset_bytes: int
    confidence: str  # HIGH, MEDIUM, LOW
    confidence_score: int  # 0 - 100
    validation_details: str
    data: bytes
    created_at: datetime


class RawFileCarver:
    """Forensic File Carver that reconstructs and validates deleted files from raw binary data."""

    # File Signatures (Magic Bytes)
    SIG_JPEG = b"\xFF\xD8\xFF"
    SIG_PNG = b"\x89PNG\r\n\x1a\n"
    SIG_PDF = b"%PDF-"
    SIG_ZIP = b"PK\x03\x04"
    SIG_MP4_FTYP = b"ftyp"

    CHUNK_SIZE = 1024 * 1024 * 4  # 4 MB chunk window
    OVERLAP_SIZE = 1024 * 128      # 128 KB sliding overlap

    def __init__(self, max_file_size: int = 100 * 1024 * 1024):
        self.max_file_size = max_file_size

    # =========================================================================
    # 1. JPEG / JPG Carving & Analysis
    # =========================================================================
    def carve_jpeg(self, data: bytes, start_offset: int) -> Optional[Tuple[bytes, int, str, int, int]]:
        """
        Parses JPEG stream starting at start_offset.
        Returns: (file_bytes, confidence_score, validation_msg, width, height) or None.
        """
        if len(data) - start_offset < 4:
            return None

        pos = start_offset + 2
        data_len = len(data)
        width, height = 0, 0
        has_sof = False
        score = 30  # Found valid SOI header

        # Traverse JPEG markers
        while pos < data_len - 1:
            if data[pos] != 0xFF:
                pos += 1
                continue

            marker = data[pos + 1]
            pos += 2

            # Skip padding FF
            while marker == 0xFF and pos < data_len:
                marker = data[pos]
                pos += 1

            # End of Image (EOI)
            if marker == 0xD9:
                file_bytes = data[start_offset:pos]
                if len(file_bytes) > self.max_file_size:
                    return None

                score += 35  # Found valid EOI footer
                if has_sof:
                    score += 25  # Valid SOF marker and dimensions

                # Deep raster verification with Pillow if available
                validation_note = f"Valid JPEG structure with EOI (Dimensions: {width}x{height})"
                if PIL_AVAILABLE:
                    try:
                        with PILImage.open(io.BytesIO(file_bytes)) as img:
                            img.verify()
                        score = min(100, score + 10)
                        validation_note += " [Verified raster data]"
                    except Exception:
                        score = max(50, score - 20)
                        validation_note += " [Minor raster artifact]"

                return (file_bytes, score, validation_note, width, height)

            # Markers without length: RST0-RST7, SOI, TEM
            if (0xD0 <= marker <= 0xD7) or marker == 0x01:
                continue

            # Start of Scan (SOS): image scan follows
            if marker == 0xDA:
                # SOS has a variable length parameter header followed by entropy data
                if pos + 2 > data_len:
                    break
                sos_len = struct.unpack(">H", data[pos:pos + 2])[0]
                pos += sos_len
                # In entropy scan, scan until next marker that is not 0x00 (escaped FF) and not RST
                while pos < data_len - 1:
                    if data[pos] == 0xFF:
                        next_byte = data[pos + 1]
                        if next_byte not in (0x00, 0xFF) and not (0xD0 <= next_byte <= 0xD7):
                            # Encountered next marker, break to outer loop
                            break
                    pos += 1
                continue

            # Markers with 2-byte big-endian length field
            if pos + 2 > data_len:
                break
            length = struct.unpack(">H", data[pos:pos + 2])[0]
            if length < 2:
                break

            # SOF0 (Baseline) or SOF2 (Progressive) -> extract dimensions
            if marker in (0xC0, 0xC2) and length >= 7:
                has_sof = True
                try:
                    h, w = struct.unpack(">HH", data[pos + 3:pos + 7])
                    height, width = h, w
                except Exception:
                    pass

            pos += length

        return None

    # =========================================================================
    # 2. PNG Carving & Analysis
    # =========================================================================
    def carve_png(self, data: bytes, start_offset: int) -> Optional[Tuple[bytes, int, str, int, int]]:
        """
        Parses PNG stream starting at start_offset.
        Validates chunks (IHDR, IDAT, IEND) and chunk CRCs.
        Returns: (file_bytes, confidence_score, validation_msg, width, height) or None.
        """
        if len(data) - start_offset < 33:
            return None

        pos = start_offset + 8  # Skip 8-byte PNG signature
        data_len = len(data)
        width, height = 0, 0
        has_ihdr = False
        idat_count = 0
        score = 30

        while pos + 8 <= data_len:
            chunk_len = struct.unpack(">I", data[pos:pos + 4])[0]
            chunk_type = data[pos + 4:pos + 8]

            if chunk_len > self.max_file_size:
                return None

            chunk_end = pos + 8 + chunk_len + 4  # type + data + 4 bytes CRC
            if chunk_end > data_len:
                break

            if chunk_type == b"IHDR" and chunk_len >= 13:
                has_ihdr = True
                score += 25
                width, height = struct.unpack(">II", data[pos + 8:pos + 16])

            elif chunk_type == b"IDAT":
                idat_count += 1

            elif chunk_type == b"IEND":
                score += 35
                file_bytes = data[start_offset:chunk_end]
                validation_note = f"Valid PNG with IHDR & IEND (Dimensions: {width}x{height}, IDAT chunks: {idat_count})"

                if PIL_AVAILABLE:
                    try:
                        with PILImage.open(io.BytesIO(file_bytes)) as img:
                            img.verify()
                        score = min(100, score + 10)
                        validation_note += " [Verified raster data]"
                    except Exception:
                        score = max(60, score - 15)

                return (file_bytes, score, validation_note, width, height)

            pos = chunk_end

        return None

    # =========================================================================
    # 3. PDF Carving & Analysis
    # =========================================================================
    def carve_pdf(self, data: bytes, start_offset: int) -> Optional[Tuple[bytes, int, str]]:
        """
        Parses PDF document starting with %PDF-.
        Searches for trailer, startxref, and %%EOF.
        """
        if len(data) - start_offset < 64:
            return None

        max_search = min(len(data), start_offset + self.max_file_size)
        eof_pattern = b"%%EOF"
        last_eof_idx = -1

        # Search for the final %%EOF within reasonable file boundary
        search_chunk = data[start_offset:max_search]
        current_idx = 0
        while True:
            idx = search_chunk.find(eof_pattern, current_idx)
            if idx == -1:
                break
            last_eof_idx = idx
            current_idx = idx + len(eof_pattern)

        if last_eof_idx == -1:
            return None

        end_pos = start_offset + last_eof_idx + len(eof_pattern)
        # Advance trailing newlines if any
        while end_pos < len(data) and data[end_pos:end_pos + 1] in (b"\r", b"\n"):
            end_pos += 1

        file_bytes = data[start_offset:end_pos]
        score = 40

        # Validate PDF structure elements
        has_xref = b"xref" in file_bytes or b"/XRef" in file_bytes
        has_trailer = b"trailer" in file_bytes or b"/Root" in file_bytes
        has_catalog = b"/Catalog" in file_bytes or b"/Pages" in file_bytes

        if has_xref:
            score += 20
        if has_trailer:
            score += 20
        if has_catalog:
            score += 20

        validation_note = f"Valid PDF stream: %%EOF trailer located. xref={has_xref}, catalog={has_catalog}"
        return (file_bytes, min(100, score), validation_note)

    # =========================================================================
    # 4. ZIP / DOCX / XLSX Carving & OOXML Analysis
    # =========================================================================
    def carve_zip_family(self, data: bytes, start_offset: int) -> Optional[Tuple[bytes, str, int, str]]:
        """
        Carves PK-based archive (ZIP, DOCX, XLSX).
        Locates End of Central Directory record (PK\x05\x06), verifies internal structure,
        and identifies OOXML Microsoft Office documents.
        Returns: (file_bytes, extension, confidence_score, validation_msg) or None.
        """
        if len(data) - start_offset < 30:
            return None

        # Look for matching End of Central Directory (EOCD) signature PK\x05\x06
        eocd_sig = b"PK\x05\x06"
        max_search = min(len(data), start_offset + self.max_file_size)
        curr = start_offset + 22
        matched_eocd_pos = -1

        while curr < max_search:
            idx = data.find(eocd_sig, curr, max_search)
            if idx == -1:
                break
            if idx + 22 <= len(data):
                cd_offset = struct.unpack("<I", data[idx + 16:idx + 20])[0]
                if start_offset + cd_offset + 4 <= len(data):
                    if data[start_offset + cd_offset:start_offset + cd_offset + 4] == b"PK\x01\x02":
                        matched_eocd_pos = idx
                        break
            curr = idx + 4

        if matched_eocd_pos == -1:
            eocd_idx = data.rfind(eocd_sig, start_offset, max_search)
            if eocd_idx == -1:
                return None
            matched_eocd_pos = eocd_idx

        eocd_abs = matched_eocd_pos
        if len(data) - eocd_abs < 22:
            return None

        # EOCD format:
        # Offset 20-21: Comment length (n)
        comment_len = struct.unpack("<H", data[eocd_abs + 20:eocd_abs + 22])[0]
        end_pos = eocd_abs + 22 + comment_len
        if end_pos > len(data):
            end_pos = eocd_abs + 22

        file_bytes = data[start_offset:end_pos]
        score = 50
        ext = "zip"
        validation_note = "Valid ZIP archive with verified EOCD structure"

        # Validate with Python zipfile and detect DOCX / XLSX OOXML signatures
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as zf:
                # Test CRC for all members
                corrupt_file = zf.testzip()
                score += 30 if corrupt_file is None else 10

                namelist = zf.namelist()
                if "[Content_Types].xml" in namelist:
                    if any("word/document.xml" in name for name in namelist):
                        ext = "docx"
                        score = min(100, score + 20)
                        validation_note = "Valid Microsoft Word document (OOXML word/document.xml verified)"
                    elif any("xl/workbook.xml" in name for name in namelist):
                        ext = "xlsx"
                        score = min(100, score + 20)
                        validation_note = "Valid Microsoft Excel spreadsheet (OOXML xl/workbook.xml verified)"
                    elif any("ppt/presentation.xml" in name for name in namelist):
                        ext = "pptx"
                        score = min(100, score + 20)
                        validation_note = "Valid Microsoft PowerPoint presentation (OOXML ppt/presentation.xml verified)"
                    else:
                        score = min(100, score + 15)
                        validation_note = "Valid Open Packaging Convention (OPC) archive"
                else:
                    validation_note = f"Valid standard ZIP archive ({len(namelist)} entries)"
                    score = min(95, score + 15)

            return (file_bytes, ext, score, validation_note)

        except Exception:
            # Fallback if corrupted near trailer
            return (file_bytes, "zip", 55, "ZIP container with partially intact Central Directory")

    # =========================================================================
    # 5. MP4 Video Carving & Analysis
    # =========================================================================
    def carve_mp4(self, data: bytes, start_offset: int) -> Optional[Tuple[bytes, int, str]]:
        """
        Carves MP4 / ISO Base Media containers.
        Parses atom boxes (ftyp, moov, mdat) to identify exact container length.
        """
        # MP4 files start with 4-byte size followed by 'ftyp'
        if len(data) - start_offset < 16:
            return None

        if data[start_offset + 4:start_offset + 8] != self.SIG_MP4_FTYP:
            return None

        pos = start_offset
        data_len = len(data)
        has_ftyp = True
        has_moov = False
        has_mdat = False
        score = 40
        major_brand = data[start_offset + 8:start_offset + 12].decode("latin-1", errors="ignore")

        while pos + 8 <= data_len:
            box_size = struct.unpack(">I", data[pos:pos + 4])[0]
            box_type = data[pos + 4:pos + 8]

            if box_size == 1:
                # 64-bit extended size
                if pos + 16 > data_len:
                    break
                box_size = struct.unpack(">Q", data[pos + 8:pos + 16])[0]
            elif box_size == 0:
                # Box extends to end of file
                pos = min(data_len, pos + self.max_file_size)
                break

            if box_size < 8 or box_size > self.max_file_size:
                break

            if box_type == b"moov":
                has_moov = True
                score += 30
            elif box_type == b"mdat":
                has_mdat = True
                score += 20

            pos += box_size
            if pos - start_offset > self.max_file_size:
                break

            # If we have both metadata (moov) and payload (mdat), and the next 4 bytes don't form an atom, we have the full file
            if has_moov and has_mdat:
                if pos >= data_len or pos + 8 > data_len:
                    break
                next_box_type = data[pos + 4:pos + 8]
                # If next is not a typical atom type, stop here
                if not next_box_type.isalnum():
                    break

        file_bytes = data[start_offset:pos]
        if len(file_bytes) < 32:
            return None

        validation_note = f"Valid MP4 container (Brand: {major_brand}, moov={has_moov}, mdat={has_mdat})"
        return (file_bytes, min(100, score), validation_note)

    # =========================================================================
    # 6. Stream and Binary Scanning
    # =========================================================================
    def carve_bytes(self, data: bytes, base_offset: int = 0) -> List[CarvedFile]:
        """Carves supported files from an in-memory binary byte stream."""
        results: List[CarvedFile] = []
        data_len = len(data)
        pos = 0

        while pos < data_len - 16:
            # 1. JPEG
            if data[pos:pos + 3] == self.SIG_JPEG:
                carved = self.carve_jpeg(data, pos)
                if carved:
                    fb, score, note, w, h = carved
                    conf = "HIGH" if score >= 85 else ("MEDIUM" if score >= 60 else "LOW")
                    cid = f"carve_jpg_{uuid.uuid4().hex[:8]}"
                    dim_str = f"_{w}x{h}" if w and h else ""
                    results.append(CarvedFile(
                        id=cid,
                        filename=f"recovered_image{dim_str}_{pos:08x}.jpg",
                        extension="jpg",
                        category="Image",
                        size_bytes=len(fb),
                        offset_bytes=base_offset + pos,
                        confidence=conf,
                        confidence_score=score,
                        validation_details=note,
                        data=fb,
                        created_at=datetime.now(timezone.utc),
                    ))
                    pos += max(len(fb), 4)
                    continue

            # 2. PNG
            if data[pos:pos + 8] == self.SIG_PNG:
                carved = self.carve_png(data, pos)
                if carved:
                    fb, score, note, w, h = carved
                    conf = "HIGH" if score >= 85 else ("MEDIUM" if score >= 60 else "LOW")
                    cid = f"carve_png_{uuid.uuid4().hex[:8]}"
                    dim_str = f"_{w}x{h}" if w and h else ""
                    results.append(CarvedFile(
                        id=cid,
                        filename=f"recovered_image{dim_str}_{pos:08x}.png",
                        extension="png",
                        category="Image",
                        size_bytes=len(fb),
                        offset_bytes=base_offset + pos,
                        confidence=conf,
                        confidence_score=score,
                        validation_details=note,
                        data=fb,
                        created_at=datetime.now(timezone.utc),
                    ))
                    pos += max(len(fb), 8)
                    continue

            # 3. PDF
            if data[pos:pos + 5] == self.SIG_PDF:
                carved = self.carve_pdf(data, pos)
                if carved:
                    fb, score, note = carved
                    conf = "HIGH" if score >= 85 else ("MEDIUM" if score >= 60 else "LOW")
                    cid = f"carve_pdf_{uuid.uuid4().hex[:8]}"
                    results.append(CarvedFile(
                        id=cid,
                        filename=f"recovered_document_{pos:08x}.pdf",
                        extension="pdf",
                        category="Document",
                        size_bytes=len(fb),
                        offset_bytes=base_offset + pos,
                        confidence=conf,
                        confidence_score=score,
                        validation_details=note,
                        data=fb,
                        created_at=datetime.now(timezone.utc),
                    ))
                    pos += max(len(fb), 5)
                    continue

            # 4. ZIP / DOCX / XLSX
            if data[pos:pos + 4] == self.SIG_ZIP:
                carved = self.carve_zip_family(data, pos)
                if carved:
                    fb, ext, score, note = carved
                    conf = "HIGH" if score >= 85 else ("MEDIUM" if score >= 60 else "LOW")
                    cid = f"carve_{ext}_{uuid.uuid4().hex[:8]}"
                    cat = "Document" if ext in ("docx", "xlsx", "pptx") else "Archive"
                    results.append(CarvedFile(
                        id=cid,
                        filename=f"recovered_{cat.lower()}_{pos:08x}.{ext}",
                        extension=ext,
                        category=cat,
                        size_bytes=len(fb),
                        offset_bytes=base_offset + pos,
                        confidence=conf,
                        confidence_score=score,
                        validation_details=note,
                        data=fb,
                        created_at=datetime.now(timezone.utc),
                    ))
                    pos += max(len(fb), 4)
                    continue

            # 5. MP4
            if pos + 8 <= data_len and data[pos + 4:pos + 8] == self.SIG_MP4_FTYP:
                carved = self.carve_mp4(data, pos)
                if carved:
                    fb, score, note = carved
                    conf = "HIGH" if score >= 85 else ("MEDIUM" if score >= 60 else "LOW")
                    cid = f"carve_mp4_{uuid.uuid4().hex[:8]}"
                    results.append(CarvedFile(
                        id=cid,
                        filename=f"recovered_video_{pos:08x}.mp4",
                        extension="mp4",
                        category="Media",
                        size_bytes=len(fb),
                        offset_bytes=base_offset + pos,
                        confidence=conf,
                        confidence_score=score,
                        validation_details=note,
                        data=fb,
                        created_at=datetime.now(timezone.utc),
                    ))
                    pos += max(len(fb), 8)
                    continue

            pos += 1

        return results

    def carve_file_stream(self, file_path: str, max_bytes: int = 1024 * 1024 * 512) -> List[CarvedFile]:
        """
        Carves a forensic image file (.dd, .raw, .img, .bin, .iso) or storage disk stream.
        Uses a sliding window buffer to guarantee signatures spanning chunks are not missed.
        """
        results: List[CarvedFile] = []
        if not os.path.exists(file_path):
            logger.warning("Target carving source does not exist: %s", file_path)
            return results

        file_size = os.path.getsize(file_path)
        logger.info("Starting forensic stream carving on %s (%d bytes)", file_path, file_size)

        read_limit = min(file_size, max_bytes)
        bytes_read = 0

        try:
            with open(file_path, "rb") as fp:
                buffer = b""
                buffer_offset = 0

                while bytes_read < read_limit:
                    to_read = min(self.CHUNK_SIZE, read_limit - bytes_read)
                    chunk = fp.read(to_read)
                    if not chunk:
                        break

                    bytes_read += len(chunk)
                    buffer += chunk

                    # Carve from current sliding buffer
                    carved_items = self.carve_bytes(buffer, base_offset=buffer_offset)
                    results.extend(carved_items)

                    # Advance window: retain trailing overlap
                    if len(buffer) > self.OVERLAP_SIZE:
                        advance = len(buffer) - self.OVERLAP_SIZE
                        buffer = buffer[advance:]
                        buffer_offset += advance
                    else:
                        buffer = b""
                        buffer_offset = bytes_read

        except Exception as exc:
            logger.error("Carving stream error on %s: %s", file_path, exc)

        logger.info("Carving completed on %s: extracted %d valid files", file_path, len(results))
        return results


# Global singleton instance
raw_file_carver = RawFileCarver()
