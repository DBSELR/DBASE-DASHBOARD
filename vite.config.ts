import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

export default defineConfig({
  plugins: [react()],
  appType: "spa",
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:25918",
        changeOrigin: false,
        secure: false,
        headers: {
          Host: "localhost:25918",
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[vite] Proxy Error:', err);
          });
        }
      },
      "/teltonikaHub": {
        target: "http://localhost:25918",
        ws: true,
        changeOrigin: false,
        headers: {
          Host: "localhost:25918",
        },
      },
      "/notificationHub": {
        target: "http://localhost:25918",
        ws: true,
        changeOrigin: false,
        headers: {
          Host: "localhost:25918",
        },
      },
      "/trackingHub": {
        target: "http://localhost:25918",
        ws: true,
        changeOrigin: false,
        headers: {
          Host: "localhost:25918",
        },
      },
      "^/(uploads|upload|MeetingFiles|Issue_File|attendance_snaps|Equipments|images|img)": {
        target: "http://localhost:25918",
        changeOrigin: false,
        secure: false,
        headers: {
          Host: "localhost:25918",
        },
        bypass: (req) => {
          const url = req.url || "";
          if (
            url.includes("dbase.png") ||
            url.includes("avatar.png") ||
            url.includes("dbs-logo-short") ||
            url.includes("wallpaper") ||
            url.includes("Emp-Profile-Pics")
          ) {
            return req.url;
          }
        },
      },
      "/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ""),
        // ✅ Removes the /nominatim prefix for OSM API
      },
      "/ai-api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ai-api/, ""),
      },
    },
  },
});


