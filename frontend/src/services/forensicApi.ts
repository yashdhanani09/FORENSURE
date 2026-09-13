import axios from "axios";
import type { SystemStatus } from "../types/system";
import type { DeviceListResponse } from "../types/device";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "" });

export interface ForensicCase {
  case_id: string;
  case_name: string;
  description?: string;
  status: string;
  created_at: string;
  completed_at?: string;
  device_id?: string;
}

export interface ChainOfCustodyEvent {
  timestamp: string;
  event_type: string;
  actor: string;
  description: string;
  hash_value?: string;
}

export interface EvidenceItem {
  evidence_id: string;
  device_id: string;
  vendor?: string;
  model?: string;
  serial_number?: string;
  size_bytes: number;
  image_path?: string;
  image_hash?: string;
  filesystem?: string;
  partition_table?: string;
}

export interface ForensicCaseDetail {
  case: ForensicCase;
  evidence: EvidenceItem[];
  events: ChainOfCustodyEvent[];
}

export interface ForensicJobProgress {
  job_id: string;
  case_id: string;
  type: string;
  status: string;
  progress_percent: number;
  bytes_processed: number;
  total_bytes: number;
  speed_bytes_per_second: number;
  estimated_seconds_remaining: number;
  stage: string;
  error_message?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  inode: string;
  is_deleted: boolean;
  is_dir: boolean;
  size: number;
  partition_offset: number;
  filesystem: string;
}

export const forensicApi = {
  listCases: async (): Promise<ForensicCase[]> => {
    return (await api.get('/api/forensics/cases')).data;
  },
  getCase: async (id: string): Promise<ForensicCaseDetail> => {
    return (await api.get(`/api/forensics/cases/${id}`)).data;
  },
  deleteCase: async (id: string): Promise<void> => {
    await api.delete(`/api/forensics/cases/${id}`);
  },
  createCase: async (caseName: string, deviceId: string, description?: string): Promise<ForensicCase> => {
    return (await api.post('/api/forensics/cases', { case_name: caseName, device_id: deviceId, description })).data;
  },
  acquire: async (caseId: string): Promise<{ job_id: string; message: string }> => {
    return (await api.post(`/api/forensics/cases/${caseId}/acquire`)).data;
  },
  analyze: async (caseId: string): Promise<{ job_id: string; message: string }> => {
    return (await api.post(`/api/forensics/cases/${caseId}/analyze`)).data;
  },
  listFiles: async (caseId: string, deletedOnly: boolean = false): Promise<FileEntry[]> => {
    return (await api.get(`/api/forensics/cases/${caseId}/files`, { params: { deleted_only: deletedOnly } })).data;
  },
  recover: async (caseId: string, filePaths: string[], method: string = 'metadata'): Promise<{ job_id: string; message: string }> => {
    return (await api.post(`/api/forensics/cases/${caseId}/recover`, { file_paths: filePaths, method })).data;
  },
  generateReport: async (caseId: string): Promise<{ json_hash: string; pdf_hash: string; json_url: string; pdf_url: string }> => {
    return (await api.post(`/api/forensics/cases/${caseId}/report`)).data;
  },
  getJobStatus: async (jobId: string): Promise<ForensicJobProgress> => {
    return (await api.get(`/api/forensics/jobs/${jobId}`)).data;
  }
};
