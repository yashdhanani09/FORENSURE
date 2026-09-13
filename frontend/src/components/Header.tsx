import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";

export function Header({ title, subtitle, refreshing, onRefresh }: {
  title: string;
  subtitle: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[#1e2c40] bg-[#0b0f19]/90 px-6 py-5 backdrop-blur-md md:flex-row md:items-center md:justify-between lg:px-10 select-none">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-cyan-400 uppercase">
          <ShieldCheck className="h-3.5 w-3.5" /> SECUREDATA CONSOLE
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge label="ENGINE LIVE" tone="ready" pulse />
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing}>
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        )}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e2c40] bg-[#0f172a] text-[11px] font-mono text-slate-400">
          <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>PROBE: ACTIVE</span>
        </div>
      </div>
    </header>
  );
}
