import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas:            "#070b14",
        surface:           "#0b0f1a",
        "surface-card":    "#0e1526",
        "surface-elevated":"#162238",
        "border-subtle":   "#182035",
        "border-strong":   "#243250",
        ink:               "#060a12",
        panel:             "#0d192a",
        line:              "#182035",
        signal:            "#06b6d4",
        "signal-teal":     "#14b8a6",
        "signal-violet":   "#7c3aed",
        danger:            "#f43f5e",
        card:              "#0e1526",
        "card-foreground": "#f8fafc",
        popover:           "#0b0f1a",
        "popover-foreground": "#f8fafc",
        muted:             "#1e293b",
        "muted-foreground":"#94a3b8",
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
      },
      boxShadow: {
        panel:           "0 20px 60px rgba(0,0,0,0.5)",
        glow:            "0 0 20px rgba(6,182,212,0.18)",
        "glow-strong":   "0 0 35px rgba(6,182,212,0.35)",
        "glow-teal":     "0 0 20px rgba(20,184,166,0.18)",
        "glow-rose":     "0 0 20px rgba(244,63,94,0.18)",
        "glow-emerald":  "0 0 20px rgba(16,185,129,0.18)",
        "glow-violet":   "0 0 20px rgba(124,58,237,0.2)",
      },
      animation: {
        "glow-line":  "glow-line 3s ease-in-out infinite",
        "slide-down": "slide-down 0.2s ease-out forwards",
        "scale-in":   "scale-in 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "fade-up":    "fade-up 0.4s ease-out forwards",
        "float":      "float 3s ease-in-out infinite",
        "glow-pulse": "glow-pulse-cyan 2.5s ease-in-out infinite",
      },
      transitionDuration: {
        "400": "400ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
