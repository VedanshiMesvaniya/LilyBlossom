import type { Config } from "tailwindcss";

// Design tokens follow the GL Tracker brand spec.
// Light mode is the default theme; dark mode is class-based ("dark").
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFF8F8",
        surface: "#FFFFFF",
        "cream-surface": "#FFFDF5",
        primary: {
          DEFAULT: "#FF99B0",
          hover: "#FF7D9A"
        },
        secondary: "#E9D5FF",
        text: {
          primary: "#2F3E34",
          muted: "#64748B"
        },
        border: "rgba(255,153,176,0.15)",
        "progress-bg": "#FEE2E2",
        dark: {
          background: "#140E12",
          surface: "#20161C",
          primary: "#FFAEC1",
          text: "#FAFAFA"
        }
      },
      fontFamily: {
        display: ["var(--font-playfair)", "serif"],
        ui: ["var(--font-quicksand)", "sans-serif"]
      },
      borderRadius: {
        card: "1rem"
      }
    }
  },
  plugins: []
};

export default config;
