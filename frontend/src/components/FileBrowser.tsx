import { useEffect, useMemo, useState } from "react";
import { 
  ChevronRight, File, FileText, Folder, FolderOpen, 
  Search, SlidersHorizontal, TriangleAlert, Eye, X, Fingerprint, ShieldAlert 
} from "lucide-react";
import { deviceApi } from "../services/api";
import type { FileEntry } from "../types/device";
import { formatBytes, formatDate } from "../utils/format";
import { Button } from "./ui/button";

type FilterKind = "all" | "file" | "directory";
type SortBy = "name" | "size" | "modified" | "type";

function FileIcon({ kind }: { kind: FileEntry["kind"] }) {
  if (kind === "directory") return <Folder className="h-4 w-4 text-amber-400" />;
  if (kind === "symlink") return <FileText className="h-4 w-4 text-violet-400" />;
  return <File className="h-4 w-4 text-slate-400" />;
}

export function FileBrowser({ 
  deviceId, 
  onEvidenceCreated, 
  onSanitizeFile 
}: { 
  deviceId: string; 
  onEvidenceCreated?: () => void; 
  onSanitizeFile?: (file: FileEntry) => void;
}) {
  const [path, setPath] = useState("");
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [kind, setKind] = useState<FilterKind>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [parent, setParent] = useState<string | null>(null);
  const [message, setMessage] = useState("Loading folder metadata…");
  const [status, setStatus] = useState<"completed" | "unavailable" | "not_found">("completed");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [previewContent, setPreviewContent] = useState<{ content: string; type: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  
  const [hashValue, setHashValue] = useState<string | null>(null);
  const [hashLoading, setHashLoading] = useState(false);
  const [hashError, setHashError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setActiveSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void deviceApi.files(deviceId, { path, search: activeSearch, kind, sort_by: sortBy, sort_order: sortOrder })
      .then((response) => {
        if (!live) return;
        setEntries(response.entries);
        setTotal(response.total);
        setParent(response.parent_path);
        setMessage(response.message);
        setStatus(response.status);
        setError(null);
        setSelected(null);
      })
      .catch((requestError: Error) => live && setError(requestError.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [deviceId, path, activeSearch, kind, sortBy, sortOrder]);

  const crumbs = useMemo(() => (path ? path.split("/") : []), [path]);
  
  const navigate = (nextPath: string) => {
    setPath(nextPath);
    setSearch("");
    setActiveSearch("");
  };

  const selectOrOpen = (entry: FileEntry) => {
    setSelected(entry);
    setHashValue(null);
    setHashError(null);
    if (entry.kind === "directory") navigate(entry.path);
  };
  
  const handleHash = async () => {
    if (!selected || selected.kind !== "file") return;
    setHashLoading(true);
    setHashError(null);
    try {
      const result = await deviceApi.hashFile(deviceId, selected.path);
      setHashValue(result.sha256);
      if (onEvidenceCreated) onEvidenceCreated();
    } catch (err) {
      setHashError(err instanceof Error ? err.message : "Failed to calculate hash");
    } finally {
      setHashLoading(false);
    }
  };
  
  const handlePreview = async () => {
    if (!selected || selected.kind !== "file") return;
    setPreviewVisible(true);
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await deviceApi.previewFile(deviceId, selected.path);
      setPreviewContent(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-card shadow-xl overflow-hidden">
      {/* Header Bar */}
      <div className="border-b border-border-subtle p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-[10px] font-bold tracking-[.14em] text-signal uppercase">READ-ONLY FILE BROWSER</p>
            <h3 className="mt-1 text-sm font-semibold text-white">Mounted Filesystem Contents</h3>
          </div>
          <p className="max-w-xl text-xs leading-5 text-slate-400">
            Paths are safely evaluated read-only under the active mount. Files are not opened or modified.
          </p>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => navigate("")}
            className="rounded px-2 py-1 font-semibold text-signal hover:text-white bg-signal/10 transition"
          >
            ROOT
          </button>
          {crumbs.map((crumb, index) => {
            const next = crumbs.slice(0, index + 1).join("/");
            return (
              <span key={next} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-slate-600" />
                <button
                  onClick={() => navigate(next)}
                  className="rounded px-1.5 py-0.5 text-slate-300 hover:text-signal transition"
                >
                  {crumb}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col gap-3 border-b border-border-subtle p-4 lg:flex-row bg-surface/50">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this folder..."
            className="w-full rounded-lg border border-border-subtle bg-surface py-2 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-signal/50 focus:ring-1 focus:ring-signal/30 transition"
          />
        </label>
        <div className="flex gap-2">
          <select
            aria-label="File type filter"
            value={kind}
            onChange={(event) => setKind(event.target.value as FilterKind)}
            className="rounded-lg border border-border-subtle bg-surface px-3 text-xs text-slate-300 outline-none focus:border-signal/50"
          >
            <option value="all">All types</option>
            <option value="file">Files</option>
            <option value="directory">Folders</option>
          </select>
          <select
            aria-label="Sort files by"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            className="rounded-lg border border-border-subtle bg-surface px-3 text-xs text-slate-300 outline-none focus:border-signal/50"
          >
            <option value="name">Name</option>
            <option value="modified">Modified</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>
          <button
            aria-label="Toggle sort order"
            onClick={() => setSortOrder((value) => (value === "asc" ? "desc" : "asc"))}
            className="rounded-lg border border-border-subtle bg-surface px-3 text-slate-300 hover:text-signal transition"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="m-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Main Grid: File List + Metadata Sidebar */}
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3 bg-surface/30">
            <span className="text-xs text-slate-400">
              {loading ? "Reading folder…" : `${total} item${total === 1 ? "" : "s"}`}
            </span>
            {parent !== null && (
              <button
                onClick={() => navigate(parent)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal hover:text-white transition"
              >
                <FolderOpen className="h-3.5 w-3.5" /> Up one level
              </button>
            )}
          </div>

          {loading ? (
            <div className="h-64 animate-pulse bg-surface/40 flex items-center justify-center text-xs text-slate-500">
              Scanning filesystem...
            </div>
          ) : status !== "completed" ? (
            <div className="px-5 py-12 text-center">
              <TriangleAlert className="mx-auto h-6 w-6 text-amber-400" />
              <p className="mt-3 text-sm text-slate-300">{message}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No matching files or folders found in this directory.
            </div>
          ) : (
            <div className="divide-y divide-border-subtle/50">
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => selectOrOpen(entry)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_100px_150px] items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[.04] ${
                    selected?.path === entry.path ? "bg-signal/[.08] border-l-2 border-signal" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <FileIcon kind={entry.kind} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-200">{entry.name}</span>
                      <span className="block text-[10px] uppercase tracking-[.1em] text-slate-500">
                        {entry.kind}{entry.extension ? ` · ${entry.extension}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="text-right text-xs text-slate-400 font-mono">
                    {entry.kind === "file" ? formatBytes(entry.size_bytes) : "—"}
                  </span>
                  <span className="hidden text-right text-xs text-slate-500 sm:block">
                    {formatDate(entry.modified_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Metadata Inspector */}
        <aside className="border-t border-border-subtle bg-surface p-5 xl:border-l xl:border-t-0">
          <p className="text-[10px] font-bold tracking-[.14em] text-slate-500 uppercase">INSPECTOR & ACTIONS</p>
          {selected ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <FileIcon kind={selected.kind} />
                <p className="break-all text-sm font-medium text-slate-100">{selected.name}</p>
              </div>

              <dl className="space-y-2.5 text-xs">
                <div>
                  <dt className="text-slate-500 text-[10px] uppercase font-semibold">PATH</dt>
                  <dd className="mt-0.5 break-all font-mono text-slate-300">/{selected.path}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-[10px] uppercase font-semibold">TYPE</dt>
                  <dd className="mt-0.5 uppercase text-slate-300">{selected.kind}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-[10px] uppercase font-semibold">SIZE</dt>
                  <dd className="mt-0.5 font-mono text-slate-300">{formatBytes(selected.size_bytes)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-[10px] uppercase font-semibold">MODIFIED</dt>
                  <dd className="mt-0.5 text-slate-300">{formatDate(selected.modified_at)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-[10px] uppercase font-semibold">CREATED</dt>
                  <dd className="mt-0.5 text-slate-300">{formatDate(selected.created_at)}</dd>
                </div>
              </dl>

              {selected.kind === "file" && (
                <div className="space-y-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    onClick={handlePreview}
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview (4KB)
                  </Button>

                  <div className="border-t border-border-subtle pt-3">
                    {hashValue ? (
                      <div className="bg-canvas p-3 rounded-lg border border-border-subtle">
                        <p className="text-[10px] font-bold tracking-[.14em] text-signal uppercase">SHA-256 HASH</p>
                        <p className="mt-1 break-all font-mono text-[10px] text-slate-200">{hashValue}</p>
                        <p className="mt-1.5 text-[10px] text-emerald-400">Verified and logged to evidence.</p>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full justify-center"
                        onClick={handleHash}
                        disabled={hashLoading}
                        loading={hashLoading}
                      >
                        <Fingerprint className="h-3.5 w-3.5" /> Calculate SHA-256
                      </Button>
                    )}
                    {hashError && <p className="mt-2 text-[10px] text-rose-400">{hashError}</p>}
                  </div>

                  {onSanitizeFile && (
                    <div className="border-t border-border-subtle pt-3">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full justify-center"
                        onClick={() => onSanitizeFile(selected)}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" /> Securely Sanitize File
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Select a file to inspect metadata, calculate forensic hashes, preview safe contents, or initiate secure erasure.
            </p>
          )}
        </aside>
      </div>

      {/* Preview Modal */}
      {previewVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border-subtle bg-surface-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-subtle p-4 bg-surface">
              <div className="flex items-center gap-3">
                <FileIcon kind="file" />
                <span className="font-semibold text-white text-sm">{selected?.name}</span>
              </div>
              <button
                onClick={() => setPreviewVisible(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-canvas font-mono text-xs text-slate-300">
              {previewLoading ? (
                <div className="flex h-64 items-center justify-center text-slate-400 animate-pulse font-sans">
                  Reading file safely...
                </div>
              ) : previewError ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 font-sans">
                  {previewError}
                </div>
              ) : previewContent ? (
                <pre className="whitespace-pre-wrap break-all leading-relaxed">
                  {previewContent.content}
                </pre>
              ) : null}
            </div>
            <div className="border-t border-border-subtle p-3 flex items-center justify-between text-xs text-slate-500 bg-surface">
              <span>Displaying first 4KB of file content safely • Type: {previewContent?.type ?? "unknown"}</span>
              <Button variant="secondary" size="sm" onClick={() => setPreviewVisible(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
