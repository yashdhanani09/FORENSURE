import type { DeviceListResponse, UsbDeviceDetail, DeviceAnalysis, FileBrowserResponse, EvidenceListResponse, FileEntry, EvidenceRecord } from "../types/device";
import type { RecoveryScanResponse, RestoreFileResponse, ForensicReportResponse, RecoveredFileRecord } from "./recoveryApi";

export const MOCK_DEVICES: UsbDeviceDetail[] = [
  {
    id: "internal_samsung_nvme_512gb",
    device_path: "\\\\.\\PHYSICALDRIVE0",
    vendor: "Samsung",
    model: "NVMe SSD 980 PRO (Internal Machine Storage)",
    serial: "S5GXNF0R123456K",
    capacity_bytes: 512110190592,
    size_bytes: 512110190592,
    filesystem: "NTFS",
    mount_point: "C:\\",
    removable: false,
    read_only: false,
    transport: "nvme",
    device_type: "INTERNAL_STORAGE",
    system_disk: true,
    is_protected: true,
    is_usb: false,
    analysis_available: true,
    detected_at: new Date().toISOString(),
    partitions: [
      {
        name: "PHYSICALDRIVE0p1",
        device_path: "\\\\.\\PHYSICALDRIVE0p1",
        filesystem: "FAT32",
        label: "SYSTEM_EFI",
        uuid: "C284-91A0",
        capacity_bytes: 104857600,
        mount_points: [],
      },
      {
        name: "PHYSICALDRIVE0p2",
        device_path: "\\\\.\\PHYSICALDRIVE0p2",
        filesystem: "NTFS",
        label: "OS (C:)",
        uuid: "4A21B903-8821",
        capacity_bytes: 209071374336,
        mount_points: ["C:\\"],
      },
      {
        name: "PHYSICALDRIVE0p3",
        device_path: "\\\\.\\PHYSICALDRIVE0p3",
        filesystem: "NTFS",
        label: "DATA (D:)",
        uuid: "8891CA02-3319",
        capacity_bytes: 301735084032,
        mount_points: ["D:\\"],
      },
    ],
  },
  {
    id: "usb_sandisk_extreme_64gb",
    device_path: "\\\\.\\PHYSICALDRIVE1",
    vendor: "SanDisk",
    model: "Extreme USB 3.2 Flash Drive",
    serial: "AA01092837482910",
    capacity_bytes: 64000000000,
    size_bytes: 64000000000,
    filesystem: "exFAT",
    mount_point: "E:\\",
    removable: true,
    read_only: false,
    transport: "usb",
    device_type: "USB_STORAGE",
    system_disk: false,
    is_protected: false,
    is_usb: true,
    analysis_available: true,
    detected_at: new Date().toISOString(),
    partitions: [
      {
        name: "PHYSICALDRIVE1p1",
        device_path: "\\\\.\\PHYSICALDRIVE1p1",
        filesystem: "exFAT",
        label: "EVIDENCE_USB",
        uuid: "8472-9102",
        capacity_bytes: 64000000000,
        mount_points: ["E:\\"],
      },
    ],
  },
  {
    id: "usb_samsung_t7_500gb",
    device_path: "\\\\.\\PHYSICALDRIVE2",
    vendor: "Samsung",
    model: "Portable SSD T7 Shield",
    serial: "S5B1NS0R819283X",
    capacity_bytes: 500107862016,
    size_bytes: 500107862016,
    filesystem: "NTFS",
    mount_point: "F:\\",
    removable: true,
    read_only: false,
    transport: "usb",
    device_type: "USB_STORAGE",
    system_disk: false,
    is_protected: false,
    is_usb: true,
    analysis_available: true,
    detected_at: new Date().toISOString(),
    partitions: [
      {
        name: "PHYSICALDRIVE2p1",
        device_path: "\\\\.\\PHYSICALDRIVE2p1",
        filesystem: "NTFS",
        label: "CASE_STORE",
        uuid: "F4A2D819-0129",
        capacity_bytes: 500107862016,
        mount_points: ["F:\\"],
      },
    ],
  },
  {
    id: "wpd_pixel_8_pro",
    device_path: "\\\\.\\WPD\\USB_VID_18D1_PID_4EE1",
    vendor: "Google",
    model: "Pixel 8 Pro (Internal Storage)",
    serial: "39201JEHN01928",
    capacity_bytes: 128000000000,
    size_bytes: 128000000000,
    filesystem: "MTP",
    mount_point: "\\\\.\\WPD\\Pixel_Storage",
    removable: true,
    read_only: false,
    transport: "usb",
    device_type: "MOBILE_DEVICE",
    system_disk: false,
    is_protected: false,
    is_usb: true,
    analysis_available: true,
    detected_at: new Date().toISOString(),
    partitions: [
      {
        name: "Internal Shared Storage",
        device_path: "\\\\.\\WPD\\Pixel_Storage",
        filesystem: "MTP",
        label: "Phone Storage",
        uuid: null,
        capacity_bytes: 128000000000,
        mount_points: ["\\\\.\\WPD\\Pixel_Storage"],
      },
    ],
  },
];

export const MOCK_DEVICE_LIST_RESPONSE: DeviceListResponse = {
  devices: MOCK_DEVICES,
  refreshed_at: new Date().toISOString(),
  demo_mode: true,
  warning: null,
};

// ── Deleted & Carved Artifacts for Recovery ──────────────────────────────────
export const MOCK_DELETED_FILES: RecoveryScanResponse = {
  device_id: "usb_sandisk_extreme_64gb",
  device_name: "SanDisk Extreme USB 3.2 Flash Drive (E:\\)",
  scan_type: "raw_carver",
  scanned_at: new Date().toISOString(),
  total_found: 5,
  device_profile: {
    vendor: "SanDisk",
    model: "Extreme USB 3.2 Flash Drive",
    serial: "AA01092837482910",
    capacity_bytes: 64000000000,
    filesystem: "exFAT",
    sectors_total: 125000000,
    sector_size: 512,
    cluster_size_bytes: 4096,
  },
  acquisition_hash: "a4f5b2819c43d839201f827394abcdf483920183749281729384729103948572",
  elevation_required: false,
  files: [
    {
      id: "carved_pdf_001",
      filename: "Confidential_Financial_Audit_2025.pdf",
      original_path: "E:\\Documents\\Financials\\Confidential_Financial_Audit_2025.pdf",
      source_path: "Cluster #192040 (Carved from Unallocated Space)",
      size_bytes: 2845012,
      extension: ".pdf",
      category: "Document",
      deleted_at: "2026-09-08T14:32:00Z",
      confidence: "HIGH",
      confidence_score: 100,
      validation_details: "Valid PDF: %PDF-1.7 header + EOF catalog xref validated",
      offset_bytes: 98304000,
      recovery_method: "Raw Carver (EXT)",
      recoverable: true,
    },
    {
      id: "carved_png_002",
      filename: "surveillance_screenshot_cctv_frame.png",
      original_path: "E:\\DCIM\\Camera\\surveillance_screenshot_cctv_frame.png",
      source_path: "Cluster #284102",
      size_bytes: 1420980,
      extension: ".png",
      category: "Image",
      deleted_at: "2026-09-09T08:15:00Z",
      confidence: "HIGH",
      confidence_score: 98,
      validation_details: "Valid PNG: IHDR/IDAT chunks verified + CRC32 passed (1920x1080 RGB)",
      offset_bytes: 145890000,
      recovery_method: "Raw Carver (EXT)",
      recoverable: true,
    },
    {
      id: "carved_docx_003",
      filename: "Board_Meeting_Minutes_Sanitization_Plan.docx",
      original_path: "E:\\Work\\Board_Meeting_Minutes_Sanitization_Plan.docx",
      source_path: "Cluster #391024",
      size_bytes: 842100,
      extension: ".docx",
      category: "Document",
      deleted_at: "2026-09-10T11:45:00Z",
      confidence: "HIGH",
      confidence_score: 95,
      validation_details: "Valid OOXML: Central Directory verified [word/document.xml detected]",
      offset_bytes: 200450000,
      recovery_method: "Raw Carver (EXT)",
      recoverable: true,
    },
    {
      id: "carved_mp4_004",
      filename: "laboratory_access_footage_cam02.mp4",
      original_path: "E:\\Recordings\\laboratory_access_footage_cam02.mp4",
      source_path: "Cluster #512000",
      size_bytes: 18450000,
      extension: ".mp4",
      category: "Media",
      deleted_at: "2026-09-07T19:20:00Z",
      confidence: "MEDIUM",
      confidence_score: 85,
      validation_details: "Valid ISO BMFF: ftyp box (isom) + moov atom header valid",
      offset_bytes: 262144000,
      recovery_method: "Raw Carver (EXT)",
      recoverable: true,
    },
    {
      id: "ntfs_recycle_005",
      filename: "employee_master_credentials.xlsx",
      original_path: "E:\\HR\\employee_master_credentials.xlsx",
      source_path: "E:\\$RECYCLE.BIN\\S-1-5-21\\$R019482.xlsx",
      size_bytes: 195000,
      extension: ".xlsx",
      category: "Document",
      deleted_at: "2026-09-11T09:10:00Z",
      confidence: "HIGH",
      confidence_score: 100,
      validation_details: "NTFS $I index header authentic filename decoded: employee_master_credentials.xlsx",
      offset_bytes: 31020000,
      recovery_method: "NTFS $RECYCLE.BIN",
      recoverable: true,
    },
  ],
};

// ── Initial Sanitization History ─────────────────────────────────────────────
export const MOCK_HISTORY_JOBS = [
  {
    job_id: "JOB-NIST-8821",
    device_id: "usb_sandisk_extreme_64gb",
    target_file_path: "\\\\.\\PHYSICALDRIVE1 (SanDisk 64GB)",
    pattern: "zero",
    method: "NIST SP 800-88 Clear",
    completed_at: "2026-09-11T16:20:00Z",
    status: "COMPLETED",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    events: [
      { timestamp: "2026-09-11T16:15:00Z", event_type: "JOB_INIT", message: "NIST SP 800-88 Clear protocol initialized", severity: "INFO" },
      { timestamp: "2026-09-11T16:18:00Z", event_type: "PASS_WRITE", message: "Zero pattern pass completed across all 125,000,000 physical sectors", severity: "INFO" },
      { timestamp: "2026-09-11T16:20:00Z", event_type: "VERIFIED", message: "Zero entropy sample pass passed (100% 0x00)", severity: "SUCCESS" },
    ]
  },
  {
    job_id: "JOB-DOD-7719",
    device_id: "usb_sandisk_extreme_64gb",
    target_file_path: "E:\\Evidence_Archive_2025.zip",
    pattern: "dod5220",
    method: "DoD 5220.22-M 3-Pass",
    completed_at: "2026-09-10T12:05:00Z",
    status: "COMPLETED",
    sha256: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    events: [
      { timestamp: "2026-09-10T12:01:00Z", event_type: "PASS_1", message: "Pass 1 (0x00) completed", severity: "INFO" },
      { timestamp: "2026-09-10T12:03:00Z", event_type: "PASS_2", message: "Pass 2 (0xFF) completed", severity: "INFO" },
      { timestamp: "2026-09-10T12:05:00Z", event_type: "PASS_3", message: "Pass 3 (Random pattern) completed and verified", severity: "SUCCESS" },
    ]
  },
];

// ── Virtual File System for FileBrowser in Demo Mode ─────────────────────────
interface VirtualFileNode {
  name: string;
  kind: "file" | "directory";
  size?: number;
  mime?: string;
  preview?: string;
  modified?: string;
  children?: VirtualFileNode[];
}

const DEMO_VIRTUAL_FS: Record<string, VirtualFileNode[]> = {
  usb_sandisk_extreme_64gb: [
    {
      name: "Documents",
      kind: "directory",
      children: [
        {
          name: "Confidential_Audit_Report.pdf",
          kind: "file",
          size: 1450200,
          mime: "application/pdf",
          preview: "%PDF-1.7\n1 0 obj << /Title (FORENSURE FORENSIC AUDIT 2026) /Author (Cyber Investigations Unit) >>\n[CONFIDENTIAL EVIDENCE DOCUMENT - AUDITED FOR PRIVILEGED USAGE]",
          modified: "2026-09-08T11:20:00Z",
        },
        {
          name: "Chain_Of_Custody_Form_09.docx",
          kind: "file",
          size: 842100,
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          preview: "[ISO/IEC 27037 Digital Evidence Chain of Custody]\nDevice ID: PHYSICALDRIVE1\nEvidence ID: EVID-SAN-01\nAcquired By: Senior Forensic Examiner\nStatus: Write-Blocked Preservation",
          modified: "2026-09-10T09:15:00Z",
        },
      ],
    },
    {
      name: "DCIM",
      kind: "directory",
      children: [
        {
          name: "security_camera_snapshot.png",
          kind: "file",
          size: 2150000,
          mime: "image/png",
          preview: "[PNG Image: 1920x1080 32-bit RGBA - Camera 04 Lab Corridor Entrance - Timestamp: 2026-09-09 08:15:02 UTC]",
          modified: "2026-09-09T08:15:00Z",
        },
      ],
    },
    {
      name: "Financials",
      kind: "directory",
      children: [
        {
          name: "Quarterly_Ledger_2026.xlsx",
          kind: "file",
          size: 385000,
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          preview: "AccountID,TransactionDate,Amount,Description,RiskFlag\nACT-9821,2026-09-01,150000.00,Wire Transfer Offshore,HIGH\nACT-4421,2026-09-02,2400.00,Equipment Purchase,LOW",
          modified: "2026-09-07T14:40:00Z",
        },
        {
          name: "Bank_Transfer_Receipts.pdf",
          kind: "file",
          size: 920000,
          mime: "application/pdf",
          preview: "[PDF Transfer Confirmation - Central Reserve Bank - Ref #CRB-99214-X]",
          modified: "2026-09-07T15:10:00Z",
        },
      ],
    },
    {
      name: "Evidence_Archive_2025.zip",
      kind: "file",
      size: 42000000,
      mime: "application/zip",
      preview: "[ZIP Archive containing 14 compressed forensic disk images and MD5 manifests]",
      modified: "2026-09-05T17:30:00Z",
    },
    {
      name: "SYSTEM_ACCESS_LOG.txt",
      kind: "file",
      size: 14200,
      mime: "text/plain",
      preview: "2026-09-01 00:01:05 [AUTH] admin login success from 192.168.1.100\n2026-09-01 04:12:33 [DISK] Mass storage volume mounted at E:\\\n2026-09-01 04:15:19 [WARN] Unscheduled bulk export initiated\n2026-09-01 04:22:00 [DISK] E:\\ dismounted",
      modified: "2026-09-01T04:22:00Z",
    },
  ],
};

export function getMockFiles(
  deviceId: string,
  dirPath = ""
): FileBrowserResponse {
  const root = DEMO_VIRTUAL_FS[deviceId] || DEMO_VIRTUAL_FS.usb_sandisk_extreme_64gb;
  const cleanPath = dirPath.replace(/^\/+|\/+$/g, "");
  
  let currentList = root;
  let parentPath: string | null = null;

  if (cleanPath) {
    const parts = cleanPath.split("/");
    for (const part of parts) {
      const found = currentList.find(node => node.kind === "directory" && node.name.toLowerCase() === part.toLowerCase());
      if (found && found.children) {
        currentList = found.children;
      }
    }
    const idx = cleanPath.lastIndexOf("/");
    parentPath = idx >= 0 ? cleanPath.slice(0, idx) : "";
  }

  const entries: FileEntry[] = currentList.map(node => {
    const full = cleanPath ? `${cleanPath}/${node.name}` : node.name;
    return {
      name: node.name,
      path: full,
      parent_path: cleanPath || "",
      kind: node.kind,
      size_bytes: node.size || 0,
      extension: node.name.includes(".") ? `.${node.name.split(".").pop()}` : "",
      modified_at: node.modified || new Date().toISOString(),
      created_at: node.modified || new Date().toISOString(),
      accessed_at: new Date().toISOString(),
      hidden: false,
    };
  });

  return {
    device_id: deviceId,
    entries,
    total: entries.length,
    current_path: cleanPath,
    parent_path: parentPath,
    status: "completed",
    message: `Read ${entries.length} items from ${cleanPath || "drive root"}`,
  };
}

export function getMockFilePreview(deviceId: string, filePath: string) {
  const root = DEMO_VIRTUAL_FS[deviceId] || DEMO_VIRTUAL_FS.usb_sandisk_extreme_64gb;
  const basename = filePath.split("/").pop()?.split("\\").pop() || "";
  
  function findNode(nodes: VirtualFileNode[]): VirtualFileNode | undefined {
    for (const n of nodes) {
      if (n.name === basename) return n;
      if (n.children) {
        const sub = findNode(n.children);
        if (sub) return sub;
      }
    }
  }

  const found = findNode(root);
  return {
    content: found?.preview || `[Simulated Content for ${basename}]\nFile size: ${found?.size || 1024} bytes\nValid sector alignment verified\nSHA-256: 7d2b4a...`,
    type: found?.mime || "text/plain",
  };
}

// ── Local Storage Persistent Mock Records ────────────────────────────────────
const DEMO_RECOVERY_KEY = "forensure_demo_recovery_history";
const DEMO_SANITIZATION_KEY = "forensure_demo_sanitization_history";
const DEMO_EVIDENCE_KEY = "forensure_demo_evidence_records";

export function getPersistentRecoveryHistory(): RecoveredFileRecord[] {
  try {
    const raw = localStorage.getItem(DEMO_RECOVERY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  const initialHistory: RecoveredFileRecord[] = [
    {
      recovery_id: "REC-2026-001",
      filename: "Confidential_Financial_Audit_2025.pdf",
      output_path: "C:\\ForensicEvidence\\Restored\\Confidential_Financial_Audit_2025.pdf",
      size_bytes: 2845012,
      sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      confidence: "HIGH",
      recovery_method: "Raw Carver (EXT)",
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      recovery_id: "REC-2026-002",
      filename: "surveillance_screenshot_cctv_frame.png",
      output_path: "C:\\ForensicEvidence\\Restored\\surveillance_screenshot_cctv_frame.png",
      size_bytes: 1420980,
      sha256: "3d5f1a8c9e2b4d7f0a1c3e5a7b9d1f3b5d7f9a1c3e5a7b9d1f3b5d7f9a1c3e5a",
      confidence: "HIGH",
      recovery_method: "Raw Carver (EXT)",
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  ];
  try {
    localStorage.setItem(DEMO_RECOVERY_KEY, JSON.stringify(initialHistory));
  } catch {}
  return initialHistory;
}

export function savePersistentRecoveryItems(items: RecoveredFileRecord[]) {
  try {
    const existing = getPersistentRecoveryHistory();
    const updated = [...items, ...existing];
    localStorage.setItem(DEMO_RECOVERY_KEY, JSON.stringify(updated));
  } catch {}
}

export function getPersistentSanitizationHistory() {
  try {
    const raw = localStorage.getItem(DEMO_SANITIZATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  try {
    localStorage.setItem(DEMO_SANITIZATION_KEY, JSON.stringify(MOCK_HISTORY_JOBS));
  } catch {}
  return MOCK_HISTORY_JOBS;
}

export function savePersistentSanitizationJob(job: any) {
  try {
    const existing = getPersistentSanitizationHistory();
    const updated = [job, ...existing.filter((j: any) => j.job_id !== job.job_id)];
    localStorage.setItem(DEMO_SANITIZATION_KEY, JSON.stringify(updated));
  } catch {}
}

export function getPersistentEvidence(deviceId: string) {
  try {
    const raw = localStorage.getItem(`${DEMO_EVIDENCE_KEY}_${deviceId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  const defaults: EvidenceRecord[] = [
    {
      id: "EVID-001",
      case_id: "CASE-DEMO-01",
      operation_id: "OP-001",
      path: "E:\\Documents\\Confidential_Audit_Report.pdf",
      sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "EVID-002",
      case_id: "CASE-DEMO-01",
      operation_id: "OP-002",
      path: "E:\\DCIM\\security_camera_snapshot.png",
      sha256: "3d5f1a8c9e2b4d7f0a1c3e5a7b9d1f3b5d7f9a1c3e5a7b9d1f3b5d7f9a1c3e5a",
      created_at: new Date(Date.now() - 43200000).toISOString(),
    },
  ];
  return defaults;
}

export function addPersistentEvidence(deviceId: string, item: any) {
  try {
    const list = getPersistentEvidence(deviceId);
    const updated = [item, ...list];
    localStorage.setItem(`${DEMO_EVIDENCE_KEY}_${deviceId}`, JSON.stringify(updated));
  } catch {}
}

// ── Realistic File Blob Generator (Returns actual openable files) ────────────
export function generateRealFileBlob(filename: string): Blob {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf") {
    // Valid Minimal PDF-1.4 with cross-reference table and text stream
    const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 190 >>
stream
BT
/F1 20 Tf
50 720 Td
(FORENSURE DIGITAL FORENSICS - RESTORED EVIDENCE) Tj
/F1 12 Tf
0 -35 Td
(Target File: ${filename}) Tj
0 -25 Td
(Recovery Method: Sector Carving & NTFS MFT Cluster Reassembly) Tj
0 -25 Td
(Acquisition Status: Cryptographically Preserved) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000485 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
562
%%EOF`;
    return new Blob([content], { type: "application/pdf" });
  }

  if (ext === "png" || ext === "jpg" || ext === "jpeg") {
    // Return a very small valid PNG instead of a 1x1 transparent one which looks black
    // This is a 10x10 solid gray image (so the user doesn't see a black screen)
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x00, 0x00, 0x0A, 
      0x08, 0x02, 0x00, 0x00, 0x00, 0x02, 0x50, 0x58, 0xEA, 0x00, 0x00, 0x00, 
      0x16, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x54, 0x54, 0x54, 0xF4, 
      0x0F, 0x00, 0x11, 0x11, 0x04, 0x40, 0x57, 0x3E, 0x11, 0x36, 0x00, 0x00, 
      0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    return new Blob([pngBytes], { type: "image/png" });
  }

  if (ext === "xlsx" || ext === "csv") {
    const csvContent = `Evidence_ID,Record_Time,Host_Mount,Target_File,Validation_Hash\nREC-001,${new Date().toISOString()},E:\\,${filename},b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9\nREC-002,${new Date().toISOString()},E:\\,Cluster_Reassembled.dat,3d5f1a8c9e2b4d7f0a1c3e5a7b9d1f3b5d7f9a1c3e5a7b9d1f3b5d7f9a1c3e5a\n`;
    return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  }

  // Fallback text / doc
  const textContent = `======================================================================
FORENSURE DIGITAL EVIDENCE RESTORATION RECORD
======================================================================
Filename            : ${filename}
Restored At         : ${new Date().toISOString()}
Security Standard   : ISO/IEC 27037:2012 Digital Evidence Handling
Preservation Hash   : b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9 (SHA-256)
Status              : Authenticated & Validated

SUMMARY OF FORENSIC CARVING:
- Valid file signature header validated
- File structure cross-referenced with Master File Table clusters
- Bitstream integrity check passed (100% matched)
======================================================================
`;
  return new Blob([textContent], { type: "text/plain;charset=utf-8;" });
}

// ── Realistic Certificate Generator ──────────────────────────────────────────
export function generateCertificateBlob(job: any): Blob {
  const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Certificate of Sanitization — ${job.job_id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; background: #0D1117; color: #E6EDF3; padding: 40px; }
    .card { max-width: 800px; margin: 0 auto; background: #161B22; border: 2px solid #30363D; border-radius: 16px; padding: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    h1 { color: #2F81F7; margin-bottom: 5px; font-size: 26px; }
    .badge { display: inline-block; background: rgba(34, 197, 94, 0.2); border: 1px solid #22C55E; color: #22C55E; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; font-size: 14px; }
    .label { color: #8B949E; font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
    .val { color: #FFFFFF; font-weight: 600; word-break: break-all; font-family: monospace; }
    .sig { border-top: 1px solid #30363D; padding-top: 25px; margin-top: 30px; font-size: 12px; color: #8B949E; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1>CERTIFICATE OF SANITIZATION</h1>
        <div style="color: #8B949E; font-size: 13px;">FORENSURE Hardware Cryptographic Engine</div>
      </div>
      <div class="badge">NIST SP 800-88 VERIFIED</div>
    </div>

    <div class="grid">
      <div>
        <div class="label">Job Identifier</div>
        <div class="val">${job.job_id || "JOB-NIST-8821"}</div>
      </div>
      <div>
        <div class="label">Completion Timestamp</div>
        <div class="val">${job.completed_at || new Date().toISOString()}</div>
      </div>
      <div>
        <div class="label">Target Device / File</div>
        <div class="val">${job.target_file_path || job.device_id || "Physical Storage Target"}</div>
      </div>
      <div>
        <div class="label">Sanitization Protocol</div>
        <div class="val">${job.method || "NIST SP 800-88 Clear (Zero Fill)"}</div>
      </div>
      <div style="grid-column: span 2;">
        <div class="label">Cryptographic Verification Hash (SHA-256)</div>
        <div class="val" style="color: #22C55E;">${job.sha256 || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}</div>
      </div>
    </div>

    <div style="background: rgba(47, 129, 247, 0.1); border: 1px solid rgba(47, 129, 247, 0.3); border-radius: 8px; padding: 15px; font-size: 12px; line-height: 1.6;">
      This document certifies that the targeted non-volatile storage sectors were completely overwritten in compliance with 
      <strong>NIST Special Publication 800-88 Revision 1 (Guidelines for Media Sanitization)</strong>. 
      A 100% sample verification pass confirmed that residual data has been rendered completely irretrievable.
    </div>

    <div class="sig">
      Verified by: FORENSURE Bridge Kernel Driver & Automated Entropy Verifier<br/>
      Compliance: DoD 5220.22-M / NIST SP 800-88 Rev 1 / ISO/IEC 27037:2012
    </div>
  </div>
</body>
</html>`;
  return new Blob([content], { type: "text/html" });
}
