import * as signalR from "@microsoft/signalr";

// Derive hub URL from the same base as the REST API
const getHubUrl = (): string => {
  const isDev = import.meta.env.DEV;
  const base = isDev
    ? "http://localhost:25918"
    : (import.meta.env.VITE_API_BASE
        ? import.meta.env.VITE_API_BASE.replace(/\/api\/?$/, "")
        : "https://api.dbasesolutions.in");
  return `${base}/notificationHub`;
};

// Single shared connection (module-level singleton)
export const hubConnection = new signalR.HubConnectionBuilder()
  .withUrl(getHubUrl())
  .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
  .configureLogging(signalR.LogLevel.Warning)
  .build();

let startPromise: Promise<void> | null = null;

/**
 * Call this once when the user logs in.
 * Idempotent — safe to call multiple times.
 */
export const startHub = (): Promise<void> => {
  if (hubConnection.state === signalR.HubConnectionState.Connected) {
    return Promise.resolve();
  }
  if (!startPromise) {
    startPromise = hubConnection.start().catch((err) => {
      console.warn("[SignalR] Connection failed:", err);
      startPromise = null;
    });
  }
  return startPromise!;
};

/**
 * Stop the hub — call this on logout.
 */
export const stopHub = (): Promise<void> => {
  startPromise = null;
  return hubConnection.stop();
};
