import io
import struct
import zipfile
import zlib
import pytest
from datetime import datetime, timezone

from app.services.file_carver import raw_file_carver, RawFileCarver
from app.services.recovery_service import restore_files, SCANNED_DELETED_CACHE, CARVED_DATA_CACHE
from app.schemas.recovery import DeletedFileItem


def create_minimal_png() -> bytes:
    """Generates a strictly valid 1x1 pixel PNG file."""
    sig = b"\x89PNG\r\n\x1a\n"
    # IHDR: width=1, height=1, bitdepth=8, colortype=2 (RGB), def=0, fil=0, int=0
    ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b"IHDR" + ihdr_data)
    ihdr_chunk = struct.pack(">I", len(ihdr_data)) + b"IHDR" + ihdr_data + struct.pack(">I", ihdr_crc)

    # IDAT: raw scanline (filter 0 + RGB 3 bytes)
    raw_scanline = b"\x00\xFF\x00\x00"
    compressed = zlib.compress(raw_scanline)
    idat_crc = zlib.crc32(b"IDAT" + compressed)
    idat_chunk = struct.pack(">I", len(compressed)) + b"IDAT" + compressed + struct.pack(">I", idat_crc)

    # IEND
    iend_crc = zlib.crc32(b"IEND")
    iend_chunk = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", iend_crc)

    return sig + ihdr_chunk + idat_chunk + iend_chunk


def create_minimal_jpeg() -> bytes:
    """Generates a minimal valid JPEG byte sequence with SOI, SOF0, and EOI."""
    soi = b"\xFF\xD8"
    # DQT
    dqt = b"\xFF\xDB\x00\x43\x00" + (b"\x10" * 64)
    # SOF0 (Baseline, 10x20 pixels, 3 components)
    sof0 = b"\xFF\xC0\x00\x11\x08" + struct.pack(">HH", 20, 10) + b"\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"
    # SOS + minimal entropy
    sos = b"\xFF\xDA\x00\x08\x01\x01\x00\x00\x3F\x00" + b"\x00\x12\x34"
    eoi = b"\xFF\xD9"
    return soi + dqt + sof0 + sos + eoi


def create_minimal_pdf() -> bytes:
    """Generates a valid minimal PDF file."""
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f \n"
        b"0000000010 00000 n \n"
        b"0000000060 00000 n \n"
        b"0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n165\n"
        b"%%EOF\n"
    )


def create_minimal_ooxml(doc_type: str = "docx") -> bytes:
    """Generates a minimal valid OOXML ZIP package (DOCX or XLSX)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types></Types>')
        if doc_type == "docx":
            zf.writestr("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document></w:document>')
        elif doc_type == "xlsx":
            zf.writestr("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8"?><workbook></workbook>')
    return buf.getvalue()


def create_minimal_mp4() -> bytes:
    """Generates a minimal valid MP4 ISO BMFF byte sequence."""
    # ftyp box (size: 16 bytes)
    ftyp = struct.pack(">I", 16) + b"ftypisom" + struct.pack(">I", 512)
    # moov box (size: 8 bytes)
    moov = struct.pack(">I", 8) + b"moov"
    # mdat box (size: 16 bytes)
    mdat = struct.pack(">I", 16) + b"mdat" + b"\x00" * 8
    return ftyp + moov + mdat


def test_carve_jpeg_valid():
    carver = RawFileCarver()
    jpeg_bytes = create_minimal_jpeg()
    stream = b"\xAA\xBB\xCC" + jpeg_bytes + b"\xDD\xEE\xFF"

    carved = carver.carve_bytes(stream)
    assert len(carved) == 1
    item = carved[0]
    assert item.extension == "jpg"
    assert item.category == "Image"
    assert item.confidence in ("HIGH", "MEDIUM")
    assert item.confidence_score >= 80
    assert "JPEG" in item.validation_details
    assert item.data == jpeg_bytes


def test_carve_png_valid():
    carver = RawFileCarver()
    png_bytes = create_minimal_png()
    stream = b"\x00" * 50 + png_bytes + b"\xFF" * 50

    carved = carver.carve_bytes(stream)
    assert len(carved) == 1
    item = carved[0]
    assert item.extension == "png"
    assert item.confidence == "HIGH"
    assert item.confidence_score >= 90
    assert "PNG with IHDR & IEND" in item.validation_details
    assert item.data == png_bytes


def test_carve_pdf_valid():
    carver = RawFileCarver()
    pdf_bytes = create_minimal_pdf()
    stream = b"random_unallocated_slack" + pdf_bytes + b"more_slack"

    carved = carver.carve_bytes(stream)
    assert len(carved) == 1
    item = carved[0]
    assert item.extension == "pdf"
    assert item.category == "Document"
    assert item.confidence in ("HIGH", "MEDIUM")
    assert item.confidence_score >= 80
    assert "%%EOF" in item.validation_details
    assert item.data.startswith(b"%PDF-")


def test_carve_docx_and_xlsx():
    carver = RawFileCarver()
    docx_bytes = create_minimal_ooxml("docx")
    xlsx_bytes = create_minimal_ooxml("xlsx")
    stream = b"\x00\x01\x02" + docx_bytes + b"\x03\x04\x05" + xlsx_bytes + b"\x06\x07"

    carved = carver.carve_bytes(stream)
    assert len(carved) == 2
    extensions = [c.extension for c in carved]
    assert "docx" in extensions
    assert "xlsx" in extensions

    docx_item = next(c for c in carved if c.extension == "docx")
    assert docx_item.confidence == "HIGH"
    assert docx_item.confidence_score >= 90
    assert "Microsoft Word" in docx_item.validation_details

    xlsx_item = next(c for c in carved if c.extension == "xlsx")
    assert xlsx_item.confidence == "HIGH"
    assert xlsx_item.confidence_score >= 90
    assert "Microsoft Excel" in xlsx_item.validation_details


def test_carve_mp4():
    carver = RawFileCarver()
    mp4_bytes = create_minimal_mp4()
    stream = b"\x99\x88\x77" + mp4_bytes + b"\x11\x22\x33"

    carved = carver.carve_bytes(stream)
    assert len(carved) == 1
    item = carved[0]
    assert item.extension == "mp4"
    assert item.category == "Media"
    assert "isom" in item.validation_details or "MP4" in item.validation_details
    assert item.data == mp4_bytes


def test_restore_carved_file_from_cache(tmp_path):
    fid = "test_carved_123"
    png_bytes = create_minimal_png()

    item = DeletedFileItem(
        id=fid,
        filename="test_photo.png",
        original_path="Physical Volume @ 0x1000",
        source_path=f"carved://{fid}",
        size_bytes=len(png_bytes),
        extension="png",
        category="Image",
        deleted_at=datetime.now(timezone.utc),
        confidence="HIGH",
        confidence_score=98,
        validation_details="Valid PNG with IHDR & IEND",
        recovery_method="raw_carver_png",
        recoverable=True,
    )
    SCANNED_DELETED_CACHE[fid] = item
    CARVED_DATA_CACHE[fid] = png_bytes

    out_folder = str(tmp_path / "recovered")
    restored = restore_files([fid], destination_folder=out_folder)

    assert len(restored) == 1
    res = restored[0]
    assert res.status == "RECOVERED"
    assert res.size_bytes == len(png_bytes)
    assert len(res.sha256) == 64  # valid sha256 hex string

    # Verify restored file on disk matches byte-for-byte
    with open(res.output_path, "rb") as rf:
        saved_bytes = rf.read()
    assert saved_bytes == png_bytes


def test_carve_gif_and_bmp():
    carver = RawFileCarver()
    # GIF89a with 10x20 dimensions + trailer + sector padding
    gif_data = b"GIF89a" + struct.pack("<HH", 10, 20) + b"\x00\x00\x00\x00\x3B" + b"\x00" * 64
    carved_gif = carver.carve_bytes(gif_data)
    assert len(carved_gif) == 1
    assert carved_gif[0].extension == "gif"
    assert carved_gif[0].category == "Image"
    assert "10x20" in carved_gif[0].filename

    # BMP with 32x32 dimensions
    bmp_size = 100
    bmp_data = (
        b"BM" + struct.pack("<I", bmp_size) + b"\x00\x00\x00\x00" +
        struct.pack("<I", 54) + struct.pack("<I", 40) +
        struct.pack("<ii", 32, 32) + b"\x00" * (bmp_size - 26) + b"\x00" * 64
    )
    carved_bmp = carver.carve_bytes(bmp_data)
    assert len(carved_bmp) == 1
    assert carved_bmp[0].extension == "bmp"
    assert carved_bmp[0].category == "Image"


def test_carve_rar_and_rtf():
    carver = RawFileCarver()
    rar_data = b"Rar!\x1a\x07\x01\x00" + b"\x8a\x7c\x1a\x70" + b"\x00" * 1024
    carved_rar = carver.carve_bytes(rar_data)
    assert len(carved_rar) == 1
    assert carved_rar[0].extension == "rar"
    assert carved_rar[0].category == "Archive"

    rtf_data = b"{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Courier;}}\\viewkind4\\uc1\\pard\\f0\\fs20 Hello Forensics!}" + b"\x00" * 64
    carved_rtf = carver.carve_bytes(rtf_data)
    assert len(carved_rtf) == 1
    assert carved_rtf[0].extension == "rtf"
    assert carved_rtf[0].category == "Document"


def test_read_mft_clusters_trim_zero_detection(tmp_path, monkeypatch):
    """Verifies that _read_mft_clusters_to_file detects SSD TRIM zeroing."""
    from app.services.recovery_service import _read_mft_clusters_to_file
    import app.services.recovery_service as rec_mod

    # Mock _read_raw_volume_at_offset to simulate an SSD returning all zeroes
    monkeypatch.setattr(rec_mod, "_read_raw_volume_at_offset", lambda drv, off, sz: b"\x00" * sz)

    out_file = str(tmp_path / "trimmed_test.docx")
    bytes_wr, digest, is_trimmed = _read_mft_clusters_to_file("D:", [(100, 4)], 4096, 16384, out_file)

    assert bytes_wr == 16384
    assert is_trimmed is True  # All zeroes returned -> flagged as trimmed!

    # Now mock with real non-zero payload
    monkeypatch.setattr(rec_mod, "_read_raw_volume_at_offset", lambda drv, off, sz: b"PK\x03\x04" + b"\x00" * (sz - 4))
    bytes_wr2, digest2, is_trimmed2 = _read_mft_clusters_to_file("D:", [(100, 4)], 4096, 16384, out_file)
    assert is_trimmed2 is False  # Non-zero bytes found -> authentic data!


