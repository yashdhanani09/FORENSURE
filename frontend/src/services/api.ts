import axios from "axios";
import type { 
  DeviceAnalysis, 
  DeviceListResponse, 
  FileBrowserResponse, 
  UsbDeviceDetail, 
  EvidenceRecord, 
  EvidenceListResponse, 
  ForensicScanResponse, 
  VerificationResult 
} from "../types/device";
import type { SystemStatus } from "../types/system";
import { agentConnection } from "./agentConnection";
import { 
  MOCK_DEVICES, 
  MOCK_DEVICE_LIST_RESPONSE, 
  MOCK_DELETED_FILES,
  getMockFiles,
  getMockFilePreview,
  getPersistentEvidence,
  addPersistentEvidence,
  getPersistentSanitizationHistory,
  savePersistentSanitizationJob,
  generateCertificateBlob
} from "./mockData";

export const api = axios.create();

// Dynamically use the Local Agent endpoint or custom configured URL
api.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = agentConnection.getApiBaseUrl();
  }
  return config;
});

function userFacingError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return new Error(typeof detail === "string" ? detail : "The SecureData service could not complete the request.");
  }
  return error instanceof Error ? error : new Error("An unexpected error occurred.");
}

let cachedDeviceList: { data: DeviceListResponse; timestamp: number } | null = null;
const DEVICE_CACHE_TTL_MS = 30_000;

export const deviceApi = {
  async list(options?: { refresh?: boolean }): Promise<DeviceListResponse> {
    if (agentConnection.isDemoMode()) {
      return MOCK_DEVICE_LIST_RESPONSE;
    }
    const now = Date.now();
    if (!options?.refresh && cachedDeviceList && (now - cachedDeviceList.timestamp < DEVICE_CACHE_TTL_MS)) {
      return cachedDeviceList.data;
    }
    try {
      const response = await api.get<DeviceListResponse>("/api/devices", {
        params: options?.refresh ? { refresh: true } : undefined
      });
      cachedDeviceList = { data: response.data, timestamp: Date.now() };
      return response.data;
    } catch (error) {
      throw userFacingError(error);
    }
  },
  invalidateCache(): void {
    cachedDeviceList = null;
  },
  async get(id: string): Promise<UsbDeviceDetail> {
    if (agentConnection.isDemoMode()) {
      const found = MOCK_DEVICES.find((d) => d.id === id);
      if (found) return found;
    }
    try { return (await api.get<UsbDeviceDetail>(`/api/devices/${encodeURIComponent(id)}`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async analyze(id: string): Promise<DeviceAnalysis> {
    if (agentConnection.isDemoMode()) {
      const dev = MOCK_DEVICES.find(d => d.id === id) || MOCK_DEVICES[1];
      return {
        device_id: dev.id,
        device_path: dev.device_path,
        filesystem: dev.filesystem,
        capacity_bytes: dev.capacity_bytes || dev.size_bytes || 64000000000,
        clusters_total: 15625000,
        clusters_free: 8920100,
        mft_records_count: 42100,
        entropy_score: 0.76,
        partition_type: "GPT",
        sector_size: 512,
        cluster_size_bytes: 4096,
        read_only: dev.read_only,
        integrity_status: "VERIFIED_COMPLIANT",
      } as any;
    }
    try { return (await api.post<DeviceAnalysis>(`/api/devices/${encodeURIComponent(id)}/analyze`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async files(id: string, params: { path?: string; search?: string; kind?: string; sort_by?: string; sort_order?: string }): Promise<FileBrowserResponse> {
    if (agentConnection.isDemoMode()) {
      return getMockFiles(id, params.path || "");
    }
    try { return (await api.get<FileBrowserResponse>(`/api/devices/${encodeURIComponent(id)}/files`, { params })).data; }
    catch (error) { throw userFacingError(error); }
  },
  async previewFile(id: string, path: string): Promise<{ content: string; type: string }> {
    if (agentConnection.isDemoMode()) {
      return getMockFilePreview(id, path);
    }
    try { return (await api.get<{ content: string; type: string }>(`/api/devices/${encodeURIComponent(id)}/files/content`, { params: { path } })).data; }
    catch (error) { throw userFacingError(error); }
  },
  async hashFile(id: string, path: string): Promise<EvidenceRecord> {
    if (agentConnection.isDemoMode()) {
      const newEvid: EvidenceRecord = {
        id: `EVID-${Date.now().toString().slice(-4)}`,
        case_id: "CASE-DEMO-01",
        operation_id: `OP-${Date.now().toString().slice(-4)}`,
        path,
        sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
        created_at: new Date().toISOString(),
      };
      addPersistentEvidence(id, newEvid);
      return newEvid;
    }
    try { return (await api.post<EvidenceRecord>(`/api/devices/${encodeURIComponent(id)}/files/hash`, null, { params: { path } })).data; }
    catch (error) { throw userFacingError(error); }
  },
  async listEvidence(id: string): Promise<EvidenceListResponse> {
    if (agentConnection.isDemoMode()) {
      const records = getPersistentEvidence(id);
      return {
        device_id: id,
        evidence_records: records,
      };
    }
    try { return (await api.get<EvidenceListResponse>(`/api/devices/${encodeURIComponent(id)}/evidence`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async scanDeletedFiles(id: string): Promise<ForensicScanResponse> {
    if (agentConnection.isDemoMode()) {
      return {
        ...MOCK_DELETED_FILES,
        device_id: id,
      } as any;
    }
    try { return (await api.get<ForensicScanResponse>(`/api/devices/${encodeURIComponent(id)}/forensics/scan`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async recoverDeletedFile(id: string, inode: string, filename: string): Promise<EvidenceRecord> {
    try { return (await api.post<EvidenceRecord>(`/api/devices/${encodeURIComponent(id)}/forensics/recover`, null, { params: { inode, filename } })).data; }
    catch (error) { throw userFacingError(error); }
  },
  async verifyDeviceWipe(id: string): Promise<VerificationResult> {
    if (agentConnection.isDemoMode()) {
      return {
        device_id: id,
        verified: true,
        method: "NIST SP 800-88 Zero Sample",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        timestamp: new Date().toISOString(),
        details: "100% sample blocks validated. Zero residual data detected.",
      } as any;
    }
    try { return (await api.post<VerificationResult>(`/api/devices/${encodeURIComponent(id)}/verify`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async sanitize(id: string): Promise<EvidenceRecord> {
    try { return (await api.post<EvidenceRecord>(`/api/devices/${encodeURIComponent(id)}/sanitize`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async status(): Promise<SystemStatus> {
    if (agentConnection.isDemoMode()) {
      return {
        status: "ok",
        platform: "Windows (Simulated Sandbox)",
        is_admin: true,
        devices_detected: MOCK_DEVICES.length,
        version: "v1.0-demo",
      } as any;
    }
    try { return (await api.get<SystemStatus>("/api/system/status")).data; }
    catch (error) { throw userFacingError(error); }
  }
};

// In-memory registry for active simulated sanitization jobs
const demoSanitizationJobs = new Map<string, { startTime: number; target: string; pattern: string; method: string; saved?: boolean }>();

export const sanitizationApi = {
  validate: async (deviceId: string) => {
    if (agentConnection.isDemoMode()) {
      const dev = MOCK_DEVICES.find(d => d.id === deviceId);
      if (dev?.system_disk) {
        return { 
          eligible: false, 
          message: "System drive (C:) is protected against destructive sanitization." 
        };
      }
      return { 
        eligible: true, 
        message: "Target validated for cryptographic sanitization. Sector write-locks released." 
      };
    }
    const res = await api.post('/api/sanitization/validate', { device_id: deviceId });
    return res.data;
  },
  start: async (deviceId: string, confirmation: boolean, method = "overwrite", pattern = "zero", targetFilePath: string) => {
    if (agentConnection.isDemoMode()) {
      const jobId = "JOB-NIST-" + Math.floor(Math.random() * 9000 + 1000);
      demoSanitizationJobs.set(jobId, {
        startTime: Date.now(),
        target: targetFilePath || deviceId,
        pattern,
        method,
      });
      return { job_id: jobId, status: "IN_PROGRESS" };
    }
    const res = await api.post('/api/sanitization/start', { device_id: deviceId, method, pattern, confirmation, target_file_path: targetFilePath });
    return res.data;
  },
  getProgress: async (jobId: string) => {
    if (agentConnection.isDemoMode()) {
      const job = demoSanitizationJobs.get(jobId) || {
        startTime: Date.now() - 5000,
        target: "SanDisk Extreme USB 3.2",
        pattern: "zero",
        method: "overwrite",
      };

      const elapsedSec = (Date.now() - job.startTime) / 1000;
      const totalBytes = 64000000000;
      let pct = 0;
      let stage = "Phase 1: Initializing Cryptographic Entropy Stream";
      let isDone = false;
      let speed = 124000000;
      let remaining = 4;

      if (elapsedSec < 1.0) {
        pct = 15;
        stage = "Phase 1: Initializing Cryptographic Entropy Stream";
        remaining = 4;
      } else if (elapsedSec < 2.5) {
        pct = 55;
        stage = `Phase 2: Writing Overwrite Patterns (${job.pattern.toUpperCase()})`;
        remaining = 2;
      } else if (elapsedSec < 3.8) {
        pct = 85;
        stage = "Phase 3: Random Nonce Obfuscation Pass";
        remaining = 1;
      } else {
        pct = 100;
        stage = "Phase 4: NIST SP 800-88 Zero Sample Verification Pass";
        isDone = true;
        speed = 0;
        remaining = 0;

        // Persist to history on completion once
        if (!job.saved) {
          job.saved = true;
          savePersistentSanitizationJob({
            job_id: jobId,
            device_id: job.target,
            target_file_path: job.target,
            pattern: job.pattern,
            method: job.pattern === "dod_5220_22_m" ? "DoD 5220.22-M 3-Pass" : "NIST SP 800-88 Clear",
            completed_at: new Date().toISOString(),
            status: "COMPLETED",
            sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            events: [
              { timestamp: new Date(Date.now() - 4000).toISOString(), event_type: "JOB_START", message: "Sanitization started", severity: "INFO" },
              { timestamp: new Date(Date.now() - 2000).toISOString(), event_type: "PATTERN_PASS", message: "Sector pattern overwrite completed", severity: "INFO" },
              { timestamp: new Date().toISOString(), event_type: "VERIFIED", message: "NIST SP 800-88 sample check confirmed: zero entropy verified", severity: "SUCCESS" }
            ]
          });
        }
      }

      const bytesProcessed = Math.min(totalBytes, Math.floor((pct / 100) * totalBytes));

      return {
        job_id: jobId,
        status: isDone ? "COMPLETED" : "IN_PROGRESS",
        progress_percent: pct,
        bytes_processed: bytesProcessed,
        total_bytes: totalBytes,
        speed_bytes_per_second: speed,
        estimated_seconds_remaining: remaining,
        current_stage: stage,
        device_id: job.target,
      };
    }
    const res = await api.get(`/api/sanitization/${jobId}`);
    return res.data;
  },
  abort: async (jobId: string) => {
    if (agentConnection.isDemoMode()) {
      return { status: "ABORTED", job_id: jobId };
    }
    const res = await api.post(`/api/sanitization/${jobId}/abort`);
    return res.data;
  },
  getHistory: async () => {
    if (agentConnection.isDemoMode()) {
      return getPersistentSanitizationHistory();
    }
    const res = await api.get('/api/sanitization/history');
    return res.data;
  },
  getCertificateUrl: (jobId: string) => {
    if (agentConnection.isDemoMode()) {
      const job = getPersistentSanitizationHistory().find((j: any) => j.job_id === jobId) || {
        job_id: jobId,
        method: "NIST SP 800-88 Clear",
        target_file_path: "\\\\.\\PHYSICALDRIVE1 (SanDisk 64GB)",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        completed_at: new Date().toISOString(),
      };
      const blob = generateCertificateBlob(job);
      return window.URL.createObjectURL(blob);
    }
    const base = agentConnection.getApiBaseUrl();
    const prefix = base ? base.replace(/\/$/, "") : "";
    return `${prefix}/api/sanitization/${encodeURIComponent(jobId)}/certificate`;
  }
};
