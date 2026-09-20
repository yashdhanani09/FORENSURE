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
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchCase = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await forensicApi.getCase(id);
      setData(res);
      if (res.case.status === "ANALYZED" || res.case.status === "COMPLETED") {
        try {
          const filesRes = await forensicApi.listFiles(id);
          setFiles(filesRes || []);
        } catch (fileErr) {
          console.warn("Failed to load artifacts list:", fileErr);
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load forensic case records.");
    } finally {
      setLoading(false);
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

  if (loading && !data) {
    return (
      <div className="p-12 max-w-6xl mx-auto flex flex-col justify-center items-center h-96 select-none">
        <div className="h-10 w-10 border-2 border-brand border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-text-secondary font-mono">Loading forensic case records...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-12 max-w-2xl mx-auto flex flex-col justify-center items-center min-h-[400px] select-none text-center">
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger mb-4">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Unable to Load Forensic Case</h2>
        <p className="text-sm text-text-secondary mb-6 font-mono max-w-md">{error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/forensics")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Forensics Hub
          </Button>
          <Button variant="primary" onClick={fetchCase}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { case: c, evidence, events } = data;
  const ev = evidence[0];

  const filteredFiles = files.filter(f => 
    !fileSearch.trim() || f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  return (
    <div className="w-full max-w-[1850px] mx-auto px-6 sm:px-10 lg:px-14 xl:px-16 py-8 space-y-8 select-none page-enter">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#182035] pb-6">
        <div>
          <button
            onClick={() => navigate("/forensics")}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Forensics Hub
          </button>
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 shrink-0">
              <FileSearch className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl lg:text-3xl font-black font-mono text-white">{c.case_id}</h1>
                <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {c.status}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">{c.case_name} • Initiated {formatDate(c.created_at)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="default" className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl" onClick={fetchCase}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh Case
          </Button>
          {c.status === "COMPLETED" && (
            <Button variant="primary" size="default" className="h-10 px-4 text-xs sm:text-sm font-semibold rounded-xl" onClick={handleGenerateReport} loading={loadingReport}>
              <Download className="h-4 w-4 mr-1.5" /> Generate PDF Report
            </Button>
          )}
        </div>
      </div>

      {/* Active Job Card */}
      {job && (
        <div className="rounded-2xl border border-blue-500/40 bg-gradient-to-r from-blue-950/30 to-[#0f172a] p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 animate-spin">
                <RefreshCw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Active Operation: {job.type}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-mono mt-0.5">
                  Phase: <strong className="text-blue-300">{job.stage}</strong>
                </p>
              </div>
            </div>
            <span className="text-base font-mono font-bold text-cyan-400">
              {job.progress_percent.toFixed(1)}%
            </span>
          </div>

          <div className="h-3 bg-[#090d16] rounded-full overflow-hidden border border-[#1e2c40]">
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
            <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
              <HardDrive className="h-5 w-5 text-cyan-400" /> Evidence Target Source
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-sm font-mono">
            <div className="space-y-3 divide-y divide-[#1e2c40]/60">
              <div className="flex justify-between items-center gap-2 pb-2">
                <span className="shrink-0 text-slate-400">Hardware Model:</span>
                <span className="text-white font-sans font-bold text-base truncate text-right" title={`${ev?.vendor} ${ev?.model}`}>{ev?.vendor} {ev?.model}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-2">
                <span className="shrink-0 text-slate-400">Serial Number:</span>
                <span className="text-slate-200 truncate text-right font-mono text-sm" title={ev?.serial_number || "Not reported"}>{ev?.serial_number || "Not reported"}</span>
              </div>
              <div className="flex justify-between items-center gap-2 py-2">
                <span className="shrink-0 text-slate-400">Physical Size:</span>
                <span className="text-cyan-400 font-bold font-sans truncate text-right text-base">{formatBytes(ev?.size_bytes || 0)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 pt-2">
                <span className="shrink-0 text-slate-400">Device ID:</span>
                <span className="text-slate-300 truncate text-right font-mono text-xs sm:text-sm" title={ev?.device_id || c.device_id || "N/A"}>{ev?.device_id || c.device_id || "N/A"}</span>
              </div>
            </div>

            {c.status === "CREATED" && (
              <div className="pt-3">
                <Button 
                  onClick={() => setAcquireModalOpen(true)} 
                  className="w-full h-11 text-xs sm:text-sm font-bold rounded-xl" 
                  variant="forensic"
                >
                  <Play className="h-4 w-4 mr-1.5" /> Acquire Bitstream Image (RAW/DD)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cryptographic Integrity Card */}
        <Card>
          <CardHeader className="border-b border-[#1e2c40]/70 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
              <Shield className="h-5 w-5 text-emerald-400" /> Image Integrity & Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-sm font-mono">
            {ev?.image_path ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-slate-400 uppercase text-xs tracking-wider block font-semibold">Acquired Image Path:</span>
                  <p className="text-slate-200 break-all bg-[#090d16] p-3 rounded-xl border border-[#1e2c40] text-xs sm:text-sm">
                    {ev.image_path}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-slate-400 uppercase text-xs tracking-wider block font-semibold">SHA-256 Bitstream Hash:</span>
                  <p className="text-emerald-400 font-bold break-all bg-[#090d16] p-3 rounded-xl border border-emerald-500/30 text-xs sm:text-sm">
                    {ev.image_hash}
                  </p>
                </div>
                {c.status === "ACQUIRED" && (
                  <div className="pt-2">
                    <Button onClick={handleAnalyze} className="w-full h-11 text-xs sm:text-sm font-bold rounded-xl" variant="primary">
                      <FileSearch className="h-4 w-4 mr-1.5" /> Start Filesystem Analysis & Carving
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 space-y-2.5">
                <Database className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-slate-300 font-sans text-sm font-semibold">Image Not Yet Acquired</p>
                <p className="text-slate-500 text-xs font-sans">
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
              <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
                <FileSearch className="h-5 w-5 text-cyan-400" /> Carved & Recovered Artifacts ({files.length})
              </CardTitle>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Filter artifacts..."
                  className="w-full bg-[#090d16] border border-[#1e2c40] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 font-sans"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[440px]">
              <table className="w-full text-left text-sm font-mono">
                <thead className="border-b border-[#1e2c40] bg-[#0b0f19] text-slate-300 uppercase tracking-wider text-xs font-extrabold sticky top-0">
                  <tr>
                    <th className="px-6 py-4.5">Artifact Name</th>
                    <th className="px-6 py-4.5">Type</th>
                    <th className="px-6 py-4.5">Size</th>
                    <th className="px-6 py-4.5">Allocation State</th>
                    <th className="px-6 py-4.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2c40]/60">
                  {filteredFiles.map((f, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4.5 text-slate-200 font-bold truncate max-w-xs font-sans text-sm" title={f.name}>
                        {f.name}
                      </td>
                      <td className="px-6 py-4.5 uppercase text-slate-400 text-xs font-bold">{f.is_dir ? "Directory" : "File"}</td>
                      <td className="px-6 py-4.5 text-slate-200 font-sans font-semibold text-sm">{formatBytes(f.size || 0)}</td>
                      <td className="px-6 py-4.5">
                        {f.is_deleted ? (
                          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            DELETED
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ALLOCATED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4.5 text-right">
                        {!f.is_dir && f.is_deleted && (
                          <Button 
                            size="sm" 
                            variant="signal" 
                            className="h-9 px-4 text-xs sm:text-sm font-semibold rounded-xl"
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
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-sans text-sm">
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
          <CardTitle className="text-base font-bold flex items-center gap-2.5 text-white">
            <CheckCircle2 className="h-5 w-5 text-cyan-400" /> Tamper-Evident Chain of Custody
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-5">
            {events.map((e, i) => (
              <div key={i} className="relative pl-7 pb-5 border-l-2 border-cyan-500/30 last:pb-0">
                <span className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.9)] border-2 border-[#0f172a]" />
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white uppercase tracking-wider">{e.event_type}</span>
                  <span className="text-xs font-mono text-slate-400">{new Date(e.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed font-sans">{e.description}</p>
                {e.hash_value && (
                  <p className="font-mono text-xs sm:text-sm text-cyan-400 mt-2 bg-[#090d16] p-2.5 rounded-xl border border-[#1e2c40] break-all">
                    <Hash className="h-3.5 w-3.5 inline mr-1 text-slate-500" />
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
