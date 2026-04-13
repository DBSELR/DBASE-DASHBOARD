export const API_BASE = import.meta.env.DEV
  ? "http://localhost:25918/api/"
  : (import.meta.env.VITE_API_BASE ?? "https://api.dbasesolutions.in/api/");
