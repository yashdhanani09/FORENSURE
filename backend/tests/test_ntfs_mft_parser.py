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
