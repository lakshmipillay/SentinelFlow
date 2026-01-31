import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SentinelFlow Mission Control color tokens
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Panel backgrounds
        panel: {
          DEFAULT: "var(--panel)",
          secondary: "var(--panel-secondary)",
        },
        // Status colors for workflow states
        status: {
          idle: "var(--status-idle)",
          analyzing: "var(--status-analyzing)",
          pending: "var(--status-pending)",
          success: "var(--status-success)",
          error: "var(--status-error)",
          warning: "var(--status-warning)",
        },
        // Agent colors
        agent: {
          sre: "var(--agent-sre)",
          security: "var(--agent-security)",
          governance: "var(--agent-governance)",
        },
        // Governance decision colors
        governance: {
          approve: "var(--governance-approve)",
          restrict: "var(--governance-restrict)",
          block: "var(--governance-block)",
        },
        // Border and accent colors
        border: "var(--border)",
        accent: "var(--accent)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "thinking": "thinking 1.5s ease-in-out infinite",
      },
      keyframes: {
        thinking: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
