"""NTFS Master File Table (MFT) Record Forensic Carver & Parser.

Parses 1024-byte MFT records directly from raw disk sectors, cluster dumps, or physical volumes.
Extracts deleted file records (where flags & 0x0001 == 0), recovering original filenames ($FILE_NAME 0x30)
and resident payloads ($DATA 0x80) for text files, small documents, and scripts even after
the Recycle Bin has been emptied or Shift+Delete was used.
"""

from __future__ import annotations

import logging
import struct
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

MFT_RECORD_SIZE = 1024
ATTR_FILE_NAME = 0x30
ATTR_DATA = 0x80
ATTR_END = 0xFFFFFFFF


@dataclass
class DeletedMftItem:
    filename: str
    size_bytes: int
    deleted_at: Optional[datetime]
    data: Optional[bytes]
    offset_bytes: int
    is_directory: bool
    record_number: int


def _filetime_to_datetime(filetime: int) -> Optional[datetime]:
    """Converts 64-bit Windows FILETIME (100-nanosecond intervals since Jan 1 1601) to UTC datetime."""
    if filetime <= 0:
        return None
    try:
        return datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=filetime // 10)
    except Exception:
        return None


def parse_mft_record(record_bytes: bytes, offset_bytes: int = 0) -> Optional[DeletedMftItem]:
    """
    Parses a single 1024-byte NTFS MFT record.
    Returns DeletedMftItem if this record belongs to a deleted/unallocated file with a valid name.
    """
    if len(record_bytes) < MFT_RECORD_SIZE:
        return None

    # Verify 'FILE' magic signature
    if record_bytes[:4] != b"FILE":
        return None

    try:
        # Read MFT Record Header fields
        first_attr_offset = struct.unpack("<H", record_bytes[20:22])[0]
        flags = struct.unpack("<H", record_bytes[22:24])[0]
        bytes_used = struct.unpack("<I", record_bytes[24:28])[0]
        record_number = struct.unpack("<I", record_bytes[44:48])[0] if len(record_bytes) >= 48 else 0

        is_in_use = (flags & 0x0001) != 0
        is_directory = (flags & 0x0002) != 0

        # We are specifically hunting for DELETED (unallocated) records
        if is_in_use or is_directory:
            return None

        # Sanity check offsets
        if first_attr_offset >= MFT_RECORD_SIZE or bytes_used > MFT_RECORD_SIZE:
            return None

        curr_offset = first_attr_offset
        extracted_name: Optional[str] = None
        extracted_size: int = 0
        extracted_time: Optional[datetime] = None
        extracted_data: Optional[bytes] = None

        # Loop through record attributes
        while curr_offset + 8 <= min(bytes_used, MFT_RECORD_SIZE):
            attr_type = struct.unpack("<I", record_bytes[curr_offset:curr_offset + 4])[0]
            if attr_type == ATTR_END:
                break

            attr_len = struct.unpack("<I", record_bytes[curr_offset + 4:curr_offset + 8])[0]
            if attr_len <= 0 or curr_offset + attr_len > MFT_RECORD_SIZE:
                break

            non_resident = record_bytes[curr_offset + 8] if curr_offset + 8 < MFT_RECORD_SIZE else 1

            # 1. $FILE_NAME Attribute (0x30)
            if attr_type == ATTR_FILE_NAME and non_resident == 0:
                try:
                    content_offset = struct.unpack("<H", record_bytes[curr_offset + 20:curr_offset + 22])[0]
                    content_len = struct.unpack("<I", record_bytes[curr_offset + 16:curr_offset + 20])[0]
                    content_start = curr_offset + content_offset
                    content_end = content_start + content_len

                    if content_end <= curr_offset + attr_len and content_end <= MFT_RECORD_SIZE:
                        fn_body = record_bytes[content_start:content_end]
                        if len(fn_body) >= 66:
                            # 0x10 Alteration time (modification/deletion)
                            mod_filetime = struct.unpack("<Q", fn_body[16:24])[0]
                            dt = _filetime_to_datetime(mod_filetime)
                            if dt:
                                extracted_time = dt

                            # 0x30 Real size
                            real_size = struct.unpack("<Q", fn_body[48:56])[0]
                            if real_size > 0:
                                extracted_size = real_size

                            # 0x40 (offset 64): Filename length in UTF-16 chars
                            name_len = fn_body[64] if len(fn_body) > 64 else 0
                            name_start = 66
                            name_end = name_start + (name_len * 2)

                            if name_end <= len(fn_body):
                                decoded_name = fn_body[name_start:name_end].decode("utf-16le", errors="ignore").rstrip("\x00")
                                # Avoid system metadata names like $MFT, $Volume, etc.
                                if decoded_name and not decoded_name.startswith("$"):
                                    extracted_name = decoded_name
                except Exception:
                    pass

            # 2. $DATA Attribute (0x80)
            elif attr_type == ATTR_DATA:
                try:
                    if non_resident == 0:
                        data_len = struct.unpack("<I", record_bytes[curr_offset + 16:curr_offset + 20])[0]
                        data_offset = struct.unpack("<H", record_bytes[curr_offset + 20:curr_offset + 22])[0]
                        data_start = curr_offset + data_offset
                        data_end = data_start + data_len

                        if data_end <= curr_offset + attr_len and data_end <= MFT_RECORD_SIZE:
                            extracted_data = record_bytes[data_start:data_end]
                            if extracted_size == 0 or extracted_size > len(extracted_data):
                                extracted_size = data_len
                except Exception:
                    pass

            curr_offset += attr_len

        if extracted_name:
            return DeletedMftItem(
                filename=extracted_name,
                size_bytes=extracted_size,
                deleted_at=extracted_time,
                data=extracted_data,
                offset_bytes=offset_bytes,
                is_directory=False,
                record_number=record_number,
            )

    except Exception as exc:
        logger.debug("Error parsing MFT record at offset 0x%X: %s", offset_bytes, exc)

    return None


def scan_mft_records_from_stream(data: bytes, base_offset: int = 0, max_items: int = 200) -> List[DeletedMftItem]:
    """
    Scans a raw sector buffer for 1024-byte aligned and unaligned 'FILE' MFT records.
    Extracts all valid deleted file records found.
    """
    found_items: List[DeletedMftItem] = []
    seen_names = set()
    data_len = len(data)

    # Standard sector alignment: 512 or 1024 bytes
    step = 512
    pos = 0

    while pos + MFT_RECORD_SIZE <= data_len:
        if data[pos:pos + 4] == b"FILE":
            item = parse_mft_record(data[pos:pos + MFT_RECORD_SIZE], offset_bytes=base_offset + pos)
            if item and item.filename:
                # Filter noise and deduplicate by filename + size
                clean_name = item.filename.strip()
                if clean_name and len(clean_name) > 1:
                    key = (clean_name.lower(), item.size_bytes)
                    if key not in seen_names:
                        seen_names.add(key)
                        found_items.append(item)
                        if len(found_items) >= max_items:
                            break
            pos += MFT_RECORD_SIZE
        else:
            pos += step

    return found_items
