import { Capacitor } from "@capacitor/core";

export const API_BASE = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_API_BASE ?? "https://api.dbasesolutions.in/api/")
  : import.meta.env.DEV
  ? "/api/"
  : (import.meta.env.VITE_API_BASE ?? "https://api.dbasesolutions.in/api/");