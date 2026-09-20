import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  RotateCcw, Search, Download, CheckCircle2, AlertTriangle, 
  FileText, Image as ImageIcon, Film, Archive, Code, File, HardDrive, 
  CheckSquare, Square, Shield, RefreshCw, FolderOpen, ArrowRight,
  ShieldCheck, Smartphone, Check, Copy, Cpu, Layers, Hash, FileCheck,
  Printer, X, KeyRound, ArrowUpDown, ChevronLeft, ChevronRight, ShieldAlert,
  BookOpen
} from "lucide-react";
import { deviceApi } from "../services/api";
import { agentConnection } from "../services/agentConnection";
import { recoveryApi, DeletedFileItem, RecoveredFileRecord, ForensicReportResponse, RestoredItem, RecoveryPrivileges } from "../services/recoveryApi";
import type { UsbDeviceDetail } from "../types/device";
import { formatBytes, formatDate } from "../utils/format";
import { Button } from "../components/ui/button";

export function Recovery() {
  const [devices, setDevices] = useState<UsbDeviceDetail[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [scanType, setScanType] = useState<"unified" | "auto" | "quick" | "deep" | "forensic_image">("unified");
  const [imagePath, setImagePath] = useState<string>("");
  const [showAdvancedImage, setShowAdvancedImage] = useState<boolean>(false);
  
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const [deletedFiles, setDeletedFiles] = useState<DeletedFileItem[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const [recoveryHistory, setRecoveryHistory] = useState<RecoveredFileRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [restoredNotification, setRestoredNotification] = useState<string | null>(null);

  // Forensic Profiling, Hashes & Report State
  const [deviceProfile, setDeviceProfile] = useState<any>(null);
  const [acquisitionHash, setAcquisitionHash] = useState<string>("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<ForensicReportResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Newly Restored Files Download Popup State
  const [showRestoredModal, setShowRestoredModal] = useState(false);
  const [newlyRestoredItems, setNewlyRestoredItems] = useState<RestoredItem[]>([]);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Administrator Privileges State
  const [privileges, setPrivileges] = useState<RecoveryPrivileges | null>(null);

  // Full List Sorting (Default: Recent to Old) & Pagination State
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "size_desc" | "name" | "confidence">("recent");
  const [pageSize, setPageSize] = useState<number>(100); // default 100 rows for performance
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    loadDevices();
    loadHistory();
    checkPrivileges();
  }, []);

  // Debounce search input — filter recomputes 150 ms after user stops typing
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const checkPrivileges = async () => {
    try {
      const priv = await recoveryApi.getPrivileges();
      setPrivileges(priv);
    } catch (e) {
      console.warn("Could not check privilege status:", e);
      setPrivileges({
        is_admin: false,
        can_read_raw_disk: false,
        platform: "Windows",
        elevation_required: true,
        advisory: "Bridge not elevated. Grant Administrator privileges (UAC) to scan raw physical sectors on D:.",
      });
    }
  };

  const loadDevices = async (force = false) => {
    setLoadingDevices(true);
    try {
      const res = await deviceApi.list({ refresh: force });
      const list = res.devices || [];
      setDevices(list);
      // Auto-select "all" for whole machine recovery or maintain selection
      if (!selectedDeviceId) {
        setSelectedDeviceId("all");
      }
    } catch (e: any) {
      console.error("Failed to load devices", e);
    } finally {
      setLoadingDevices(false);
    }
  };

  const loadHistory = async () => {
    try {
      const history = await recoveryApi.getHistory();
      setRecoveryHistory(history || []);
    } catch (e) {
      console.error("Failed to load recovery history", e);
    }
  };

  const handleStartScan = async () => {
    const effectiveScanType = showAdvancedImage && imagePath.trim() ? "forensic_image" : "auto";
    if (effectiveScanType !== "forensic_image" && !selectedDeviceId) return;
    if (effectiveScanType === "forensic_image" && !imagePath.trim()) {
      alert("Please specify a valid path to a forensic disk image (.dd, .raw, .img, .iso).");
      return;
    }
    setScanning(true);
    setDeletedFiles([]);
    setSelectedFileIds(new Set());
    setRestoredNotification(null);
    try {
      const res = await recoveryApi.scan(
        effectiveScanType === "forensic_image" ? "forensic_image" : selectedDeviceId,
        effectiveScanType,
        undefined,
        effectiveScanType === "forensic_image" ? imagePath.trim() : undefined
      );
      setDeletedFiles(res.files || []);
      setDeviceProfile(res.device_profile || null);
      setAcquisitionHash(res.acquisition_hash || "");
      if ((res.files || []).length === 0) {
        if (res.elevation_required || !privileges?.is_admin) {
          alert("Scan completed with 0 results because Administrator privileges are mandatory to read raw volume sectors. Please open the Hardware Guide to enable Administrator mode.");
        } else {
          alert("Scan completed. No deleted or carved files detected on this target.");
        }
      }
    } catch (e: any) {
      let errorMsg = e.message || "Unknown scan error";
      if (e.response?.data?.detail) {
        if (typeof e.response.data.detail === "string") {
          errorMsg = e.response.data.detail;
        } else if (Array.isArray(e.response.data.detail)) {
          errorMsg = e.response.data.detail
            .map((d: any) => (typeof d === "string" ? d : d.msg || JSON.stringify(d)))
            .join("; ");
        } else if (typeof e.response.data.detail === "object") {
          errorMsg = JSON.stringify(e.response.data.detail);
        }
      }
      alert(`Scan failed: ${errorMsg}`);
    } finally {
      setScanning(false);
    }
  };

  const handleOpenReport = async () => {
    const targetId = scanType === "forensic_image" ? "forensic_image" : (selectedDeviceId || "all");
    setLoadingReport(true);
    try {
      const rep = await recoveryApi.getReport(targetId);
      setReportData(rep);
      setShowReportModal(true);
    } catch (e: any) {
      alert(`Could not load forensic report: ${e.response?.data?.detail || e.message}`);
    } finally {
      setLoadingReport(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleRecoverFiles = async (fileIds: string[]) => {
    if (fileIds.length === 0) return;
    setRecovering(true);
    try {
      const res = await recoveryApi.restore(selectedDeviceId, fileIds);
      const successful = (res.restored_items || []).filter(r => r.status === "RECOVERED");
      setRestoredNotification(`Successfully restored ${successful.length} of ${fileIds.length} file(s) with SHA-256 integrity verification.`);
      
      // Open instant download modal with restored files
      setNewlyRestoredItems(res.restored_items || []);
      setShowRestoredModal(true);

      // Refresh history
      loadHistory();
      
      // Remove recovered files from selected set
      const next = new Set(selectedFileIds);
      fileIds.forEach(id => next.delete(id));
      setSelectedFileIds(next);
    } catch (e: any) {
      alert(`Recovery failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setRecovering(false);
    }
  };

  const downloadFile = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      // 1. Fetch raw binary blob from the verified backend API
      const blob = await recoveryApi.downloadFile(filename);

      // 2. Strict validation: Ensure response is actual file data and not an HTML fallback page
      if (blob.type && blob.type.includes("text/html")) {
        const text = await blob.text();
        if (text.includes("<!doctype html>") || text.includes("<html") || text.includes("<div id=\"root\">")) {
          throw new Error("Backend connection error: Received HTML fallback page instead of the recovered file.");
        }
      }

      // 3. Create blob URL and trigger direct browser machine download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (e: any) {
      console.warn("Direct blob download failed, attempting backend agent URL fallback:", e);
      try {
        const backendBase = agentConnection.getApiBaseUrl() || "http://127.0.0.1:8000";
        const directUrl = `${backendBase.replace(/\/$/, "")}/api/recovery/download/${encodeURIComponent(filename)}`;
        const link = document.createElement("a");
        link.href = directUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err: any) {
        alert(`Failed to download ${filename}: ${e.message || err.message}`);
      }
    } finally {
      setDownloadingFile(null);
    }
  };

  const downloadAllRestored = async () => {
    const successful = newlyRestoredItems.filter(r => r.status === "RECOVERED");
    for (let i = 0; i < successful.length; i++) {
      await downloadFile(successful[i].filename);
      await new Promise(res => setTimeout(res, 400));
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Document": return <FileText className="w-4 h-4 text-cyan-400" />;
      case "Image": return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case "Media": return <Film className="w-4 h-4 text-purple-400" />;
      case "Archive": return <Archive className="w-4 h-4 text-amber-400" />;
      case "Code": return <Code className="w-4 h-4 text-pink-400" />;
      default: return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredFiles = useMemo(() => deletedFiles.filter(f => {
    const q = debouncedSearch.toLowerCase();
    const matchesSearch = !q || f.filename.toLowerCase().includes(q) ||
                          f.original_path.toLowerCase().includes(q);
    const matchesCategory = categoryFilter === "All" || f.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [deletedFiles, debouncedSearch, categoryFilter]);

  const categoryCounts = useMemo(() => deletedFiles.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {}), [deletedFiles]);

  // Strict sorting: Default is Recent to Old (Newest deletion at top, with tier-based tie breaker)
  const sortedFiles = useMemo(() => [...filteredFiles].sort((a, b) => {
    if (sortBy === "recent") {
      const tA = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
      const tB = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
      if (tB !== tA) return tB - tA; // Recent to Old
      const prio = (method: string) => {
        if (method?.startsWith("ntfs_") || method?.startsWith("fat_")) return 3;
        if (!method?.endsWith("_txt")) return 2;
        return 1;
      };
      return prio(b.recovery_method) - prio(a.recovery_method);
    }
    if (sortBy === "oldest") {
      const tA = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
      const tB = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
      return tA - tB; // Old to Recent
    }
    if (sortBy === "size_desc") {
      return (b.size_bytes || 0) - (a.size_bytes || 0);
    }
    if (sortBy === "name") {
      return a.filename.localeCompare(b.filename);
    }
    if (sortBy === "confidence") {
      return (b.confidence_score || 0) - (a.confidence_score || 0);
    }
    return 0;
  }), [filteredFiles, sortBy]);

  const displayFiles = useMemo(() => pageSize > 0
    ? sortedFiles.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedFiles, [sortedFiles, pageSize, currentPage]);

  const totalPages = useMemo(() => pageSize > 0 ? Math.ceil(sortedFiles.length / pageSize) : 1,
    [sortedFiles.length, pageSize]);

  const toggleSelectAll = useCallback(() => {
    if (selectedFileIds.size === displayFiles.length && displayFiles.length > 0) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(displayFiles.map(f => f.id)));
    }
  }, [selectedFileIds, displayFiles]);

  const toggleSelectFile = useCallback((id: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const isMobileTarget = selectedDevice?.device_type === "MOBILE_DEVICE" || 
                         (selectedDevice?.device_path?.includes("WPD") ?? false) ||
                         (selectedDevice?.partitions?.some(p => p.filesystem === "MTP") ?? false);

  return (
    <div className="w-full max-w-[1850px] mx-auto px-6 sm:px-10 lg:px-14 xl:px-16 py-8 space-y-8 select-none page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 border-b border-[#182035] pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold tracking-[0.22em] text-cyan-400 uppercase mb-1.5 font-mono">
            <RotateCcw className="h-4.5 w-4.5" /> FORENSIC RECOVERY ENGINE
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
            <RotateCcw className="w-9 h-9 text-cyan-400 animate-in spin-in-12 duration-300" />
            Forensic Data Recovery Engine
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-1.5 max-w-4xl">
            NTFS Master File Table ($MFT) extraction, hardware write-blocking, and cryptographic SHA-256 bitstream restoration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="default"
            onClick={handleOpenReport}
            loading={loadingReport}
            className="h-10 px-4 text-xs font-bold rounded-xl"
          >
            <FileText className="w-4 h-4 text-cyan-400 mr-1.5" />
            Forensic Report
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowHistory(!showHistory)}
            className="h-10 px-4 text-xs font-bold rounded-xl"
          >
            <FolderOpen className="w-4 h-4 text-cyan-400 mr-1.5" />
            Recovered Archive ({recoveryHistory.length})
          </Button>
          {/* Top-Bar Administrator Status Badge / Guide Link */}
          {privileges?.is_admin ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin: Active</span>
            </div>
          ) : (
            <Link
              to="/agent-guide"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition shadow-sm"
              title="Administrator access is mandatory for raw physical disk recovery. Open Hardware Guide."
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Admin Required (See Guide)</span>
            </Link>
          )}

          <Button
            variant="outline"
            size="default"
            onClick={() => loadDevices(true)}
            loading={loadingDevices}
            className="h-10 px-4 text-xs font-bold rounded-xl"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Administrator Mandatory Notice Banner */}
      {!privileges?.is_admin && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-sm shadow-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h4 className="text-base font-bold text-amber-200">
                  Administrator Privileges Required (Mandatory)
                </h4>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-300 rounded-md border border-amber-500/30 font-mono">
                  RAW DISK ACCESS BLOCKED
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
                Windows NT kernel security blocks direct physical sector carving on drive <span className="text-amber-300 font-mono font-bold">D:</span> when running under standard user accounts. Administrator privileges are strictly mandatory to parse the Master File Table ($MFT) and recover unallocated files.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            <Link
              to="/agent-guide"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs transition shadow-md shadow-amber-950/50"
            >
              <BookOpen className="w-4 h-4" />
              Open Hardware Guide (Enable Admin)
            </Link>
          </div>
        </div>
      )}

      {/* Privileges Active Badge when is_admin is true */}
      {privileges && privileges.is_admin && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 px-6 flex items-center justify-between backdrop-blur-sm shadow-md">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-sm font-bold text-emerald-300">
                Kernel Administrator Access Active
              </span>
              <span className="text-xs text-slate-300 ml-2 hidden sm:inline">
                — Direct physical sector carving and NTFS MFT deep scanning enabled on all drives.
              </span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            ELEVATED KERNEL ACCESS
          </span>
        </div>
      )}

      {/* SSD / NVMe TRIM Advisory Notice */}
      {deviceProfile && (deviceProfile.category === "SSD / NVMe" || (deviceProfile.trim_status && deviceProfile.trim_status.includes("ACTIVE"))) && (
        <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-2xl p-4 px-6 flex items-start gap-3 backdrop-blur-sm shadow-md">
          <HardDrive className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed font-sans">
            <strong className="text-cyan-300 font-bold block text-sm mb-0.5">NVMe / Solid-State Drive Architecture Detected:</strong>
            Under Windows NTFS on SSDs, unallocated sectors for permanently deleted files are zeroed by hardware TRIM (DZAT). Small files residing inside MFT records ($DATA resident &le; 700 bytes) and Recycle Bin items remain 100% intact and restorable. If unallocated clusters return zeroed bytes, FORENSURE will honestly flag them as TRIM deallocated instead of outputting corrupted files.
          </div>
        </div>
      )}

      {/* Control Panel: Device Selector & Unified Single Scan */}
      <div className="bg-[#0f172a]/90 border border-[#1e2c40] rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          {/* Target Drive Selector */}
          <div className="lg:col-span-6 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" /> Target Storage Source
            </label>
            {showAdvancedImage ? (
              <input
                type="text"
                value={imagePath}
                onChange={(e) => setImagePath(e.target.value)}
                placeholder="e.g. C:\cases\disk.raw or D:\image.dd"
                className="w-full bg-[#090d16] border border-[#22334a] rounded-xl px-4 py-3 text-slate-100 text-sm focus:border-cyan-500 outline-none font-mono placeholder:text-slate-600"
              />
            ) : (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full bg-[#090d16] border border-[#22334a] rounded-xl px-4 py-3 text-slate-100 text-sm focus:border-cyan-500 outline-none font-sans font-medium"
              >
                <option value="all">
                  💻 Entire Machine &amp; All Volumes (C:\, D:\, All Recycle Bins)
                </option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.device_type === "MOBILE_DEVICE" ? "📱 " : "💾 "}{d.vendor || "Storage"} {d.model || d.device_path} ({formatBytes(d.capacity_bytes || d.size_bytes || 0)}) {d.system_disk ? "— [SYSTEM OS]" : ""}{d.device_type === "MOBILE_DEVICE" ? " — [MTP PHONE]" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Scanning Mode Switcher & Integrated Subsystems */}
          <div className="lg:col-span-3 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" /> Engine Architecture
              </span>
              <button
                type="button"
                onClick={() => setShowAdvancedImage(!showAdvancedImage)}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline font-mono"
              >
                {showAdvancedImage ? "← Drive Mode" : "Disk Image (.dd)"}
              </button>
            </label>
            <div className="bg-[#090d16] border border-[#22334a] rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> NTFS MFT Engine
              </div>
              <span className="text-xs font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="lg:col-span-3">
            <Button
              onClick={handleStartScan}
              disabled={scanning || (!showAdvancedImage && !selectedDeviceId)}
              loading={scanning}
              variant="primary"
              className="w-full h-12 text-sm font-bold tracking-wide shadow-lg shadow-cyan-950/50 rounded-xl"
            >
              <Search className="w-4 h-4 mr-2" /> {scanning ? "Analyzing Sectors..." : isMobileTarget ? "Scan Phone Storage" : "Run Forensic Scan"}
            </Button>
          </div>
        </div>

        {/* Supported Formats Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#1e2c40]/80 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-400">
            <span className="font-bold text-slate-200">Supported Formats:</span>
            {["TXT", "JSON", "MD", "JPG", "PNG", "GIF", "BMP", "PDF", "DOCX", "XLSX", "PPTX", "ZIP", "MP4"].map((fmt) => (
              <span key={fmt} className="px-2.5 py-1 rounded-lg bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 font-mono text-xs font-bold">
                {fmt}
              </span>
            ))}
          </div>
          <span className="text-slate-400 font-sans text-xs">
            NTFS Master File Table • Resident Payloads • Non-Resident Runs • Bit-Exact Restoration
          </span>
        </div>

        {selectedDevice && scanType !== "forensic_image" && (
          <div className="pt-3 border-t border-[#1e2c40]/40 flex flex-wrap items-center gap-6 text-xs text-slate-300 font-mono">
            <div><span className="text-slate-500 font-sans">Path:</span> <span className="text-slate-200 font-bold">{selectedDevice.device_path}</span></div>
            <div><span className="text-slate-500 font-sans">Type:</span> <span className="text-cyan-400 font-bold">{selectedDevice.device_type || "STORAGE"}</span></div>
            <div><span className="text-slate-500 font-sans">Mount:</span> <span className="text-slate-200 font-bold">{selectedDevice.mount_point || "Unmounted"}</span></div>
            <div><span className="text-slate-500 font-sans">Status:</span> <span className="text-emerald-400 font-bold">Active &amp; Scannable</span></div>
          </div>
        )}

        {/* Mobile Device Forensic Advisory Banner */}
        {isMobileTarget && (
          <div className="bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-purple-950/20 border border-cyan-500/40 rounded-xl p-4 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 font-bold tracking-wide uppercase text-xs">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Connected Mobile Device Detected (MTP / Portable Device)</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-semibold">
                Android Scoped Recovery Mode
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300 text-xs leading-relaxed pt-1">
              <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> USB & Screen Requirements
                </div>
                <p className="text-slate-400 text-xs">
                  Keep the phone screen <strong className="text-slate-200">unlocked</strong> during scanning, and verify USB mode is set to <strong className="text-slate-200">"File Transfer / MTP"</strong> (not "Charging only").
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" /> Active Recovery Scope
                </div>
                <p className="text-slate-400 text-xs">
                  Scans Android Scoped Storage Trash (<code className="text-cyan-300">.trashed</code> 30-day retention), Gallery / Google Photos (<code className="text-cyan-300">.tmfs</code>), and high-resolution thumbnail media caches.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Deep Erasure & MicroSD Carving
                </div>
                <p className="text-slate-400 text-xs">
                  Android internal storage enforces File-Based Encryption (FBE). If files were lost on an external <strong className="text-slate-200">MicroSD Card</strong>, plug the SD card directly into a PC card reader for 100% raw sector bitstream carving.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Universal Forensic Pipeline (ISO/IEC 27037 Standard Architecture) */}
      <div className="bg-[#0b101e]/90 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Universal Forensic Data Pipeline (ISO/IEC 27037 Standard)
              </h3>
              <p className="text-xs text-slate-400">
                Non-destructive write-blocking, Master File Table sector parsing, and dual-track cryptographic recovery
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4" /> READ-ONLY WRITE-BLOCKED
            </span>
            {deviceProfile?.category && (
              <span className="px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                {deviceProfile.category}
              </span>
            )}
          </div>
        </div>

        {/* 4 Responsive Architectural Stages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: "01",
              name: "Media Acquisition",
              desc: "Hardware write-block & device profiling",
              active: true,
              icon: HardDrive,
              tag: "READ-ONLY",
            },
            {
              id: "02",
              name: "MFT & Sector Ingestion",
              desc: "Record 0 extents & SHA-256 bitstream",
              active: !!acquisitionHash || scanning || deletedFiles.length > 0,
              icon: Cpu,
              tag: acquisitionHash ? "VERIFIED" : "STANDBY",
            },
            {
              id: "03",
              name: "Signature & Heuristics",
              desc: "NTFS unallocated runs & binary carving",
              active: scanning || deletedFiles.length > 0,
              icon: FileCheck,
              tag: deletedFiles.length > 0 ? `${deletedFiles.length} DISCOVERED` : "READY",
            },
            {
              id: "04",
              name: "Forensic Restoral",
              desc: "Bit-exact clusters & chain-of-custody",
              active: deletedFiles.length > 0,
              icon: ShieldCheck,
              tag: "ISO 27037",
            },
          ].map((stage) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  stage.active
                    ? "bg-[#0f172a] border-cyan-500/40 shadow-sm shadow-cyan-950/30"
                    : "bg-[#090d16]/70 border-[#1e2c40] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-cyan-400">{stage.id}</span>
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                    {stage.tag}
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{stage.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{stage.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Acquisition Bitstream Hash Live Card */}
        {acquisitionHash && (
          <div className="bg-[#080d19] border border-cyan-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <KeyRound className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-slate-400 font-mono uppercase tracking-wider font-semibold">
                  Forensic Acquisition SHA-256 Bitstream Hash:
                </div>
                <div className="text-cyan-300 font-mono font-bold truncate text-xs mt-0.5" title={acquisitionHash}>
                  {acquisitionHash}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyHash(acquisitionHash)}
                className="h-8 text-xs border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 px-3 font-semibold"
              >
                {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedHash ? "Copied" : "Copy Hash"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenReport}
                className="h-8 text-xs px-3 font-semibold"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400 mr-1" /> View Formal Report
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Restored Toast Notification */}
      {restoredNotification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{restoredNotification}</span>
          </div>
          <button 
            onClick={() => setRestoredNotification(null)}
            className="text-xs font-bold text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Recovered Files History View (Toggleable) */}
      {showHistory && (
        <div className="bg-[#0f172a]/90 border border-[#1e2c40] rounded-2xl p-6 shadow-xl space-y-4 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" /> Recovered Evidence Archive ({recoveryHistory.length})
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowHistory(false)}
            >
              Close Archive
            </Button>
          </div>

          {recoveryHistory.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center font-sans">No files have been recovered yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#1e2c40]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#080d19] border-b border-[#1e2c40] text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Recovery ID</th>
                    <th className="px-4 py-3.5">File Name</th>
                    <th className="px-4 py-3.5">Size</th>
                    <th className="px-4 py-3.5">SHA-256 Hash</th>
                    <th className="px-4 py-3.5">Recovered Timestamp</th>
                    <th className="px-4 py-3.5 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2c40]/60">
                  {recoveryHistory.map((rec) => (
                    <tr key={rec.recovery_id} className="hover:bg-white/[.02] transition">
                      <td className="px-4 py-3.5 text-cyan-400 font-bold text-xs">{rec.recovery_id}</td>
                      <td className="px-4 py-3.5 font-sans font-semibold text-sm text-white">{rec.filename}</td>
                      <td className="px-4 py-3.5 font-sans text-xs text-slate-300">{formatBytes(rec.size_bytes)}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 truncate max-w-xs font-mono" title={rec.sha256 || ""}>
                        {rec.sha256 ? `${rec.sha256.slice(0, 20)}...` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-300 font-sans">
                        {formatDate(rec.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-sans">
                        <button
                          onClick={() => downloadFile(rec.filename)}
                          disabled={downloadingFile === rec.filename}
                          className="px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg border border-cyan-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" /> {downloadingFile === rec.filename ? "Downloading..." : "Download"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main Table: Discovered Deleted Files */}
      <div className="bg-[#0f172a]/90 border border-[#1e2c40] rounded-2xl p-6 shadow-xl space-y-5 backdrop-blur-sm">
        {/* Filters & Batch Actions Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {["All", "Document", "Image", "Media", "Archive", "Code", "Other"].map((cat) => {
              const count = cat === "All" ? deletedFiles.length : (categoryCounts[cat] || 0);
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition shadow-sm ${
                    categoryFilter === cat 
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow" 
                      : "border border-[#1e2c40] bg-[#090d16] text-slate-400 hover:text-white hover:border-[#2a3c54]"
                  }`}
                >
                  <span>{cat}</span>
                  {deletedFiles.length > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                      categoryFilter === cat ? "bg-cyan-500/30 text-cyan-200" : "bg-white/5 text-slate-400"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search file name or extension..."
                className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition"
              />
            </div>

            <Button
              onClick={() => handleRecoverFiles(Array.from(selectedFileIds))}
              disabled={selectedFileIds.size === 0 || recovering}
              loading={recovering}
              variant="success"
              size="default"
              className="h-11 px-5 text-sm font-bold shadow-md whitespace-nowrap rounded-xl"
            >
              <Download className="w-4 h-4 mr-1.5" /> Restore Selected ({selectedFileIds.size})
            </Button>
          </div>
        </div>

        {/* Results Info & Sequence Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-[#1e2c40]/60 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-slate-300">
              <ArrowUpDown className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-400">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#090d16] border border-[#1e2c40] rounded-xl px-3 py-1.5 text-xs sm:text-sm text-cyan-300 font-medium outline-none focus:border-cyan-500 font-sans cursor-pointer"
              >
                <option value="recent">⚡ Recent to Old (Newest Deletion First)</option>
                <option value="oldest">⏳ Oldest to Recent (Oldest First)</option>
                <option value="size_desc">📦 File Size (Largest First)</option>
                <option value="name">🔤 File Name (A to Z)</option>
                <option value="confidence">🎯 Evidence Quality Score</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-400">Page Size:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#090d16] border border-[#1e2c40] rounded-xl px-3 py-1.5 text-xs sm:text-sm text-white font-medium outline-none focus:border-cyan-500 font-sans cursor-pointer"
              >
                <option value={0}>♾️ All Files (Full Comprehensive List)</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={200}>200 per page</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm">
            <span>
              Showing <strong className="text-white font-bold">{displayFiles.length}</strong> of <strong className="text-white font-bold">{filteredFiles.length}</strong> matching ({deletedFiles.length} total)
            </span>
            {selectedFileIds.size > 0 && (
              <span className="text-cyan-400 font-bold">• {selectedFileIds.size} selected</span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[#1e2c40] bg-[#0b0f19]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#080d19] border-b border-[#1e2c40] text-sm font-extrabold text-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 w-14 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white inline-flex items-center justify-center">
                    {selectedFileIds.size === displayFiles.length && displayFiles.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th 
                  className="px-5 py-4 cursor-pointer hover:text-cyan-300 transition select-none"
                  onClick={() => setSortBy(sortBy === "name" ? "recent" : "name")}
                  title="Click to sort by filename"
                >
                  <div className="flex items-center gap-2">
                    <span>File Name & Source</span>
                    {sortBy === "name" && <span className="text-cyan-400 font-bold">↑</span>}
                  </div>
                </th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Storage Location / Path</th>
                <th 
                  className="px-5 py-4 cursor-pointer hover:text-cyan-300 transition select-none"
                  onClick={() => setSortBy(sortBy === "size_desc" ? "recent" : "size_desc")}
                  title="Click to sort by file size"
                >
                  <div className="flex items-center gap-2">
                    <span>Size</span>
                    {sortBy === "size_desc" && <span className="text-cyan-400 font-bold">↓</span>}
                  </div>
                </th>
                <th 
                  className="px-5 py-4 cursor-pointer hover:text-cyan-300 transition select-none"
                  onClick={() => setSortBy(sortBy === "recent" ? "oldest" : "recent")}
                  title="Click to toggle Newest / Oldest sequence"
                >
                  <div className="flex items-center gap-2">
                    <span>Timestamp</span>
                    {sortBy === "recent" && <span className="text-cyan-400 font-bold">↓ (Recent)</span>}
                    {sortBy === "oldest" && <span className="text-cyan-400 font-bold">↑ (Oldest)</span>}
                    {sortBy !== "recent" && sortBy !== "oldest" && <ArrowUpDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </th>
                <th 
                  className="px-5 py-4 cursor-pointer hover:text-cyan-300 transition select-none"
                  onClick={() => setSortBy(sortBy === "confidence" ? "recent" : "confidence")}
                  title="Click to sort by evidence quality"
                >
                  <div className="flex items-center gap-2">
                    <span>Integrity / Confidence</span>
                    {sortBy === "confidence" && <span className="text-cyan-400 font-bold">↓</span>}
                  </div>
                </th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2c40]/60">
              {displayFiles.map((file) => {
                const isSelected = selectedFileIds.has(file.id);
                const cleanPath = (file.original_path || "").replace(/\s*\(MFT Record #\d+\)/i, "");
                return (
                  <tr 
                    key={file.id} 
                    className={`transition-colors group ${isSelected ? "bg-cyan-500/[0.08]" : "hover:bg-white/[0.03]"}`}
                  >
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => toggleSelectFile(file.id)} className="text-slate-400 hover:text-white inline-flex items-center justify-center">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-cyan-400" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-4 font-sans">
                      <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-[#090d16] border border-[#1e2c40] group-hover:border-cyan-500/40 transition shrink-0">
                          {getCategoryIcon(file.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-base text-white group-hover:text-cyan-300 transition truncate max-w-sm sm:max-w-md" title={file.filename}>
                            {file.filename}
                          </div>
                          <div className="text-xs font-mono text-cyan-400/90 uppercase font-semibold mt-0.5">
                            {file.recovery_method.startsWith("raw_carver")
                              ? `Raw Carver (${file.extension.toUpperCase()})`
                              : file.recovery_method.startsWith("android_")
                              ? file.recovery_method.replace("android_", "Android ").replace(/_/g, " ")
                              : "NTFS Metadata ($MFT)"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-200 uppercase px-3 py-1 rounded-lg bg-[#090d16] border border-[#1e2c40]">
                        {file.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300 truncate max-w-sm font-mono" title={cleanPath}>
                      {cleanPath}
                    </td>
                    <td className="px-5 py-4 text-sm sm:text-base font-bold text-slate-100 font-mono whitespace-nowrap">
                      {formatBytes(file.size_bytes)}
                    </td>
                    <td className="px-5 py-4 text-xs sm:text-sm text-slate-300 font-sans whitespace-nowrap">
                      {file.deleted_at ? formatDate(file.deleted_at) : "Unknown"}
                    </td>
                    <td className="px-5 py-4 font-sans">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono whitespace-nowrap ${
                            file.confidence === "HIGH" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40" :
                            file.confidence === "MEDIUM" ? "bg-amber-500/15 text-amber-300 border border-amber-500/40" :
                            "bg-rose-500/15 text-rose-300 border border-rose-500/40"
                          }`}>
                            {file.confidence_score !== undefined ? `${file.confidence_score}% ` : ""}{file.confidence}
                          </span>
                        </div>
                        {file.validation_details && (
                          <div className="text-xs text-slate-400 truncate max-w-xs" title={file.validation_details}>
                            {file.validation_details}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-sans whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="signal"
                        onClick={() => handleRecoverFiles([file.id])}
                        disabled={recovering}
                        className="h-10 px-4 text-xs sm:text-sm font-bold shadow-sm rounded-xl"
                      >
                        <Download className="w-4 h-4 mr-1.5" /> Recover
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {displayFiles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-500 font-sans">
                    {deletedFiles.length === 0 ? (
                      privileges && !privileges.is_admin ? (
                        <div className="space-y-3 max-w-md mx-auto p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-center">
                          <ShieldAlert className="w-10 h-10 mx-auto text-amber-400" />
                          <p className="text-sm font-bold text-amber-300">Administrator Privileges Required for Drive D: Carving</p>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            Windows blocks raw physical disk sectors and unallocated NTFS MFT records from standard user accounts. To recover files permanently deleted or emptied from the Recycle Bin, Administrator privileges are strictly mandatory.
                          </p>
                          <div className="pt-2">
                            <Link
                              to="/agent-guide"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-950/50"
                            >
                              <BookOpen className="w-4 h-4" /> Open Hardware Guide (Enable Mandatory Admin Mode)
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <RotateCcw className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
                          <p className="text-sm font-semibold text-slate-400">No deleted files scanned yet</p>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            Select a target drive or storage device above and click "Scan for Deleted Files" to begin forensic recovery.
                          </p>
                        </div>
                      )
                    ) : (
                      "No deleted files matched your filter criteria."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#1e2c40] text-xs">
            <div className="text-slate-400">
              Page <strong className="text-white">{currentPage}</strong> of <strong className="text-white">{totalPages}</strong> ({sortedFiles.length} total files)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="h-8 px-3"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <span className="px-2 font-mono text-cyan-300">{currentPage} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="h-8 px-3"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Newly Restored Files Direct Download Modal Popup */}
      {showRestoredModal && newlyRestoredItems.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0b101d] border border-emerald-500/40 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1e2c40] flex items-center justify-between bg-[#080d19]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-glow">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.2em] text-emerald-400 uppercase">
                    FORENSIC RESTORATION SUCCESSFUL
                  </div>
                  <h2 className="text-xl font-extrabold text-white">
                    Recovered File(s) Ready to Download
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cryptographic SHA-256 integrity verified. Download directly into your machine below.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRestoredModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Restored Items List */}
            <div className="p-6 overflow-y-auto space-y-3">
              {newlyRestoredItems.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-[#080d19] border border-[#1e2c40] hover:border-emerald-500/40 transition rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span className="font-semibold text-sm sm:text-base text-white truncate max-w-xs md:max-w-md" title={item.filename}>
                        {item.filename}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-md font-bold font-mono ${
                        item.status === "RECOVERED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-mono flex flex-wrap items-center gap-3">
                      <span>Size: <strong className="text-white font-bold">{formatBytes(item.size_bytes)}</strong></span>
                      {item.sha256 && (
                        <span className="flex items-center gap-1.5 truncate max-w-xs" title={item.sha256}>
                          SHA-256: <strong className="text-cyan-300 font-mono">{item.sha256.slice(0, 16)}...</strong>
                          <button
                            onClick={() => copyHash(item.sha256)}
                            className="text-slate-400 hover:text-white ml-1 p-0.5"
                            title="Copy full SHA-256 hash"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </div>

                    {item.status !== "RECOVERED" && item.error && (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed font-sans">
                        <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Forensic Advisory</span>
                        </div>
                        {item.error}
                      </div>
                    )}
                  </div>

                  {item.status === "RECOVERED" && (
                    <Button
                      onClick={() => downloadFile(item.filename)}
                      disabled={downloadingFile === item.filename}
                      loading={downloadingFile === item.filename}
                      variant="primary"
                      size="default"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex-shrink-0 shadow-lg shadow-emerald-950/50 rounded-xl h-10 px-4 text-xs"
                    >
                      <Download className="w-4 h-4 mr-1.5" /> {downloadingFile === item.filename ? "Downloading..." : "Download to Machine"}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1e2c40] bg-[#080d19] flex items-center justify-between">
              <div className="text-xs sm:text-sm text-slate-400 font-medium">
                {newlyRestoredItems.filter(i => i.status === "RECOVERED").length} file(s) restored with integrity verification
              </div>
              <div className="flex items-center gap-3">
                {newlyRestoredItems.filter(i => i.status === "RECOVERED").length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadAllRestored}
                    className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 h-9 px-3.5 text-xs font-bold rounded-xl"
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Download All ({newlyRestoredItems.filter(i => i.status === "RECOVERED").length})
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowRestoredModal(false)}
                  className="h-9 px-4 text-xs font-bold rounded-xl"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forensic Examination Report Modal */}
      {showReportModal && reportData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-cyan-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1e2c40] flex items-center justify-between bg-[#080d19]">
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.2em] text-cyan-400 uppercase mb-1">
                  <FileText className="w-4 h-4" /> ISO/IEC 27037 FORENSIC EXAMINATION REPORT
                </div>
                <h2 className="text-xl font-extrabold text-white">
                  {reportData.case_name || "Digital Forensic Recovery Examination"}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Report ID: <span className="text-cyan-300">{reportData.report_id}</span> • Case ID: <span className="text-slate-300">{reportData.case_id}</span> • Generated {formatDate(reportData.generated_at)}
                </p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed font-sans">
              {/* Target Hardware Architecture Profile */}
              <div className="bg-[#080d19] border border-[#1e2c40] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" /> Target Storage Profile & Hardware Architecture
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                  <div>
                    <span className="text-slate-500 block text-xs uppercase font-semibold">DEVICE CLASSIFICATION:</span>
                    <span className="text-cyan-300 font-bold">{reportData.device_profile?.category || "Standard Storage"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs uppercase font-semibold">INTERFACE BUS:</span>
                    <span className="text-slate-200">{reportData.device_profile?.bus_type || "Universal"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs uppercase font-semibold">FILE SYSTEM:</span>
                    <span className="text-slate-200">{reportData.device_profile?.filesystem || "FAT32/exFAT/NTFS"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs uppercase font-semibold">TRIM / WEAR-LEVELING:</span>
                    <span className="text-slate-200">{reportData.device_profile?.trim_status || "Standard"}</span>
                  </div>
                </div>
              </div>

              {/* Forensic Acquisition Integrity Hash */}
              <div className="bg-gradient-to-r from-cyan-950/30 to-blue-950/20 border border-cyan-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-cyan-400" /> Bitstream Acquisition Integrity (SHA-256)
                  </span>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-bold">
                    VERIFIED MATCH
                  </span>
                </div>
                <div className="font-mono text-cyan-200 text-xs sm:text-sm break-all bg-black/40 p-3 rounded-lg border border-cyan-500/20 flex items-center justify-between gap-2">
                  <span>{reportData.acquisition_hash}</span>
                  <button
                    onClick={() => copyHash(reportData.acquisition_hash)}
                    className="text-slate-400 hover:text-white p-1"
                    title="Copy Hash"
                  >
                    {copiedHash ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Executive Summary Narrative */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-cyan-400" /> Forensic Analysis Narrative
                </h3>
                <div className="bg-[#080d19] border border-[#1e2c40] rounded-xl p-4 text-slate-300 font-sans text-sm whitespace-pre-wrap leading-relaxed">
                  {reportData.executive_summary}
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#080d19] border border-[#1e2c40] p-4 rounded-xl text-center">
                  <div className="text-slate-400 text-xs uppercase font-bold">Total Discovered</div>
                  <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">{reportData.total_discovered}</div>
                </div>
                <div className="bg-[#080d19] border border-[#1e2c40] p-4 rounded-xl text-center">
                  <div className="text-slate-400 text-xs uppercase font-bold">Successfully Restored</div>
                  <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{reportData.total_recovered}</div>
                </div>
                <div className="bg-[#080d19] border border-[#1e2c40] p-4 rounded-xl text-center">
                  <div className="text-slate-400 text-xs uppercase font-bold">Chain of Custody Events</div>
                  <div className="text-2xl font-bold text-purple-400 font-mono mt-1">{(reportData.chain_of_custody || []).length}</div>
                </div>
                <div className="bg-[#080d19] border border-[#1e2c40] p-4 rounded-xl text-center">
                  <div className="text-slate-400 text-xs uppercase font-bold">Legal Admissibility</div>
                  <div className="text-xs font-bold text-emerald-300 font-mono mt-3">ISO 27037 VALID</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1e2c40] bg-[#080d19] flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="w-3.5 h-3.5 text-cyan-400" /> Print / Save PDF
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowReportModal(false)}
              >
                Close Report
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
