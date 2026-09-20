import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, HardDrive, AlertTriangle, CheckCircle2, 
  FileText, Download, Play, XOctagon, RefreshCw,
  FolderOpen, Award, ArrowRight, ShieldCheck, History, Clock, Check
} from "lucide-react";
import { deviceApi, sanitizationApi } from "../services/api";
import { FileBrowser } from "../components/FileBrowser";
import type { UsbDeviceDetail, FileEntry } from "../types/device";
import { formatBytes, formatDate } from "../utils/format";
import { Button } from "../components/ui/button";

type SanitizationPattern = "zero" | "random" | "dod_5220_22_m";

interface HistoryJob {
  job_id: string;
  device_id: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  method: string;
  pattern: string;
  target_file_path?: string;
  verification_result?: string;
  certificate_hash?: string;
  events?: Array<{ timestamp: string; event_type: string; message: string; severity: string }>;
}

export function Sanitization() {
  const [devices, setDevices] = useState<UsbDeviceDetail[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedDevice, setSelectedDevice] = useState<UsbDeviceDetail | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(true);

  // Sanitization Options
  const [pattern, setPattern] = useState<SanitizationPattern>("zero");
  const [targetFilePath, setTargetFilePath] = useState<string>("");
  const [selectedFileMeta, setSelectedFileMeta] = useState<FileEntry | null>(null);

  // Safety & Validation
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  // Active Job
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<any>(null);
  const [isSanitizing, setIsSanitizing] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  // History & Tabs
  const [historyJobs, setHistoryJobs] = useState<HistoryJob[]>([]);
  const [activeTab, setActiveTab] = useState<"sanitize" | "history">("sanitize");
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadDevices();
    loadHistory();
  }, []);

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await deviceApi.list();
      const list = res.devices || [];
      setDevices(list);
      // Auto-select first safe data volume or removable disk
      const safe = list.find(d => !d.system_disk) || list[0];
      if (safe) {
        selectDevice(safe);
      }
    } catch (e: any) {
      console.error("Failed to load devices", e);
    } finally {
      setLoadingDevices(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await sanitizationApi.getHistory();
      setHistoryJobs(history || []);
    } catch (e: any) {
      console.error("Failed to load history", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const selectDevice = async (dev: UsbDeviceDetail) => {
    setSelectedDeviceId(dev.id);
    setSelectedDevice(dev);
    setTargetFilePath("");
    setSelectedFileMeta(null);
    setValidationResult(null);

    if (dev.system_disk) {
      setValidationResult({
        safe: false,
        warnings: ["BLOCKED — SYSTEM DISK (Operating system boot partition is strictly protected from erasure)"]
      });
      return;
    }

    setValidating(true);
    try {
      const val = await sanitizationApi.validate(dev.id);
      setValidationResult(val);
    } catch (err: any) {
      setValidationResult({
        safe: false,
        warnings: [err.response?.data?.detail || err.message || "Device safety validation failed."]
      });
    } finally {
      setValidating(false);
    }
  };

  // Poll active job progress
  useEffect(() => {
    let timer: any = null;
    if (activeJobId && isSanitizing) {
      timer = setInterval(async () => {
        try {
          const progress = await sanitizationApi.getProgress(activeJobId);
          setJobProgress(progress);
          if (progress.status === "COMPLETED") {
            setIsSanitizing(false);
            loadHistory();
          } else if (progress.status === "FAILED" || progress.status === "ABORTED") {
            setIsSanitizing(false);
            setJobError(progress.error_message || "Sanitization process was stopped or failed.");
            loadHistory();
          }
        } catch (e: any) {
          console.error("Polling error", e);
        }
      }, 800);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeJobId, isSanitizing]);

  const handleStartSanitization = async () => {
    if (confirmInput !== "SANITIZE FILE") return;
    if (!selectedDevice || !targetFilePath) return;

    setConfirmModalOpen(false);
    setIsSanitizing(true);
    setJobError(null);
    setJobProgress(null);

    try {
      const res = await sanitizationApi.start(
        selectedDevice.id,
        true,
        "overwrite",
        pattern,
        targetFilePath
      );
      setActiveJobId(res.job_id);
    } catch (e: any) {
      setIsSanitizing(false);
      setJobError(e.response?.data?.detail || e.message || "Failed to initiate sanitization job.");
    }
  };

  const handleAbort = async () => {
    if (!activeJobId) return;
    try {
      await sanitizationApi.abort(activeJobId);
    } catch (e: any) {
      console.error("Failed to abort", e);
    }
  };

  const patternDescriptions = {
    zero: {
      name: "NIST SP 800-88 Clear (Single-Pass Zeros)",
      desc: "Writes binary 0x00 across all sectors of the target. Standard compliant for modern solid-state and magnetic storage.",
      passes: "1 Pass",
      badge: "Fast & Certified"
    },
    random: {
      name: "Cryptographic Pseudorandom Overwrite",
      desc: "Writes high-entropy cryptographically pseudo-random bytes, defeating microscopic magnetic or electrical domain remnants.",
      passes: "1 Pass",
      badge: "High Entropy"
    },
    dod_5220_22_m: {
      name: "DoD 5220.22-M (3-Pass Military Wipe)",
      desc: "Triple overwrite sequence: Pass 1 with 0x00, Pass 2 with 0xFF, Pass 3 with pseudo-random noise, followed by verification.",
      passes: "3 Passes",
      badge: "Defense Standard"
    }
  };

  return (
    <div className="w-full max-w-[1850px] mx-auto px-6 sm:px-10 lg:px-14 xl:px-16 py-8 space-y-8 page-enter">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shrink-0">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                Data Sanitization & Secure Erase
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-4xl">
                NIST SP 800-88 Rev 1 & DoD 5220.22-M compliant cryptographic sanitization with chain-of-custody verification.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-surface-card p-1.5 rounded-2xl border border-border-subtle">
          <button
            onClick={() => setActiveTab("sanitize")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === "sanitize" 
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="h-4.5 w-4.5" />
            Sanitize Engine
          </button>
          <button
            onClick={() => { setActiveTab("history"); loadHistory(); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === "history" 
                ? "bg-signal/20 text-signal border border-signal/30 shadow-sm" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="h-4.5 w-4.5" />
            Audit History ({historyJobs.length})
          </button>
        </div>
      </div>

      {activeTab === "sanitize" && (
        <div className="space-y-8">
          {/* Active Job Progress View (Shown when a job is active or just completed) */}
          {activeJobId && (
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 rounded-xl ${
                    jobProgress?.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                    jobProgress?.status === "FAILED" || jobProgress?.status === "ABORTED" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                    "bg-signal/20 text-signal border border-signal/30 animate-pulse"
                  }`}>
                    {jobProgress?.status === "COMPLETED" ? <CheckCircle2 className="h-6 w-6" /> :
                     jobProgress?.status === "FAILED" || jobProgress?.status === "ABORTED" ? <AlertTriangle className="h-6 w-6" /> :
                     <RefreshCw className="h-6 w-6 animate-spin" />}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      {jobProgress?.status === "COMPLETED" ? "Sanitization Completed & Cryptographically Verified" :
                       jobProgress?.status === "FAILED" ? "Sanitization Failed" :
                       jobProgress?.status === "ABORTED" ? "Sanitization Aborted" :
                       "Sanitization in Progress"}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 font-mono">Job ID: {activeJobId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isSanitizing && (
                    <Button
                      variant="destructive"
                      size="default"
                      className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl"
                      onClick={handleAbort}
                    >
                      <XOctagon className="h-4 w-4 mr-1.5" /> Abort Job
                    </Button>
                  )}
                  {jobProgress?.status === "COMPLETED" && (
                    <a
                      href={sanitizationApi.getCertificateUrl(activeJobId)}
                      download
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold transition shadow-lg"
                    >
                      <Download className="h-4 w-4" /> Download Certificate (PDF)
                    </a>
                  )}
                  {!isSanitizing && (
                    <Button
                      variant="secondary"
                      size="default"
                      className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl"
                      onClick={() => { setActiveJobId(null); setJobProgress(null); }}
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>

              {jobError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-mono">
                  Error Details: {jobError}
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400 font-medium">
                    Current Phase: <strong className="text-white">{jobProgress?.current_stage || "Initializing"}</strong>
                  </span>
                  <span className="text-signal font-bold font-mono">
                    {(jobProgress?.progress_percent || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3.5 bg-canvas rounded-full overflow-hidden border border-border-subtle">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      jobProgress?.status === "COMPLETED" ? "bg-emerald-500" :
                      jobProgress?.status === "FAILED" ? "bg-rose-500" :
                      "bg-gradient-to-r from-signal to-blue-500"
                    }`}
                    style={{ width: `${jobProgress?.progress_percent || 0}%` }}
                  />
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface p-4 rounded-xl border border-border-subtle overflow-hidden">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block truncate">Processed</span>
                  <p className="text-base font-bold text-white font-mono mt-1 truncate">
                    {formatBytes(jobProgress?.bytes_processed || 0)} / {formatBytes(jobProgress?.total_bytes || 0)}
                  </p>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-border-subtle overflow-hidden">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block truncate">Write Speed</span>
                  <p className="text-base font-bold text-signal font-mono mt-1 truncate">
                    {formatBytes(jobProgress?.speed_bytes_per_second || 0)}/s
                  </p>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-border-subtle overflow-hidden">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block truncate">Estimated Time</span>
                  <p className="text-base font-bold text-white font-mono mt-1 truncate">
                    {jobProgress?.estimated_seconds_remaining || 0}s remaining
                  </p>
                </div>
                <div className="bg-surface p-4 rounded-xl border border-border-subtle overflow-hidden">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block truncate">Target Device</span>
                  <p className="text-base font-bold text-slate-200 truncate mt-1" title={selectedDevice?.model || jobProgress?.device_id}>
                    {selectedDevice?.model || jobProgress?.device_id}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Storage Device Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold tracking-widest text-signal uppercase font-mono">STEP 1</span>
                <h2 className="text-xl font-bold text-white">Select Storage Target</h2>
              </div>
              <Button 
                variant="ghost"
                size="default"
                className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl"
                onClick={loadDevices}
                disabled={loadingDevices}
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingDevices ? "animate-spin" : ""}`} />
                Refresh Devices
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {devices.map((dev) => {
                const isSelected = selectedDeviceId === dev.id;
                const isSystem = dev.system_disk;
                const isMobile = dev.device_type === "MOBILE_DEVICE";

                return (
                  <div
                    key={dev.id}
                    onClick={() => selectDevice(dev)}
                    className={`relative rounded-2xl p-6 border cursor-pointer transition-all overflow-hidden ${
                      isSelected 
                        ? "border-signal/80 bg-signal/[0.05] shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-signal/50" 
                        : isSystem 
                        ? "border-rose-500/20 bg-rose-500/[0.03] hover:border-rose-500/40" 
                        : "border-border-subtle bg-surface-card hover:border-border-strong hover:bg-surface-elevated/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={`p-3 rounded-xl shrink-0 ${
                          isSystem ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          isMobile ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                          "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}>
                          <HardDrive className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-base text-white truncate" title={`${dev.vendor ? `${dev.vendor} ` : ""}${dev.model || ""}`}>
                            {dev.vendor ? `${dev.vendor} ` : ""}{dev.model}
                          </h4>
                          <p className="text-xs text-slate-400 font-mono truncate mt-0.5" title={dev.device_path}>
                            {dev.device_path}
                          </p>
                        </div>
                      </div>

                      <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap ${
                        isSystem ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                        isMobile ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                        "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {isSystem ? "SYSTEM OS" : (dev.device_type === "MOBILE_DEVICE" ? "MOBILE" : dev.device_type === "DATA_VOLUME" ? "VOLUME" : "STORAGE")}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs sm:text-sm text-slate-400 border-t border-border-subtle pt-3.5">
                      <div className="flex justify-between items-center gap-2">
                        <span className="shrink-0 text-slate-400">Capacity</span>
                        <span className="font-mono text-slate-100 font-bold truncate text-right">
                          {formatBytes(dev.capacity_bytes || dev.size_bytes || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="shrink-0 text-slate-400">Mount Point</span>
                        <span className="font-mono text-slate-200 truncate text-right max-w-[160px]" title={dev.mount_point || "None"}>
                          {dev.mount_point || "None"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="shrink-0 text-slate-400">Safety Clearance</span>
                        <span className={`font-semibold shrink-0 text-right ${isSystem ? "text-rose-400" : "text-emerald-400"}`}>
                          {isSystem ? "Blocked (System OS)" : "Cleared for Erase"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Warnings if any */}
          {validationResult && !validationResult.safe && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0" />
              <div>
                <strong className="block font-bold">Sanitization Guard Triggered:</strong>
                {validationResult.warnings?.join(". ")}
              </div>
            </div>
          )}

          {/* STEP 2: Choose Method / Standard */}
          {selectedDevice && !selectedDevice.system_disk && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold tracking-widest text-signal uppercase font-mono">STEP 2</span>
                <h2 className="text-xl font-bold text-white">Select Sanitization Standard</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {(Object.keys(patternDescriptions) as SanitizationPattern[]).map((key) => {
                  const item = patternDescriptions[key];
                  const isChecked = pattern === key;

                  return (
                    <div
                      key={key}
                      onClick={() => setPattern(key)}
                      className={`p-6 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between overflow-hidden ${
                        isChecked 
                          ? "border-signal/80 bg-signal/[0.05] shadow-[0_0_20px_rgba(6,182,212,0.12)] ring-1 ring-signal/50" 
                          : "border-border-subtle bg-surface-card hover:border-border-strong hover:bg-surface-elevated/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <span className="text-sm sm:text-base font-bold text-white min-w-0 flex-1 leading-snug">{item.name}</span>
                          <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg bg-signal/10 text-signal border border-signal/20 whitespace-nowrap">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 break-words">{item.desc}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 border-t border-border-subtle pt-3.5 font-mono">
                        <span>Passes: <strong className="text-slate-200">{item.passes}</strong></span>
                        <span className="text-signal font-semibold flex items-center gap-1.5 shrink-0">
                          {isChecked ? <><Check className="h-4 w-4" /> SELECTED</> : "Click to select"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Target File Selection */}
          {selectedDevice && !selectedDevice.system_disk && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold tracking-widest text-signal uppercase font-mono">STEP 3</span>
                  <h2 className="text-xl font-bold text-white">Select Target File on {selectedDevice.model}</h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                    Use the integrated browser below to locate the sensitive file to securely sanitize, or click "Securely Sanitize File" on any item.
                  </p>
                </div>

                {targetFilePath && (
                  <div className="flex items-center gap-3.5 bg-rose-500/10 border border-rose-500/30 px-5 py-3 rounded-2xl max-w-full overflow-hidden shrink-0">
                    <FileText className="h-5 w-5 text-rose-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-rose-400 uppercase font-bold block">Selected for Erase:</span>
                      <span className="text-xs sm:text-sm font-mono text-white font-semibold truncate block max-w-[240px]" title={targetFilePath}>{targetFilePath}</span>
                    </div>
                    <Button
                      variant="destructive"
                      size="default"
                      onClick={() => setConfirmModalOpen(true)}
                      className="ml-2 h-11 px-5 text-xs sm:text-sm font-bold shrink-0 whitespace-nowrap rounded-xl shadow-md"
                    >
                      <Play className="h-4 w-4 mr-1.5 fill-current" /> Proceed to Erase
                    </Button>
                  </div>
                )}
              </div>

              {/* File Browser Component */}
              <FileBrowser 
                deviceId={selectedDevice.id}
                onSanitizeFile={(file) => {
                  setTargetFilePath(file.path);
                  setSelectedFileMeta(file);
                  setConfirmModalOpen(true);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Audit History Tab */}
      {activeTab === "history" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Sanitization Audit Log & Certificates</h2>
              <p className="text-sm text-slate-300 mt-0.5">
                Tamper-evident record of all previous sanitization runs with cryptographic verification hashes.
              </p>
            </div>
            <Button
              variant="outline"
              size="default"
              className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl"
              onClick={loadHistory}
              disabled={loadingHistory}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingHistory ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {historyJobs.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-card p-12 text-center">
              <History className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No Sanitization History Recorded</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Once a file or volume is sanitized, the cryptographic audit record and certificate will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden shadow-xl">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle bg-surface text-slate-300 font-extrabold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4.5">Job ID</th>
                    <th className="px-6 py-4.5">Target File</th>
                    <th className="px-6 py-4.5">Standard / Method</th>
                    <th className="px-6 py-4.5">Timestamp</th>
                    <th className="px-6 py-4.5">Verification</th>
                    <th className="px-6 py-4.5 text-right">Certificate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono">
                  {historyJobs.map((job) => (
                    <tr key={job.job_id} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4.5 font-bold text-slate-200">{job.job_id}</td>
                      <td className="px-6 py-4.5 text-slate-200 max-w-[220px] truncate font-sans" title={job.target_file_path}>
                        {job.target_file_path || "—"}
                      </td>
                      <td className="px-6 py-4.5 uppercase text-slate-400 text-xs font-bold">
                        {job.method} ({job.pattern})
                      </td>
                      <td className="px-6 py-4.5 text-slate-300 font-sans">
                        {job.completed_at ? formatDate(job.completed_at) : job.started_at ? formatDate(job.started_at) : "—"}
                      </td>
                      <td className="px-6 py-4.5">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          job.verification_result === "PASSED" || job.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          {job.verification_result || job.status}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 font-sans text-right">
                        <a
                          href={sanitizationApi.getCertificateUrl(job.job_id)}
                          download
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-signal/10 hover:bg-signal/20 text-signal text-xs sm:text-sm font-semibold transition border border-signal/20"
                        >
                          <Download className="h-4 w-4" /> PDF Cert
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border-2 border-rose-500/50 bg-surface-card p-6 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Permanent Sanitization</h3>
                <p className="text-xs text-rose-300">Irreversible cryptographic data destruction</p>
              </div>
            </div>

            <div className="bg-canvas p-4 rounded-xl border border-border-subtle space-y-2.5 text-xs font-mono">
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-slate-500">Target Drive:</span>
                <span className="text-slate-200">{selectedDevice?.vendor} {selectedDevice?.model}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-slate-500">Target File:</span>
                <span className="text-rose-400 font-bold break-all">/{targetFilePath}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-slate-500">Algorithm:</span>
                <span className="text-signal uppercase">{pattern} Overwrite</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Standard:</span>
                <span className="text-slate-300">{patternDescriptions[pattern].name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                To confirm permanent erasure, type <strong className="text-rose-400 font-mono bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800">SANITIZE FILE</strong> below:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="SANITIZE FILE"
                className="w-full bg-canvas border border-border-subtle rounded-xl px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setConfirmModalOpen(false); setConfirmInput(""); }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleStartSanitization}
                disabled={confirmInput !== "SANITIZE FILE"}
              >
                <ShieldAlert className="h-4 w-4" /> Confirm & Erase
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

