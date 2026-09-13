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

export const recoveryApi = {
  scan: async (
    deviceId: string,
    scanType: "quick" | "deep" | "carving" | "forensic_image" = "quick",
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
};
