import axios from "axios";
import { agentConnection } from "./agentConnection";
import { MOCK_DELETED_FILES } from "./mockData";

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
      return {
        total_requested: fileIds.length,
        total_recovered: fileIds.length,
        restored_items: fileIds.map((fid, idx) => ({
          file_id: fid,
          filename: `restored_evidence_sample_${idx + 1}.pdf`,
          output_path: `C:\\ForensicEvidence\\Restored\\evidence_${idx + 1}.pdf`,
          size_bytes: 1048576,
          sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
          status: "RECOVERED",
        })),
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
      return [];
    }
    return (await api.get("/api/recovery/recovered")).data;
  },

  getReport: async (deviceId: string): Promise<ForensicReportResponse> => {
    return (await api.get(`/api/recovery/report?device_id=${encodeURIComponent(deviceId)}`)).data;
  },

  downloadFile: async (filename: string): Promise<Blob> => {
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
