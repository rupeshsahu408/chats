/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        // WhatsApp-style tokens, all driven by CSS variables so the theme
        // toggle (light/dark/system) can swap them at runtime.
        bg: "rgb(var(--wa-bg) / <alpha-value>)",
        panel: "rgb(var(--wa-panel) / <alpha-value>)",
        surface: "rgb(var(--wa-surface) / <alpha-value>)",
        elevated: "rgb(var(--wa-elevated) / <alpha-value>)",
        bar: "rgb(var(--wa-bar) / <alpha-value>)",
        line: "rgb(var(--wa-line) / <alpha-value>)",
        text: {
          DEFAULT: "rgb(var(--wa-text) / <alpha-value>)",
          muted: "rgb(var(--wa-text-muted) / <alpha-value>)",
          faint: "rgb(var(--wa-text-faint) / <alpha-value>)",
          oncolor: "rgb(var(--wa-text-oncolor) / <alpha-value>)",
        },
        wa: {
          green: "rgb(var(--wa-green) / <alpha-value>)",
          "green-dark": "rgb(var(--wa-green-dark) / <alpha-value>)",
          "green-soft": "rgb(var(--wa-green-soft) / <alpha-value>)",
          teal: "rgb(var(--wa-teal) / <alpha-value>)",
          "bubble-out": "rgb(var(--wa-bubble-out) / <alpha-value>)",
          "bubble-in": "rgb(var(--wa-bubble-in) / <alpha-value>)",
          tick: "rgb(var(--wa-tick) / <alpha-value>)",
        },
        // Back-compat aliases so legacy classnames still resolve while we
        // migrate. Map them to the new tokens.
        accent: {
          DEFAULT: "rgb(var(--wa-green) / <alpha-value>)",
          soft: "rgb(var(--wa-green-soft) / <alpha-value>)",
        },
        midnight: {
          DEFAULT: "rgb(var(--wa-bg) / <alpha-value>)",
          deep: "rgb(var(--wa-bg) / <alpha-value>)",
          soft: "rgb(var(--wa-panel) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "Helvetica Neue",
          "Helvetica",
          "system-ui",
          "-apple-system",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        bubble: "0 1px 0.5px rgba(11,20,26,0.13)",
        bar: "0 1px 0 rgba(11,20,26,0.08)",
        sheet: "0 8px 32px rgba(11,20,26,0.20)",
      },
      backgroundImage: {
        // Subtle WhatsApp-like chat wallpaper (faint pattern over bg).
        "chat-wallpaper":
          "radial-gradient(rgb(var(--wa-wallpaper-dot) / 0.35) 1px, transparent 1px)",
      },
      backgroundSize: {
        wallpaper: "18px 18px",
      },
      // ─────────── Motion design tokens ───────────
      // Spring-y curves so taps and bubbles feel physical, not linear.
      transitionTimingFunction: {
        "veil-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)", // overshoot
        "veil-soft": "cubic-bezier(0.22, 1, 0.36, 1)",      // ease-out-quint
        "veil-snap": "cubic-bezier(0.16, 1, 0.3, 1)",       // ease-out-expo
      },
      transitionDuration: {
        80: "80ms",
        180: "180ms",
        260: "260ms",
        420: "420ms",
      },
      keyframes: {
        "bubble-in-out": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.94)" },
          "60%": { opacity: "1", transform: "translateY(-1px) scale(1.01)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "bubble-in-in": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "tap-pulse": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.93)" },
          "100%": { transform: "scale(1)" },
        },
        "soft-pop": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "70%": { opacity: "1", transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "bubble-in-out": "bubble-in-out 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "bubble-in-in": "bubble-in-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "tap-pulse": "tap-pulse 180ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "soft-pop": "soft-pop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [],
};
