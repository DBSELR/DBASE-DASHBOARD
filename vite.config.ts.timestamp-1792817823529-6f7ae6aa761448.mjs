// vite.config.ts
import { defineConfig } from "file:///D:/Projects/Office%20Dashboard/DBASE-DASHBOARD/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Projects/Office%20Dashboard/DBASE-DASHBOARD/node_modules/@vitejs/plugin-react/dist/index.js";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
var vite_config_default = defineConfig({
  plugins: [react()],
  appType: "spa",
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:25918",
        changeOrigin: false,
        secure: false,
        headers: {
          Host: "localhost:25918"
        },
        configure: (proxy, options) => {
          proxy.on("error", (err, req, res) => {
            console.log("[vite] Proxy Error:", err);
          });
        }
      },
      "/teltonikaHub": {
        target: "http://localhost:25918",
        ws: true,
        changeOrigin: false,
        headers: {
          Host: "localhost:25918"
        }
      },
      "/notificationHub": {
        target: "http://localhost:25918",
        ws: true,
        changeOrigin: false,
        headers: {
          Host: "localhost:25918"
        }
      },
      "/trackingHub": {
        target: "http://localhost:25918",
        ws: true,
        changeOrigin: false,
        headers: {
          Host: "localhost:25918"
        }
      },
      "^/(uploads|upload|MeetingFiles|Issue_File|attendance_snaps|Equipments|images|img)": {
        target: "http://localhost:25918",
        changeOrigin: false,
        secure: false,
        headers: {
          Host: "localhost:25918"
        },
        bypass: (req) => {
          const url = req.url || "";
          if (url.includes("dbase.png") || url.includes("avatar.png") || url.includes("dbs-logo-short") || url.includes("wallpaper") || url.includes("Emp-Profile-Pics")) {
            return req.url;
          }
        }
      },
      "/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/nominatim/, "")
        // ✅ Removes the /nominatim prefix for OSM API
      },
      "/ai-api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ai-api/, "")
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxPZmZpY2UgRGFzaGJvYXJkXFxcXERCQVNFLURBU0hCT0FSRFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcUHJvamVjdHNcXFxcT2ZmaWNlIERhc2hib2FyZFxcXFxEQkFTRS1EQVNIQk9BUkRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L1Byb2plY3RzL09mZmljZSUyMERhc2hib2FyZC9EQkFTRS1EQVNIQk9BUkQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XHJcbmltcG9ydCBkbnMgZnJvbSBcImRuc1wiO1xyXG5cclxuZG5zLnNldERlZmF1bHRSZXN1bHRPcmRlcihcImlwdjRmaXJzdFwiKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gIGFwcFR5cGU6IFwic3BhXCIsXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwcm94eToge1xyXG4gICAgICBcIi9hcGlcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjI1OTE4XCIsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiBmYWxzZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgIEhvc3Q6IFwibG9jYWxob3N0OjI1OTE4XCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgb3B0aW9ucykgPT4ge1xyXG4gICAgICAgICAgcHJveHkub24oJ2Vycm9yJywgKGVyciwgcmVxLCByZXMpID0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1t2aXRlXSBQcm94eSBFcnJvcjonLCBlcnIpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBcIi90ZWx0b25pa2FIdWJcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjI1OTE4XCIsXHJcbiAgICAgICAgd3M6IHRydWUsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiBmYWxzZSxcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICBIb3N0OiBcImxvY2FsaG9zdDoyNTkxOFwiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIFwiL25vdGlmaWNhdGlvbkh1YlwiOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6MjU5MThcIixcclxuICAgICAgICB3czogdHJ1ZSxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IGZhbHNlLFxyXG4gICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgIEhvc3Q6IFwibG9jYWxob3N0OjI1OTE4XCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgXCIvdHJhY2tpbmdIdWJcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjI1OTE4XCIsXHJcbiAgICAgICAgd3M6IHRydWUsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiBmYWxzZSxcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICBIb3N0OiBcImxvY2FsaG9zdDoyNTkxOFwiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIFwiXi8odXBsb2Fkc3x1cGxvYWR8TWVldGluZ0ZpbGVzfElzc3VlX0ZpbGV8YXR0ZW5kYW5jZV9zbmFwc3xFcXVpcG1lbnRzfGltYWdlc3xpbWcpXCI6IHtcclxuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDoyNTkxOFwiLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogZmFsc2UsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgICBIb3N0OiBcImxvY2FsaG9zdDoyNTkxOFwiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYnlwYXNzOiAocmVxKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCB1cmwgPSByZXEudXJsIHx8IFwiXCI7XHJcbiAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIHVybC5pbmNsdWRlcyhcImRiYXNlLnBuZ1wiKSB8fFxyXG4gICAgICAgICAgICB1cmwuaW5jbHVkZXMoXCJhdmF0YXIucG5nXCIpIHx8XHJcbiAgICAgICAgICAgIHVybC5pbmNsdWRlcyhcImRicy1sb2dvLXNob3J0XCIpIHx8XHJcbiAgICAgICAgICAgIHVybC5pbmNsdWRlcyhcIndhbGxwYXBlclwiKSB8fFxyXG4gICAgICAgICAgICB1cmwuaW5jbHVkZXMoXCJFbXAtUHJvZmlsZS1QaWNzXCIpXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlcS51cmw7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgXCIvbm9taW5hdGltXCI6IHtcclxuICAgICAgICB0YXJnZXQ6IFwiaHR0cHM6Ly9ub21pbmF0aW0ub3BlbnN0cmVldG1hcC5vcmdcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiB0cnVlLFxyXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9ub21pbmF0aW0vLCBcIlwiKSxcclxuICAgICAgICAvLyBcdTI3MDUgUmVtb3ZlcyB0aGUgL25vbWluYXRpbSBwcmVmaXggZm9yIE9TTSBBUElcclxuICAgICAgfSxcclxuICAgICAgXCIvYWktYXBpXCI6IHtcclxuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovLzEyNy4wLjAuMTo1MDAwXCIsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FpLWFwaS8sIFwiXCIpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG59KTtcclxuXHJcblxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWdVLFNBQVMsb0JBQW9CO0FBQzdWLE9BQU8sV0FBVztBQUNsQixPQUFPLFNBQVM7QUFFaEIsSUFBSSxzQkFBc0IsV0FBVztBQUVyQyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsU0FBUztBQUFBLFVBQ1AsTUFBTTtBQUFBLFFBQ1I7QUFBQSxRQUNBLFdBQVcsQ0FBQyxPQUFPLFlBQVk7QUFDN0IsZ0JBQU0sR0FBRyxTQUFTLENBQUMsS0FBSyxLQUFLLFFBQVE7QUFDbkMsb0JBQVEsSUFBSSx1QkFBdUIsR0FBRztBQUFBLFVBQ3hDLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUFBLE1BQ0EsaUJBQWlCO0FBQUEsUUFDZixRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsUUFDSixjQUFjO0FBQUEsUUFDZCxTQUFTO0FBQUEsVUFDUCxNQUFNO0FBQUEsUUFDUjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLG9CQUFvQjtBQUFBLFFBQ2xCLFFBQVE7QUFBQSxRQUNSLElBQUk7QUFBQSxRQUNKLGNBQWM7QUFBQSxRQUNkLFNBQVM7QUFBQSxVQUNQLE1BQU07QUFBQSxRQUNSO0FBQUEsTUFDRjtBQUFBLE1BQ0EsZ0JBQWdCO0FBQUEsUUFDZCxRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsUUFDSixjQUFjO0FBQUEsUUFDZCxTQUFTO0FBQUEsVUFDUCxNQUFNO0FBQUEsUUFDUjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLHFGQUFxRjtBQUFBLFFBQ25GLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxRQUNSLFNBQVM7QUFBQSxVQUNQLE1BQU07QUFBQSxRQUNSO0FBQUEsUUFDQSxRQUFRLENBQUMsUUFBUTtBQUNmLGdCQUFNLE1BQU0sSUFBSSxPQUFPO0FBQ3ZCLGNBQ0UsSUFBSSxTQUFTLFdBQVcsS0FDeEIsSUFBSSxTQUFTLFlBQVksS0FDekIsSUFBSSxTQUFTLGdCQUFnQixLQUM3QixJQUFJLFNBQVMsV0FBVyxLQUN4QixJQUFJLFNBQVMsa0JBQWtCLEdBQy9CO0FBQ0EsbUJBQU8sSUFBSTtBQUFBLFVBQ2I7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ1osUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLGdCQUFnQixFQUFFO0FBQUE7QUFBQSxNQUVwRDtBQUFBLE1BQ0EsV0FBVztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLGFBQWEsRUFBRTtBQUFBLE1BQ2pEO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
