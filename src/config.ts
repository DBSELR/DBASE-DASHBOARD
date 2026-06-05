export const API_BASE = import.meta.env.DEV
  ? "https://api.dbasesolutions.in/api/"
  : (import.meta.env.VITE_API_BASE ?? "https://api.dbasesolutions.in/api/");

  // "http://localhost:25918/api/"