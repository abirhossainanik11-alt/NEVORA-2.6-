import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0A1B2A", 900: "#0A1B2A", 800: "#0E2A38", 700: "#16324A" },
        teal: { DEFAULT: "#1B4A5A", 500: "#2E6E7E", 600: "#1B4A5A" },
        gold: { DEFAULT: "#C9A05C", 300: "#E8C77E", 500: "#C9A05C" }
      },
      fontFamily: {
        display: ["'Poppins'", "sans-serif"],
        body: ["'Inter'", "sans-serif"]
      },
      borderRadius: { xl2: "1.25rem" }
    }
  },
  plugins: []
};
export default config;
