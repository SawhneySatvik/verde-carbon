import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/**/*.{ts,tsx}",
    "./packages/core/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          sunken: "var(--surface-sunken)",
          hover: "var(--surface-hover)",
          raised: "var(--surface-raised)",
          "brand-subtle": "var(--surface-brand-subtle)",
        },
        text: {
          DEFAULT: "var(--text)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          disabled: "var(--text-disabled)",
          onbrand: "var(--text-on-brand)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          interactive: "var(--border-interactive)",
        },
        ring: "var(--ring)",
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          active: "var(--brand-active)",
          accent: "var(--brand-accent)",
          fg: "var(--brand-fg)",
        },
        success: {
          DEFAULT: "var(--success)",
          bg: "var(--success-bg)",
          fg: "var(--success-fg)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
          fg: "var(--warning-fg)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          bg: "var(--danger-bg)",
          fg: "var(--danger-fg)",
        },
        info: {
          DEFAULT: "var(--info)",
          bg: "var(--info-bg)",
          fg: "var(--info-fg)",
        },
        viz: {
          1: "var(--viz-1)",
          2: "var(--viz-2)",
          3: "var(--viz-3)",
          4: "var(--viz-4)",
          5: "var(--viz-5)",
          6: "var(--viz-6)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        display: ["var(--font-display)"],
      },
      fontSize: {
        display: [
          "clamp(2.75rem,6vw,4.5rem)",
          {
            lineHeight: "1.04",
            letterSpacing: "-0.02em",
            fontWeight: "700",
          },
        ],
        // h1/h2 fluidly shrink on phones (mirrors the display clamp): the min
        // keeps long words from overflowing a 320px viewport, the max preserves
        // the desktop scale. Tracking floor stays ≥ -0.04em (a11y skill).
        h1: [
          "clamp(1.75rem, 1.35rem + 2vw, 2.25rem)",
          { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "600" },
        ],
        h2: [
          "clamp(1.4rem, 1.15rem + 1.25vw, 1.75rem)",
          { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
        h3: ["1.375rem", { lineHeight: "1.25", fontWeight: "600" }],
        h4: ["1.125rem", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.55" }],
        caption: ["0.8125rem", { lineHeight: "1.45", letterSpacing: "0.01em" }],
        overline: [
          "0.6875rem",
          { lineHeight: "1.4", letterSpacing: "0.08em", fontWeight: "600" },
        ],
      },
      spacing: { "18": "4.5rem", "22": "5.5rem" },
      maxWidth: { prose: "68ch", app: "1200px", wide: "1360px" },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        "bezel-inner": "18px",
        pill: "9999px",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        float: "var(--shadow-float)",
        "bezel-inner": "var(--shadow-bezel-inner)",
      },
      zIndex: {
        dropdown: "1000",
        sticky: "1100",
        backdrop: "1200",
        modal: "1300",
        toast: "1400",
        tooltip: "1500",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.25,1,0.5,1)",
        "out-expo": "cubic-bezier(0.16,1,0.3,1)",
        "out-soft": "cubic-bezier(0.32,0.72,0,1)",
        standard: "cubic-bezier(0.4,0,0.2,1)",
      },
      transitionDuration: {
        instant: "80ms",
        fast: "160ms",
        base: "240ms",
        slow: "320ms",
        slower: "480ms",
      },
      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Chart line "draw-in": the path's stroke-dashoffset (set to its length
        // via a CSS var) resolves to 0 (DESIGN §6 "chart stroke-dashoffset draw").
        "draw-in": {
          from: { strokeDashoffset: "var(--draw-length, 1000)" },
          to: { strokeDashoffset: "0" },
        },
        // Category bar "draw-in": scaleX from the bar's left edge (transform-only,
        // transformBox/origin set inline on the rect).
        "draw-bar": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "rise-in": "rise-in 240ms cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 240ms cubic-bezier(0.25,1,0.5,1) both",
        "draw-in": "draw-in 720ms cubic-bezier(0.32,0.72,0,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
