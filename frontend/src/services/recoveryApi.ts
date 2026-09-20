import axios from "axios";
import { agentConnection } from "./agentConnection";
import { 
  MOCK_DELETED_FILES, 
  MOCK_DEVICES, 
  getPersistentRecoveryHistory, 
  savePersistentRecoveryItems, 
  generateRealFileBlob 
} from "./mockData";

export const api = axios.create();

api.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = agentConnection.getApiBaseUrl();
  }
  return config;
});

export interface DeletedFileItem {
  id: string;
  filename: string;
  original_path: string;
  source_path: string;
  size_bytes: number;
  extension: string;
  category: "Document" | "Image" | "Media" | "Archive" | "Code" | "Other";
  deleted_at?: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidence_score?: number;
  validation_details?: string;
  offset_bytes?: number;
  recovery_method: string;
  recoverable: boolean;
}

export interface RecoveryScanResponse {
  device_id: string;
  device_name: string;
  scan_type: string;
  scanned_at: string;
  total_found: number;
  files: DeletedFileItem[];
  device_profile?: any;
  acquisition_hash?: string;
  elevation_required?: boolean;
  elevation_message?: string;
}

export interface ForensicReportResponse {
  report_id: string;
  generated_at: string;
  case_id: string;
  case_name: string;
  device_id: string;
  device_name: string;
  device_profile: any;
  acquisition_hash: string;
  total_discovered: number;
  total_recovered: number;
  discovered_files: DeletedFileItem[];
  recovered_files: any[];
  chain_of_custody: any[];
  executive_summary: string;
}

export interface RestoredItem {
  file_id: string;
  filename: string;
  output_path: string;
  size_bytes: number;
  sha256: string;
  status: "RECOVERED" | "FAILED";
  error?: string | null;
}

export interface RestoreFileResponse {
  total_requested: number;
  total_recovered: number;
  restored_items: RestoredItem[];
}

export interface RecoveredFileRecord {
  recovery_id: string;
  filename: string;
  output_path: string;
  size_bytes: number;
  sha256?: string | null;
  confidence: string;
  recovery_method: string;
  created_at: string;
}

export interface RecoveryPrivileges {
  is_admin: boolean;
  can_read_raw_disk: boolean;
  platform: string;
  elevation_required: boolean;
  advisory: string;
}

export interface ElevationResponse {
  status: string;
  message: string;
  manual_command?: string;
}

export const recoveryApi = {
  scan: async (
    deviceId: string,
    scanType: "auto" | "unified" | "quick" | "deep" | "carving" | "forensic_image" = "auto",
    targetPath?: string,
    imagePath?: string
  ): Promise<RecoveryScanResponse> => {
    if (agentConnection.isDemoMode()) {
      return {
        ...MOCK_DELETED_FILES,
        device_id: deviceId,
        scan_type: scanType,
      };
    }
    return (await api.post("/api/recovery/scan", {
      device_id: deviceId,
      scan_type: scanType,
      target_path: targetPath,
      image_path: imagePath,
    })).data;
  },

  restore: async (deviceId: string, fileIds: string[], destinationFolder?: string): Promise<RestoreFileResponse> => {
    if (agentConnection.isDemoMode()) {
      const restoredItems: RestoredItem[] = fileIds.map((fid) => {
        const found = MOCK_DELETED_FILES.files.find((f) => f.id === fid);
        return {
          file_id: fid,
          filename: found?.filename || `recovered_artifact_${fid}.pdf`,
          output_path: found?.original_path
            ? `C:\\ForensicEvidence\\Restored\\${found.filename}`
            : `C:\\ForensicEvidence\\Restored\\recovered_${fid}.pdf`,
          size_bytes: found?.size_bytes || 1048576,
          sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
          status: "RECOVERED" as const,
        };
      });

      // Save to persistent demo recovery history
      const newRecords: RecoveredFileRecord[] = restoredItems.map((r, idx) => ({
        recovery_id: `REC-${Date.now().toString().slice(-4)}-${idx + 1}`,
        filename: r.filename,
        output_path: r.output_path,
        size_bytes: r.size_bytes,
        sha256: r.sha256,
        confidence: "HIGH",
        recovery_method: "Raw Sector Reassembly",
        created_at: new Date().toISOString(),
      }));
      savePersistentRecoveryItems(newRecords);

      return {
        total_requested: fileIds.length,
        total_recovered: fileIds.length,
        restored_items: restoredItems,
      };
    }
    return (await api.post("/api/recovery/restore", {
      device_id: deviceId,
      file_ids: fileIds,
      destination_folder: destinationFolder,
    })).data;
  },

  getHistory: async (): Promise<RecoveredFileRecord[]> => {
    if (agentConnection.isDemoMode()) {
      return getPersistentRecoveryHistory();
    }
    return (await api.get("/api/recovery/recovered")).data;
  },

  getReport: async (deviceId: string): Promise<ForensicReportResponse> => {
    if (agentConnection.isDemoMode()) {
      const targetDevice = MOCK_DEVICES.find(d => d.id === deviceId) || MOCK_DEVICES[1];
      const history = getPersistentRecoveryHistory();
      return {
        report_id: `RPT-FORENSURE-${Date.now().toString().slice(-6)}`,
        generated_at: new Date().toISOString(),
        case_id: "CASE-2026-DEMO-01",
        case_name: "Operation Storage Verification",
        device_id: targetDevice.id,
        device_name: `${targetDevice.vendor} ${targetDevice.model} (${targetDevice.mount_point || targetDevice.device_path})`,
        device_profile: {
          vendor: targetDevice.vendor,
          model: targetDevice.model,
          serial: targetDevice.serial,
          capacity_bytes: targetDevice.capacity_bytes || targetDevice.size_bytes,
          filesystem: targetDevice.filesystem,
          mount_point: targetDevice.mount_point,
          sectors_total: 125000000,
          sector_size: 512,
        },
        acquisition_hash: "a4f5b2819c43d839201f827394abcdf483920183749281729384729103948572",
        total_discovered: MOCK_DELETED_FILES.files.length,
        total_recovered: history.length,
        discovered_files: MOCK_DELETED_FILES.files,
        recovered_files: history,
        chain_of_custody: [
          {
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            event_type: "HARDWARE_ACQUISITION",
            actor: "Senior Forensic Examiner",
            description: "Physical storage device attached via hardware write-blocker.",
            hash_value: "a4f5b2819c43d839201f827394abcdf483920183749281729384729103948572"
          },
          {
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            event_type: "SECTOR_CARVING_COMPLETED",
            actor: "FORENSURE Kernel Engine",
            description: "Raw NTFS Master File Table and unallocated space reassembled.",
          },
          {
            timestamp: new Date().toISOString(),
            event_type: "EVIDENCE_VERIFIED",
            actor: "FORENSURE Integrity Verifier",
            description: "SHA-256 verification hash matched against bitstream image.",
          }
        ],
        executive_summary: "The target storage unit was scanned using sector-level signature carving and NTFS MFT record recovery. All recovered artifacts preserve ISO/IEC 27037 chain-of-custody compliance with tamper-evident cryptographic verification."
      };
    }
    return (await api.get(`/api/recovery/report?device_id=${encodeURIComponent(deviceId)}`)).data;
  },

  downloadFile: async (filename: string): Promise<Blob> => {
    if (agentConnection.isDemoMode()) {
      return generateRealFileBlob(filename);
    }
    const res = await api.get(`/api/recovery/download/${encodeURIComponent(filename)}`, {
      responseType: "blob",
    });
    return res.data;
  },

  getPrivileges: async (): Promise<RecoveryPrivileges> => {
    if (agentConnection.isDemoMode()) {
      return {
        is_admin: true,
        can_read_raw_disk: true,
        platform: "Windows",
        elevation_required: false,
        advisory: "Demo Mode - simulated administrative privileges active.",
      };
    }
    return (await api.get("/api/recovery/privileges")).data;
  },

  requestElevation: async (): Promise<ElevationResponse> => {
    if (agentConnection.isDemoMode()) {
      return {
        status: "ALREADY_ADMIN",
        message: "Demo Mode is already running with administrative privileges.",
      };
    }
    return (await api.post("/api/recovery/elevate")).data;
  },
};
