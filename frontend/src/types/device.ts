export interface PartitionInfo {
  name: string;
  device_path: string;
  filesystem: string | null;
  label: string | null;
  uuid: string | null;
  capacity_bytes: number;
  mount_points: string[];
}

export interface UsbDevice {
  id: string;
  device_path: string;
  vendor: string | null;
  model: string | null;
  serial: string | null;
  usb_version?: string | null;
  manufacturer?: string | null;
  device_class?: string | null;
  capacity_bytes?: number;
  size_bytes?: number;
  filesystem?: string | null;
  mount_point?: string | null;
  removable?: boolean;
  read_only?: boolean;
  transport?: string | null;
  detected_at?: string;
  device_type?: string;          // USB_STORAGE / NVME / SATA / SD_CARD / INTERNAL_STORAGE / etc.
  system_disk?: boolean;         // true if this is the OS boot disk
  is_protected?: boolean;
  is_usb?: boolean;
}

export interface UsbDeviceDetail extends UsbDevice {
  partitions: PartitionInfo[];
  system_disk: boolean;
  analysis_available: boolean;
}

export interface DeviceListResponse {
  devices: UsbDeviceDetail[];
  refreshed_at: string;
  demo_mode?: boolean; // kept optional for compat while migrating
  warning?: string | null;  // set when backend lacks admin privileges
}

export interface DeviceAnalysis {
  device_id: string;
  filesystem: string | null;
  total_bytes: number;
  used_bytes: number | null;
  free_bytes: number | null;
  file_count: number | null;
  directory_count: number | null;
  extension_counts?: Record<string, number> | null;
  status: string;
  message: string;
}

export type FileKind = "file" | "directory" | "symlink" | "other";

export interface FileEntry {
  name: string;
  path: string;
  parent_path: string;
  kind: FileKind;
  size_bytes: number | null;
  modified_at: string | null;
  created_at: string | null;
  accessed_at: string | null;
  extension: string | null;
  hidden: boolean;
}

export interface FileBrowserResponse {
  device_id: string;
  current_path: string;
  parent_path: string | null;
  entries: FileEntry[];
  total: number;
  status: "completed" | "unavailable" | "not_found";
  message: string;
}

export interface EvidenceRecord {
  id: string;
  case_id: string;
  path: string;
  sha256: string | null;
  created_at: string;
  operation_id: string;
}

export interface EvidenceListResponse {
  device_id: string;
  evidence_records: EvidenceRecord[];
}

export interface DeletedFileRecord {
  inode: string;
  filename: string;
  size_bytes: number | null;
  recoverable: boolean;
}

export interface ForensicScanResponse {
  device_id: string;
  deleted_files: DeletedFileRecord[];
  status: string;
  message: string;
}

export interface OffsetVerification {
  offset_bytes: number;
  passed: boolean;
}

export interface VerificationResult {
  device_id: string;
  status: string;
  message: string;
  is_zeroed: boolean;
  sampled_offsets: OffsetVerification[];
}
