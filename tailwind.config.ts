import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050816",
        panel: "#0d1324",
        border: "#1b2640",
        text: "#f5f7fb",
        muted: "#8f9bb7",
        success: "#15803d",
        buy: "#16a34a",
        wait: "#8a5a2f",
        hold: "#2563eb",
        sell: "#dc2626",
        strongSell: "#7f1d1d",
      },
      boxShadow: {
        glow: "0 20px 60px rgba(15, 23, 42, 0.45)",
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};

export default config;