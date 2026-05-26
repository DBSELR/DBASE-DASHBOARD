import { useEffect, useRef, useState, useCallback } from "react";
import { hubConnection, startHub } from "../services/signalRService";
import { registerWebPush } from "../services/webPushService";
import { API_BASE } from "../config";
import { HubConnectionState } from "@microsoft/signalr";

export interface TaskNotification {
  NotificationId: number;   // Task ID used as key
  TID: string;
  SenderName: string;
  TDesc: string;
  TPriority: string;
  TDueDate: string;
  Message: string;
  CreatedDate: string;
}

// ── Fetch open received tasks from existing API ───────────────────────────────
const fetchPendingTasks = async (empCode: string): Promise<TaskNotification[]> => {
  const res = await fetch(`${API_BASE}Tickets/Load_Received_Task?RecECode=${empCode}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
    },
  });
  if (!res.ok) {
    console.warn("[Notifications] Load_Received_Task status:", res.status);
    return [];
  }
  const data = await res.json();
  const tasks: TaskNotification[] = [];
  for (const t of data as any[]) {
    const status: string = (t.Status ?? t[6] ?? "").toString();
    // Only show tasks that are NOT closed
    if (status.toLowerCase() === "closed") continue;

    tasks.push({
      NotificationId: Number(t.TID ?? t[0] ?? 0),
      TID: String(t.TID ?? t[0] ?? ""),
      SenderName: String(t.SenEName ?? t[1] ?? ""),
      TDesc: String(t.TDesc ?? t[5] ?? ""),
      TPriority: String(t.TPriority ?? t[10] ?? "Low"),
      TDueDate: String(t.TDt ?? t[4] ?? ""),
      Message: "You have a pending task assigned to you.",
      CreatedDate: String(t.ADt ?? t[3] ?? ""),
    });
  }
  return tasks;
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useTaskNotification = () => {
  const [pendingNotifications, setPendingNotifications] = useState<TaskNotification[]>([]);
  // Only track which were dismissed THIS session so we don't re-show them mid-session
  const sessionDismissed = useRef<Set<string>>(new Set());

  const getUserEmpCode = (): string | null => {
    try {
      const u = JSON.parse(localStorage.getItem("user") ?? "{}");
      return u?.empCode ? String(u.empCode) : null;
    } catch { return null; }
  };

  const loadPending = useCallback(async () => {
    const empCode = getUserEmpCode();
    if (!empCode) return;
    try {
      const tasks = await fetchPendingTasks(empCode);
      // Filter out tasks dismissed this session
      const fresh = tasks.filter((t) => !sessionDismissed.current.has(t.TID));
      setPendingNotifications(fresh);
    } catch (err) {
      console.error("[Notifications] fetchPendingTasks error:", err);
    }
  }, []);

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    console.log("[WebPush DEBUG] localStorage user:", rawUser);

    const empCode = getUserEmpCode();
    console.log("[WebPush DEBUG] empCode resolved:", empCode);

    if (!empCode) {
      console.warn("[WebPush DEBUG] empCode is null — registerWebPush will NOT run. Check your localStorage key name.");
      return;
    }

    // Show pending tasks on login
    loadPending();

    console.log("[WebPush DEBUG] Calling registerWebPush for:", empCode);
    registerWebPush(empCode);

    // Also connect SignalR for real-time new task pushes
    startHub().then(() => {
      if (hubConnection.state === HubConnectionState.Connected) {
        hubConnection.invoke("JoinUser", empCode).catch(() => { });
      }
    }).catch(() => { });

    // Listen for newly assigned tasks pushed in real-time
    const handler = (payload: any) => {
      const tid = String(payload.tID ?? payload.TID ?? Date.now());
      if (sessionDismissed.current.has(tid)) return;

      const notif: TaskNotification = {
        NotificationId: Number(payload.tID ?? payload.TID ?? Date.now()),
        TID: tid,
        SenderName: payload.senderName ?? payload.SenderName ?? "",
        TDesc: payload.tDesc ?? payload.TDesc ?? "",
        TPriority: payload.tPriority ?? payload.TPriority ?? "Low",
        TDueDate: payload.tDueDate ?? payload.TDueDate ?? "",
        Message: payload.message ?? payload.Message ?? "New task assigned",
        CreatedDate: payload.createdDate ?? payload.CreatedDate ?? new Date().toISOString(),
      };

      setPendingNotifications((prev) =>
        prev.some((n) => n.TID === tid) ? prev : [...prev, notif]
      );
    };

    hubConnection.on("ReceiveNotification", handler);
    return () => { hubConnection.off("ReceiveNotification", handler); };
  }, [loadPending]);

  // Dismiss hides for this session only — task reappears next login if still open
  const dismissNotification = useCallback((_notificationId: number, tid: string) => {
    sessionDismissed.current.add(tid);
    setPendingNotifications((prev) => prev.filter((n) => n.TID !== tid));

    // Also mark as read in the DB so the APP_Notifications table stays clean
    const empCode = getUserEmpCode();
    if (empCode && tid) {
      import("../utils/apiService").then(({ apiService }) => {
        apiService.markTaskAsRead(tid, empCode).catch(() => { });
      });
    }
  }, []);

  const dismissAll = useCallback(() => {
    const empCode = getUserEmpCode();
    setPendingNotifications((prev) => {
      prev.forEach((n) => {
        sessionDismissed.current.add(n.TID);
        if (empCode && n.TID) {
          import("../utils/apiService").then(({ apiService }) => {
            apiService.markTaskAsRead(n.TID, empCode).catch(() => { });
          });
        }
      });
      return [];
    });
  }, []);

  return { pendingNotifications, dismissNotification, dismissAll };
};
