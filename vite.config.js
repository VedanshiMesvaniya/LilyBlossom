import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Plain Vite + React setup (JavaScript, no TypeScript, no Next.js).
// One dev server for the whole frontend; see crawler/worker.py for
// the small Python backend this talks to for admin-only actions.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
