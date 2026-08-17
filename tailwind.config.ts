import type { Config } from "tailwindcss";

// NEVORA design tokens (§8-9).
// Dark: deep navy/midnight base, teal for structure & focus, restrained gold
// for a single warm accent (used sparingly — citations, selected states).
// Light: soft white/cool blue-gray base, same teal, same gold.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        nevora: {
          // dark mode surfaces
          midnight: "#0A0F1E",
          navy: "#101A2E",
          "navy-raised": "#16223B",
          // light mode surfaces
          paper: "#F7F9FC",
          "paper-raised": "#FFFFFF",
          mist: "#E7ECF5",
          // shared accents
          teal: "#1FB8A6",
          "teal-soft": "#1FB8A61A",
          gold: "#C9A24B",
          "gold-soft": "#C9A24B22",
          ink: "#0E1524",
          "ink-soft": "#4A5568",
          cloud: "#EDF1F8",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "ui-serif", "Georgia", "serif"],
        body: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        nevora: "0 8px 30px -12px rgba(16, 26, 46, 0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
