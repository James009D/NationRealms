import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  envDir: "../..",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_API_URL ?? "http://127.0.0.1:4000",
      "/health": process.env.VITE_API_URL ?? "http://127.0.0.1:4000",
      "/socket.io": {
        target: process.env.VITE_API_URL ?? "http://127.0.0.1:4000",
        ws: true
      }
    }
  }
});
