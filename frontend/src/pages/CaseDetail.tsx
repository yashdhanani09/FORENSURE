import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { forensicApi, ForensicCaseDetail, ForensicJobProgress, FileEntry } from "../services/forensicApi";
import { formatBytes, formatDate } from "../utils/format";
import { 
  Shield, HardDrive, Search, Download, CheckCircle2, 
  FileSearch, Hash, ArrowLeft, RefreshCw, AlertTriangle, 
  Clock, Play, Database, FileText
} from "lucide-react";

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ForensicCaseDetail | null>(null);
  const [job, setJob] = useState<ForensicJobProgress | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [fileSearch, setFileSearch] = useState("");
  const [acquireModalOpen, setAcquireModalOpen] = useState(false);
  const [acquiring, setAcquiring] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const navigate = useNavigate();

  const fetchCase = async () => {
    if (!id) return;
    try {
      const res = await forensicApi.getCase(id);
      setData(res);
      if (res.case.status === "ANALYZED" || res.case.status === "COMPLETED") {
        const filesRes = await forensicApi.listFiles(id);
        setFiles(filesRes || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCase();
  }, [id]);

  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      try {
        const j = await forensicApi.getJobStatus(activeJobId);
        setJob(j);
        if (j.status === "COMPLETED" || j.status === "FAILED") {
          setActiveJobId(null);
          fetchCase();
        }
      } catch (e) {
        console.error(e);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeJobId]);

  const handleAcquireConfirm = async () => {
    if (!id) return;
    setAcquiring(true);
    try {
      const res = await forensicApi.acquire(id);
      setActiveJobId(res.job_id);
      setAcquireModalOpen(false);
    } catch (e: any) {
      alert(e.message || "Failed to start bitstream image acquisition.");
    } finally {
      setAcquiring(false);
    }
  };

  const handleAnalyze = async () => {
    if (!id) return;
    try {
      const res = await forensicApi.analyze(id);
      setActiveJobId(res.job_id);
    } catch (e: any) {
      alert(e.message || "Failed to start filesystem analysis.");
    }
  };

  const handleRecover = async (path: string) => {
    if (!id) return;
    try {
      const res = await forensicApi.recover(id, [path], "metadata");
      setActiveJobId(res.job_id);
    } catch (e: any) {
      alert(e.message || "Recovery process failed.");
    }
  };

  const handleGenerateReport = async () => {
    if (!data) return;
    setLoadingReport(true);
    try {
      const rep = await forensicApi.generateReport(data.case.case_id);
      alert(`Forensic PDF report generated.\nSHA-256 Hash: ${rep.pdf_hash}`);
    } catch (e: any) {
      alert(e.message || "Failed to generate report.");
    } finally {
      setLoadingReport(false);
    }
  };

  if (!data) {
    return (
      <div className="p-12 max-w-6xl mx-auto flex flex-col justify-center items-center h-96 select-none">
        <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-mono">Loading forensic case records...</p>
      </div>
    );
  }

  const { case: c, evidence, events } = data;
  const ev = evidence[0];

  const filteredFiles = files.filter(f => 
    !fileSearch.trim() || f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2c40] pb-6">
        <div>
          <button
            onClick={() => navigate("/forensics")}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Forensics Hub
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
              <FileSearch className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold font-mono text-white">{c.case_id}</h1>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {c.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{c.case_name} • Initiated {formatDate(c.created_at)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchCase}>
            <RefreshCw className="h-3 w-3" /> Refresh Case
          </Button>
          {c.status === "COMPLETED" && (
            <Button variant="primary" size="sm" onClick={handleGenerateReport} loading={loadingReport}>
              <Download className="h-3.5 w-3.5" /> Generate PDF Report
            </Button>
          )}
        </div>
      </div>

      {/* Active Job Card */}
      {job && (
        <div className="rounded-2xl border border-blue-500/40 bg-gradient-to-r from-blue-950/30 to-[#0f172a] p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 animate-spin">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Active Operation: {job.type}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Phase: <strong className="text-blue-300">{job.stage}</strong>
                </p>
              </div>
            </div>
            <span className="text-sm font-mono font-bold text-cyan-400">
              {job.progress_percent.toFixed(1)}%
            </span>
          </div>

          <div className="h-2.5 bg-[#090d16] rounded-full overflow-hidden border border-[#1e2c40]">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${job.progress_percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Evidence & Integrity Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Evidence Card */}
        <Card>
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <HardDrive className="h-4 w-4 text-cyan-400" /> Evidence Target Source
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs font-mono">
            <div className="space-y-2 divide-y divide-[#1e2c40]/60">
              <div className="flex justify-between items-center gap-2 pb-2">
                <span className="shrink-0 text-slate-500">Hardware Model:</span>
                <span className="text-white font-sans font-bold truncate text-right" title={`${ev?.vendor} ${ev?.model}`}>{ev?.vendor} {ev?.model}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-2">
                <span className="shrink-0 text-slate-500">Serial Number:</span>
                <span className="text-slate-200 truncate text-right font-mono" title={ev?.serial_number || "Not reported"}>{ev?.serial_number || "Not reported"}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-2">
                <span className="shrink-0 text-slate-500">Physical Size:</span>
                <span className="text-cyan-400 font-bold font-sans truncate text-right">{formatBytes(ev?.size_bytes || 0)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-2">
                <span className="shrink-0 text-slate-500">Device ID:</span>
                <span className="text-slate-300 truncate text-right font-mono" title={ev?.device_id || c.device_id || "N/A"}>{ev?.device_id || c.device_id || "N/A"}</span>
              </div>
            </div>

            {c.status === "CREATED" && (
              <div className="pt-3">
                <Button 
                  onClick={() => setAcquireModalOpen(true)} 
                  className="w-full" 
                  variant="forensic"
                >
                  <Play className="h-3.5 w-3.5" /> Acquire Bitstream Image (RAW/DD)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cryptographic Integrity Card */}
        <Card>
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <Shield className="h-4 w-4 text-emerald-400" /> Image Integrity & Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs font-mono">
            {ev?.image_path ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px] tracking-wider block">Acquired Image Path:</span>
                  <p className="text-slate-200 break-all bg-[#090d16] p-2.5 rounded-xl border border-[#1e2c40]">
                    {ev.image_path}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px] tracking-wider block">SHA-256 Bitstream Hash:</span>
                  <p className="text-emerald-400 font-bold break-all bg-[#090d16] p-2.5 rounded-xl border border-emerald-500/30">
                    {ev.image_hash}
                  </p>
                </div>
                {c.status === "ACQUIRED" && (
                  <div className="pt-2">
                    <Button onClick={handleAnalyze} className="w-full" variant="primary">
                      <FileSearch className="h-3.5 w-3.5" /> Start Filesystem Analysis & Carving
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <Database className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-slate-400 font-sans text-xs font-semibold">Image Not Yet Acquired</p>
                <p className="text-slate-500 text-[11px] font-sans">
                  Acquire bitstream image from the source drive to calculate verification hashes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evidence File Browser */}
      {(c.status === "ANALYZED" || c.status === "COMPLETED") && (
        <Card>
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <FileSearch className="h-4 w-4 text-cyan-400" /> Carved & Recovered Artifacts ({files.length})
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Filter artifacts..."
                  className="w-full bg-[#090d16] border border-[#1e2c40] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 font-sans"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-[#1e2c40] bg-[#0b0f19] text-slate-400 uppercase tracking-wider text-[10px] sticky top-0">
                  <tr>
                    <th className="p-4">Artifact Name</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Allocation State</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2c40]/60">
                  {filteredFiles.map((f, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition">
                      <td className="p-4 text-slate-200 font-bold truncate max-w-xs" title={f.name}>
                        {f.name}
                      </td>
                      <td className="p-4 uppercase text-slate-400">{f.is_dir ? "Directory" : "File"}</td>
                      <td className="p-4 text-slate-300 font-sans">{formatBytes(f.size || 0)}</td>
                      <td className="p-4">
                        {f.is_deleted ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            DELETED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ALLOCATED
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!f.is_dir && f.is_deleted && (
                          <Button 
                            size="sm" 
                            variant="signal" 
                            onClick={() => handleRecover(f.path)}
                          >
                            Recover File
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredFiles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">
                        No artifacts matching search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chain of Custody Timeline */}
      <Card>
        <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
            <CheckCircle2 className="h-4 w-4 text-cyan-400" /> Tamper-Evident Chain of Custody
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {events.map((e, i) => (
              <div key={i} className="relative pl-6 pb-4 border-l border-cyan-500/30 last:pb-0">
                <span className="absolute -left-1.5 top-0.5 h-3 w-3 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{e.event_type}</span>
                  <span className="text-[11px] font-mono text-slate-500">{new Date(e.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">{e.description}</p>
                {e.hash_value && (
                  <p className="font-mono text-[11px] text-cyan-400 mt-1.5 bg-[#090d16] p-2 rounded-lg border border-[#1e2c40] break-all">
                    <Hash className="h-3 w-3 inline mr-1 text-slate-500" />
                    SHA-256: {e.hash_value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* In-Page Modal for Bitstream Acquisition Confirmation */}
      {acquireModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-blue-500/40 bg-[#0f172a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Start Bitstream Acquisition</h3>
                <p className="text-xs text-blue-300">Read-only physical disk image creation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              The acquisition process creates a 1:1 bitstream forensic image of target device <strong className="text-white font-mono">{ev?.model || ev?.device_id || c.device_id || c.case_name}</strong>. The target device will not be modified or written to.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => setAcquireModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="forensic" 
                className="flex-1"
                loading={acquiring}
                onClick={handleAcquireConfirm}
              >
                Begin Acquisition
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
