/** @type {import('tailwindcss').Config} */
// Design tokens follow the LilyBlossom brand spec.
// Light mode is the default theme; dark mode is class-based ("dark").
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
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
        display: ["Playfair Display", "serif"],
        ui: ["Quicksand", "sans-serif"]
      },
      borderRadius: {
        card: "1rem"
      }
    }
  },
  plugins: []
};
