import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://api.dbasesolutions.in",
        changeOrigin: true,
        secure: false,
        // ✅ Keeps the /api prefix in request path
      },
      "/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ""),
        // ✅ Removes the /nominatim prefix for OSM API
      },
    },
  },
});
