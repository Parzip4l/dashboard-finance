import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/finance-data": {
        target: process.env.VITE_ERP_API_TARGET || "http://127.0.0.1:5100",
        changeOrigin: true,
      },
      "/api/finance-data-department": {
        target: process.env.VITE_ERP_API_TARGET || "http://127.0.0.1:5100",
        changeOrigin: true,
      },
      "/api/procurement-data": {
        target: process.env.VITE_ERP_API_TARGET || "http://127.0.0.1:5100",
        changeOrigin: true,
      },
      "/api/procurement/summary": {
        target: process.env.VITE_ERP_API_TARGET || "http://127.0.0.1:5100",
        changeOrigin: true,
      },
      "/api/procurement/on-process": {
        target: process.env.VITE_ERP_API_TARGET || "http://127.0.0.1:5100",
        changeOrigin: true,
      },
      "/api/erp": {
        target: process.env.VITE_ERP_API_TARGET || "http://127.0.0.1:5100",
        changeOrigin: true,
      },
      "/api": {
        target: process.env.VITE_LEGACY_API_TARGET || "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
