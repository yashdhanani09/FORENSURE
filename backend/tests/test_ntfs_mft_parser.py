import struct
import pytest
from app.services.ntfs_mft_parser import parse_mft_record, scan_mft_records_from_stream, MFT_RECORD_SIZE


def _build_synthetic_deleted_mft_record(filename: str, payload: bytes) -> bytes:
    """Builds a valid synthetic 1024-byte NTFS MFT record for a deleted file."""
    record = bytearray(1024)
    record[:4] = b"FILE"
    
    # 0x14: First attribute offset (0x38 = 56)
    struct.pack_into("<H", record, 20, 56)
    # 0x16: Flags (0x0000 = Deleted file)
    struct.pack_into("<H", record, 22, 0)
    # 0x18: Bytes used
    struct.pack_into("<I", record, 24, 600)
    # 0x2C: Record number
    struct.pack_into("<I", record, 44, 4242)

    # --- Attribute 1: $FILE_NAME (0x30) at offset 56 ---
    attr1_offset = 56
    name_utf16 = filename.encode("utf-16le")
    name_len_chars = len(filename)
    # Body: 66 header bytes + (name_len_chars * 2)
    fn_body_len = 66 + len(name_utf16)
    attr1_total_len = 24 + fn_body_len
    # 8-byte aligned
    if attr1_total_len % 8 != 0:
        attr1_total_len += (8 - (attr1_total_len % 8))

    struct.pack_into("<I", record, attr1_offset, 0x30)           # Attr type 0x30
    struct.pack_into("<I", record, attr1_offset + 4, attr1_total_len) # Attr len
    record[attr1_offset + 8] = 0                                 # Non-resident flag = 0
    struct.pack_into("<I", record, attr1_offset + 16, fn_body_len) # Content len
    struct.pack_into("<H", record, attr1_offset + 20, 24)        # Content offset = 24

    # Fill $FILE_NAME body
    body_start = attr1_offset + 24
    # Modification time at 0x10 (offset 16)
    struct.pack_into("<Q", record, body_start + 16, 133500000000000000)
    # Real size at 0x30 (offset 48)
    struct.pack_into("<Q", record, body_start + 48, len(payload))
    # Filename length in chars at 0x40 (offset 64)
    record[body_start + 64] = name_len_chars
    # Filename utf-16 chars starting at offset 66 (relative to body start)
    record[body_start + 66 : body_start + 66 + len(name_utf16)] = name_utf16

    # --- Attribute 2: $DATA (0x80) ---
    attr2_offset = attr1_offset + attr1_total_len
    attr2_total_len = 24 + len(payload)
    if attr2_total_len % 8 != 0:
        attr2_total_len += (8 - (attr2_total_len % 8))

    struct.pack_into("<I", record, attr2_offset, 0x80)           # Attr type 0x80 ($DATA)
    struct.pack_into("<I", record, attr2_offset + 4, attr2_total_len)
    record[attr2_offset + 8] = 0                                 # Resident
    struct.pack_into("<I", record, attr2_offset + 16, len(payload))
    struct.pack_into("<H", record, attr2_offset + 20, 24)        # Data offset

    record[attr2_offset + 24 : attr2_offset + 24 + len(payload)] = payload

    # --- End Marker (0xFFFFFFFF) ---
    end_offset = attr2_offset + attr2_total_len
    struct.pack_into("<I", record, end_offset, 0xFFFFFFFF)

    return bytes(record)


def test_parse_deleted_mft_record():
    test_text = b"Confidential Forensic Recovered Notes."
    mft_rec = _build_synthetic_deleted_mft_record("evidence_report.txt", test_text)
    
    item = parse_mft_record(mft_rec, offset_bytes=0x1000)
    assert item is not None
    assert item.filename == "evidence_report.txt"
    assert item.size_bytes == len(test_text)
    assert item.data == test_text
    assert item.record_number == 4242


def test_scan_mft_records_stream():
    rec1 = _build_synthetic_deleted_mft_record("doc1.txt", b"First file text")
    rec2 = _build_synthetic_deleted_mft_record("doc2.json", b'{"status": "ok"}')
    stream = b"\x00" * 512 + rec1 + b"\x00" * 1024 + rec2
    
    results = scan_mft_records_from_stream(stream)
    assert len(results) == 2
    assert results[0].filename == "doc1.txt"
    assert results[1].filename == "doc2.json"


def test_decode_data_runs():
    from app.services.ntfs_mft_parser import decode_data_runs
    # Run 1: len_size=1, offset_size=3, len=10, lcn_delta=1000
    # Run 2: len_size=2, offset_size=2, len=25, lcn_delta=50 -> lcn=1050
    # End: 0x00
    encoded = bytes([0x31, 0x0A, 0xE8, 0x03, 0x00, 0x22, 0x19, 0x00, 0x32, 0x00, 0x00])
    runs = decode_data_runs(encoded)
    assert runs == [(1000, 10), (1050, 25)]


def test_parse_non_resident_deleted_mft_record():
    record = bytearray(1024)
    record[:4] = b"FILE"
    struct.pack_into("<H", record, 20, 56)  # First attr offset
    struct.pack_into("<H", record, 22, 0)   # Deleted
    struct.pack_into("<I", record, 24, 300) # Bytes used
    struct.pack_into("<I", record, 44, 999) # Record number

    # $FILE_NAME (0x30)
    attr1_offset = 56
    name = "large_archive.zip"
    name_utf16 = name.encode("utf-16le")
    fn_body_len = 66 + len(name_utf16)
    attr1_total = 24 + fn_body_len + (8 - ((24 + fn_body_len) % 8 or 8))
    struct.pack_into("<I", record, attr1_offset, 0x30)
    struct.pack_into("<I", record, attr1_offset + 4, attr1_total)
    record[attr1_offset + 8] = 0
    struct.pack_into("<I", record, attr1_offset + 16, fn_body_len)
    struct.pack_into("<H", record, attr1_offset + 20, 24)

    body_start = attr1_offset + 24
    struct.pack_into("<Q", record, body_start + 48, 1048576) # Real size = 1MB
    record[body_start + 64] = len(name)
    record[body_start + 65] = 1 # Win32 namespace
    record[body_start + 66 : body_start + 66 + len(name_utf16)] = name_utf16

    # Non-resident $DATA (0x80)
    attr2_offset = attr1_offset + attr1_total
    # Runlist: 1 run (lcn=5000, len=256 clusters)
    runlist = bytes([0x21, 0xFF, 0x88, 0x13, 0x00]) # len=255, lcn_delta=5000
    attr2_total = 64 + len(runlist) + (8 - ((64 + len(runlist)) % 8 or 8))
    struct.pack_into("<I", record, attr2_offset, 0x80)
    struct.pack_into("<I", record, attr2_offset + 4, attr2_total)
    record[attr2_offset + 8] = 1 # Non-resident!
    struct.pack_into("<H", record, attr2_offset + 32, 64) # Runlist offset = 64
    struct.pack_into("<Q", record, attr2_offset + 48, 1048576) # Real size = 1048576
    record[attr2_offset + 64 : attr2_offset + 64 + len(runlist)] = runlist

    item = parse_mft_record(bytes(record))
    assert item is not None
    assert item.filename == "large_archive.zip"
    assert item.size_bytes == 1048576
    assert item.data_runs is not None
    assert len(item.data_runs) == 1
    assert item.data_runs[0][0] == 5000


def test_parse_record0_mft_runs():
    from app.services.ntfs_mft_parser import parse_record0_mft_runs
    record0 = bytearray(1024)
    record0[:4] = b"FILE"
    struct.pack_into("<H", record0, 20, 56)
    struct.pack_into("<H", record0, 22, 1)  # Record 0 is in use
    struct.pack_into("<I", record0, 24, 250)

    attr_offset = 56
    runlist = bytes([0x21, 0x10, 0x00, 0x04, 0x00])  # len=16 clusters, lcn=1024
    attr_total = 64 + len(runlist) + 8
    struct.pack_into("<I", record0, attr_offset, 0x80)  # $DATA
    struct.pack_into("<I", record0, attr_offset + 4, attr_total)
    record0[attr_offset + 8] = 1  # Non-resident
    struct.pack_into("<H", record0, attr_offset + 32, 64)  # Runlist offset
    struct.pack_into("<Q", record0, attr_offset + 48, 65536)  # Real size
    record0[attr_offset + 64 : attr_offset + 64 + len(runlist)] = runlist

    real_sz, runs = parse_record0_mft_runs(bytes(record0))
    assert real_sz == 65536
    assert len(runs) >= 1
    assert runs[0][0] == 1024
    assert runs[0][1] == 16


def test_scan_mft_filtering_noise_and_synthetic():
    """Verifies that scan_mft_records_from_stream filters dev build artifacts and synthetic carver remnants."""
    rec_user = _build_synthetic_deleted_mft_record("Quarterly_Report.docx", b"PK\x03\x04doc")
    rec_map = _build_synthetic_deleted_mft_record("bundle.js.map", b'{"version":3}')
    rec_cjs = _build_synthetic_deleted_mft_record("index.cjs", b"module.exports = {};")
    rec_synth = _build_synthetic_deleted_mft_record("recovered_document_0004a9d3_1.docx", b"\x00" * 100)

    stream = rec_user + rec_map + rec_cjs + rec_synth
    items = scan_mft_records_from_stream(stream, ignore_synthetic=True)

    # Only the authentic user file should be returned
    assert len(items) == 1
    assert items[0].filename == "Quarterly_Report.docx"


