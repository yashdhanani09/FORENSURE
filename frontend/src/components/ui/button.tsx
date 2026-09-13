import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "default" | "primary" | "destructive" | "forensic" | "success" | "outline" | "secondary" | "ghost" | "link" | "signal";
  size?: "default" | "sm" | "lg" | "icon";
  loading?: boolean;
};

/** High-polish cybersecurity button system */
export function Button({ 
  className, 
  asChild = false, 
  variant = "outline", 
  size = "default", 
  loading = false,
  disabled,
  children,
  ...props 
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  const variants: Record<string, string> = {
    default: "bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-[0.98]",
    primary: "bg-cyan-500 hover:bg-cyan-400 text-black font-semibold shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-[0.98]",
    destructive: "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold shadow-[0_0_20px_rgba(244,63,94,0.25)] active:scale-[0.98]",
    forensic: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-[0_0_20px_rgba(59,130,246,0.25)] active:scale-[0.98]",
    success: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.25)] active:scale-[0.98]",
    outline: "border border-border-subtle bg-[#0f172a]/80 backdrop-blur text-slate-200 hover:border-signal/50 hover:bg-[#162238] hover:text-white active:scale-[0.98]",
    secondary: "border border-border-subtle bg-[#111c2e] text-slate-200 hover:bg-[#162238] hover:text-white active:scale-[0.98]",
    ghost: "text-slate-400 hover:text-white hover:bg-white/[0.06] active:scale-[0.98]",
    link: "text-cyan-400 underline-offset-4 hover:underline",
    signal: "border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-[0.98]"
  };
  const sizes: Record<string, string> = {
    default: "h-9 px-4 py-2 text-xs",
    sm: "h-8 rounded-lg px-3 text-[11px]",
    lg: "h-11 rounded-xl px-6 text-sm",
    icon: "h-9 w-9 p-0",
  };

  return (
    <Component 
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100", 
        variants[variant], 
        sizes[size], 
        className
      )} 
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </Component>
  );
}

