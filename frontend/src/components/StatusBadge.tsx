import { CheckCircle2, CircleAlert, Radio } from "lucide-react";

type Tone = "ready" | "warning" | "neutral" | "danger";

const styles: Record<Tone, string> = {
  ready: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  neutral: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  danger: "border-rose-400/20 bg-rose-400/10 text-rose-200"
};

export function StatusBadge({ label, tone = "neutral", pulse = false }: { label: string; tone?: Tone; pulse?: boolean }) {
  const Icon = tone === "ready" ? CheckCircle2 : tone === "warning" || tone === "danger" ? CircleAlert : Radio;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[.08em] ${styles[tone]}`}>
      <Icon className={`h-3.5 w-3.5 ${pulse ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

