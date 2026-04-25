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
        // `brand` is the semantic alias used by primary buttons, install
        // prompts, push prompts, etc. It maps to the active theme's
        // accent color so it swaps with light/dark/themed modes.
        brand: {
          DEFAULT: "rgb(var(--wa-green) / <alpha-value>)",
          dark: "rgb(var(--wa-green-dark) / <alpha-value>)",
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
        bar: "0 1px 0 rgba(11,20,26,0.06)",
        sheet: "0 8px 32px rgba(11,20,26,0.20)",
        // ─── Premium elevation scale ───
        // Soft layered shadows that mimic light passing over a real
        // material — subtle ambient + tighter directional. Tuned to
        // feel calm in light mode and not muddy in dark mode.
        card:
          "0 1px 2px rgba(11,20,26,0.06), 0 1px 1px rgba(11,20,26,0.04)",
        "card-hover":
          "0 4px 14px rgba(11,20,26,0.08), 0 2px 4px rgba(11,20,26,0.05)",
        raised:
          "0 6px 20px rgba(11,20,26,0.12), 0 2px 6px rgba(11,20,26,0.06)",
        popover:
          "0 12px 40px rgba(11,20,26,0.18), 0 4px 10px rgba(11,20,26,0.08)",
        // Inset highlight used to give pills/buttons a "glassy" top edge.
        "inset-top": "inset 0 1px 0 rgba(255,255,255,0.10)",
        // Soft accent glow used on the primary button + FAB on hover.
        "glow-accent":
          "0 8px 24px rgba(0,168,132,0.28), 0 2px 6px rgba(0,168,132,0.18)",
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
        // Premium page-level entrances. Slightly slower and more
        // restrained than the bubble springs — they should set tone,
        // not draw attention.
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Soft, ambient "breathing" loop. Used on hero icons in
        // empty states so the screen doesn't feel completely static
        // — at ~4s per cycle it sits below conscious notice but
        // adds a quiet sense of life to the surface.
        "breathe": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.04)", opacity: "0.92" },
        },
      },
      animation: {
        "bubble-in-out": "bubble-in-out 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "bubble-in-in": "bubble-in-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "tap-pulse": "tap-pulse 180ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "soft-pop": "soft-pop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "fade-in": "fade-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-up": "slide-up 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-down": "slide-down 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "breathe": "breathe 4200ms cubic-bezier(0.45, 0, 0.55, 1) infinite",
      },
    },
  },
  plugins: [],
};
