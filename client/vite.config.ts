import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Phaser and React coexist — Phaser renders to a <canvas>,
  // React overlays UI on top. No special config needed.
  server: {
    port: 5173,
  },
});
