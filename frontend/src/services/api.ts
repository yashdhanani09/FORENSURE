import axios from "axios";
import type { DeviceAnalysis, DeviceListResponse, FileBrowserResponse, UsbDeviceDetail, EvidenceRecord, EvidenceListResponse, ForensicScanResponse, VerificationResult } from "../types/device";
import type { SystemStatus } from "../types/system";
import { agentConnection } from "./agentConnection";
import { MOCK_DEVICES, MOCK_DEVICE_LIST_RESPONSE, MOCK_HISTORY_JOBS } from "./mockData";

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
      // If agent is offline and user hasn't toggled demo mode yet, throw or fall back
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
    try { return (await api.post<DeviceAnalysis>(`/api/devices/${encodeURIComponent(id)}/analyze`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async files(id: string, params: { path?: string; search?: string; kind?: string; sort_by?: string; sort_order?: string }): Promise<FileBrowserResponse> {
    try { return (await api.get<FileBrowserResponse>(`/api/devices/${encodeURIComponent(id)}/files`, { params })).data; }
    catch (error) { throw userFacingError(error); }
  },
  async previewFile(id: string, path: string): Promise<{ content: string; type: string }> {
    try { return (await api.get<{ content: string; type: string }>(`/api/devices/${encodeURIComponent(id)}/files/content`, { params: { path } })).data; }
    catch (error) { throw userFacingError(error); }
  },
  async hashFile(id: string, path: string): Promise<EvidenceRecord> {
    try { return (await api.post<EvidenceRecord>(`/api/devices/${encodeURIComponent(id)}/files/hash`, null, { params: { path } })).data; }
    catch (error) { throw userFacingError(error); }
  },
  async listEvidence(id: string): Promise<EvidenceListResponse> {
    try { return (await api.get<EvidenceListResponse>(`/api/devices/${encodeURIComponent(id)}/evidence`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async scanDeletedFiles(id: string): Promise<ForensicScanResponse> {
    try { return (await api.get<ForensicScanResponse>(`/api/devices/${encodeURIComponent(id)}/forensics/scan`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async recoverDeletedFile(id: string, inode: string, filename: string): Promise<EvidenceRecord> {
    try { return (await api.post<EvidenceRecord>(`/api/devices/${encodeURIComponent(id)}/forensics/recover`, null, { params: { inode, filename } })).data; }
    catch (error) { throw userFacingError(error); }
  },
  async verifyDeviceWipe(id: string): Promise<VerificationResult> {
    try { return (await api.post<VerificationResult>(`/api/devices/${encodeURIComponent(id)}/verify`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async sanitize(id: string): Promise<EvidenceRecord> {
    try { return (await api.post<EvidenceRecord>(`/api/devices/${encodeURIComponent(id)}/sanitize`)).data; }
    catch (error) { throw userFacingError(error); }
  },
  async status(): Promise<SystemStatus> {
    try { return (await api.get<SystemStatus>("/api/system/status")).data; }
    catch (error) { throw userFacingError(error); }
  }
};

export const sanitizationApi = {
  validate: async (deviceId: string) => {
    if (agentConnection.isDemoMode()) {
      return { eligible: true, message: "Target validated for cryptographic sanitization." };
    }
    const res = await api.post('/api/sanitization/validate', { device_id: deviceId });
    return res.data;
  },
  start: async (deviceId: string, confirmation: boolean, method = "overwrite", pattern = "zero", targetFilePath: string) => {
    if (agentConnection.isDemoMode()) {
      return { job_id: "JOB-DEMO-" + Math.floor(Math.random() * 9000 + 1000), status: "IN_PROGRESS" };
    }
    const res = await api.post('/api/sanitization/start', { device_id: deviceId, method, pattern, confirmation, target_file_path: targetFilePath });
    return res.data;
  },
  getProgress: async (jobId: string) => {
    if (agentConnection.isDemoMode()) {
      return {
        job_id: jobId,
        status: "COMPLETED",
        progress_pct: 100,
        bytes_written: 64000000000,
        total_bytes: 64000000000,
        phase: "VERIFY_ZERO_SAMPLE_PASS",
      };
    }
    const res = await api.get(`/api/sanitization/${jobId}`);
    return res.data;
  },
  abort: async (jobId: string) => {
    const res = await api.post(`/api/sanitization/${jobId}/abort`);
    return res.data;
  },
  getHistory: async () => {
    if (agentConnection.isDemoMode()) {
      return MOCK_HISTORY_JOBS;
    }
    const res = await api.get('/api/sanitization/history');
    return res.data;
  },
  getCertificateUrl: (jobId: string) => {
    const base = agentConnection.getApiBaseUrl();
    const prefix = base ? base.replace(/\/$/, "") : "";
    return `${prefix}/api/sanitization/${encodeURIComponent(jobId)}/certificate`;
  }
};
