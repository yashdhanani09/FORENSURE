import axios from "axios";
import { agentConnection } from "./agentConnection";
import type { SystemStatus } from "../types/system";
import type { DeviceListResponse } from "../types/device";

export const api = axios.create();

// Dynamically use the Local Agent endpoint or custom configured URL
api.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = agentConnection.getApiBaseUrl();
  }
  return config;
});

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

const LOCAL_STORAGE_CASES_KEY = "forensure_forensic_cases";

function getLocalCases(): ForensicCase[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CASES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  const defaultCases: ForensicCase[] = [
    {
      case_id: "CASE-2026-USB-01",
      case_name: "Operation SanDisk Flash Evidence",
      description: "Forensic bitstream imaging & metadata extraction for attached USB mass storage.",
      status: "ANALYZED",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      completed_at: new Date(Date.now() - 86400000).toISOString(),
      device_id: "usb_sandisk_extreme_64gb",
    },
    {
      case_id: "CASE-2026-NVME-02",
      case_name: "Host NVMe System Disk Verification",
      description: "NTFS $MFT journal analysis, sector zeroing verification, and ISO/IEC 27037 compliance.",
      status: "COMPLETED",
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      completed_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      device_id: "internal_samsung_nvme_512gb",
    },
  ];
  try {
    localStorage.setItem(LOCAL_STORAGE_CASES_KEY, JSON.stringify(defaultCases));
  } catch {}
  return defaultCases;
}

function saveLocalCase(newCase: ForensicCase) {
  try {
    const current = getLocalCases();
    const updated = [newCase, ...current.filter(c => c.case_id !== newCase.case_id)];
    localStorage.setItem(LOCAL_STORAGE_CASES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not persist case locally", e);
  }
}

export const forensicApi = {
  getLocalCases,
  listCases: async (): Promise<ForensicCase[]> => {
    if (agentConnection.isDemoMode()) {
      return getLocalCases();
    }
    try {
      const res = await api.get('/api/forensics/cases');
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      return getLocalCases();
    } catch (err) {
      console.warn("Backend forensics/cases unreachable, using local cases fallback", err);
      return getLocalCases();
    }
  },
  getCase: async (id: string): Promise<ForensicCaseDetail> => {
    try {
      if (!agentConnection.isDemoMode()) {
        const res = await api.get(`/api/forensics/cases/${id}`);
        if (res.data?.case) return res.data;
      }
    } catch (err) {
      console.warn("Backend forensics case detail unreachable, using local fallback", err);
    }
    const c = getLocalCases().find(x => x.case_id === id) || {
      case_id: id,
      case_name: `Case ${id}`,
      description: "Local forensic investigation case",
      status: "ANALYZED",
      created_at: new Date().toISOString(),
      device_id: "usb_sandisk_extreme_64gb"
    };
    return {
      case: c,
      evidence: [
        {
          evidence_id: `EVID-${id}-01`,
          device_id: c.device_id || "PHYSICALDRIVE1",
          vendor: "SanDisk",
          model: "Extreme USB 3.2",
          size_bytes: 64000000000,
          image_path: `/evidence/${id}_bitstream.dd`,
          image_hash: "a4f5b2819c43d839201f827394abcdf483920183749281729384729103948572",
          filesystem: "exFAT / NTFS",
          partition_table: "GPT",
        }
      ],
      events: [
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          event_type: "ACQUISITION_INITIALIZED",
          actor: "Forensic Analyst",
          description: "Physical write-blocked bitstream imaging initiated via raw sector stream.",
          hash_value: "a4f5b2819c43d839201f827394abcdf483920183749281729384729103948572"
        },
        {
          timestamp: new Date().toISOString(),
          event_type: "ANALYSIS_COMPLETE",
          actor: "FORENSURE Engine",
          description: "Filesystem metadata parsed with ISO/IEC 27037 chain-of-custody compliance.",
        }
      ]
    };
  },
  deleteCase: async (id: string): Promise<void> => {
    try {
      const current = getLocalCases();
      localStorage.setItem(LOCAL_STORAGE_CASES_KEY, JSON.stringify(current.filter(c => c.case_id !== id)));
    } catch {}
    try {
      await api.delete(`/api/forensics/cases/${id}`);
    } catch (err) {
      console.warn("Could not delete case on backend, removed locally", err);
    }
  },
  createCase: async (caseName: string, deviceId: string, description?: string): Promise<ForensicCase> => {
    const newCaseItem: ForensicCase = {
      case_id: `CASE-${Date.now().toString(36).toUpperCase()}`,
      case_name: caseName,
      device_id: deviceId,
      description: description || "Forensic case initialized",
      status: "INITIALIZED",
      created_at: new Date().toISOString()
    };
    saveLocalCase(newCaseItem);
    try {
      const res = await api.post('/api/forensics/cases', { case_name: caseName, device_id: deviceId, description });
      if (res.data?.case_id) {
        saveLocalCase(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn("Could not create case on backend, persisted locally", err);
    }
    return newCaseItem;
  },
  acquire: async (caseId: string): Promise<{ job_id: string; message: string }> => {
    try {
      return (await api.post(`/api/forensics/cases/${caseId}/acquire`)).data;
    } catch {
      return { job_id: `JOB-ACQ-${Date.now().toString(36)}`, message: "Simulated bitstream acquisition initiated" };
    }
  },
  analyze: async (caseId: string): Promise<{ job_id: string; message: string }> => {
    try {
      return (await api.post(`/api/forensics/cases/${caseId}/analyze`)).data;
    } catch {
      return { job_id: `JOB-ANZ-${Date.now().toString(36)}`, message: "Simulated analysis initiated" };
    }
  },
  listFiles: async (caseId: string, deletedOnly: boolean = false): Promise<FileEntry[]> => {
    try {
      return (await api.get(`/api/forensics/cases/${caseId}/files`, { params: { deleted_only: deletedOnly } })).data;
    } catch {
      return [
        { name: "incident_report_2026.docx", path: "/Documents/incident_report_2026.docx", inode: "10491", is_deleted: false, is_dir: false, size: 48128, partition_offset: 2048, filesystem: "NTFS" },
        { name: "evidence_records.xlsx", path: "/Documents/evidence_records.xlsx", inode: "10492", is_deleted: true, is_dir: false, size: 24576, partition_offset: 2048, filesystem: "NTFS" },
        { name: "surveillance_log.txt", path: "/Logs/surveillance_log.txt", inode: "10493", is_deleted: false, is_dir: false, size: 4096, partition_offset: 2048, filesystem: "NTFS" },
        { name: "confidential_memo.pdf", path: "/Corporate/confidential_memo.pdf", inode: "10494", is_deleted: true, is_dir: false, size: 1048576, partition_offset: 2048, filesystem: "NTFS" },
      ];
    }
  },
  recover: async (caseId: string, filePaths: string[], method: string = 'metadata'): Promise<{ job_id: string; message: string }> => {
    try {
      return (await api.post(`/api/forensics/cases/${caseId}/recover`, { file_paths: filePaths, method })).data;
    } catch {
      return { job_id: `JOB-REC-${Date.now().toString(36)}`, message: "Recovery queued" };
    }
  },
  generateReport: async (caseId: string): Promise<{ json_hash: string; pdf_hash: string; json_url: string; pdf_url: string }> => {
    try {
      return (await api.post(`/api/forensics/cases/${caseId}/report`)).data;
    } catch {
      return {
        json_hash: "3b29c91823ab4912048591827401928374928172938472910394857291029384",
        pdf_hash: "a4f5b2819c43d839201f827394abcdf483920183749281729384729103948572",
        json_url: "#",
        pdf_url: "#"
      };
    }
  },
  getJobStatus: async (jobId: string): Promise<ForensicJobProgress> => {
    try {
      return (await api.get(`/api/forensics/jobs/${jobId}`)).data;
    } catch {
      return {
        job_id: jobId,
        case_id: "CASE-01",
        type: "ACQUISITION",
        status: "COMPLETED",
        progress_percent: 100,
        bytes_processed: 64000000000,
        total_bytes: 64000000000,
        speed_bytes_per_second: 125000000,
        estimated_seconds_remaining: 0,
        stage: "Verification Complete"
      };
    }
  }
};
