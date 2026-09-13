import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#090d16",
        surface: "#0f172a",
        "surface-card": "#111c2e",
        "surface-elevated": "#162238",
        "border-subtle": "#1e2c40",
        "border-strong": "#2a3d58",
        ink: "#07101d",
        panel: "#0d192a",
        line: "#1e2c40",
        signal: "#06b6d4",
        "signal-teal": "#14b8a6",
        danger: "#f43f5e",
        card: "#0f172a",
        "card-foreground": "#f8fafc",
        popover: "#0f172a",
        "popover-foreground": "#f8fafc",
        muted: "#1e293b",
        "muted-foreground": "#94a3b8",
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2"
        }
      },
      boxShadow: {
        panel: "0 20px 50px rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px rgba(6, 182, 212, 0.15)",
        "glow-rose": "0 0 20px rgba(244, 63, 94, 0.15)",
        "glow-emerald": "0 0 20px rgba(16, 185, 129, 0.15)"
      }
    }
  },
  plugins: []
} satisfies Config;

