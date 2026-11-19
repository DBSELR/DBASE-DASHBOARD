import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Bell, Check, ExternalLink, X, Megaphone, AlertTriangle } from "lucide-react";
import { hubConnection, startHub } from "../services/signalRService";
import { apiService } from "../utils/apiService";
import "./BroadcastNotificationModal.css";

interface BroadcastNotificationItem {
  NotificationId: number;
  BroadcastId: number;
  EmpCode: string;
  Title: string;
  Body: string;
  Category: string;
  Priority: string;
  SenderName: string;
  ActionUrl: string;
  IsRead: boolean;
  CreatedDate: string;
}

const getLoggedInEmpCode = (): string | null => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    const code = u?.empCode || u?.EmpCode || u?.Empcode || u?.emp_code || "";
    return code ? String(code).trim() : null;
  } catch {
    return null;
  }
};

const normalizeItem = (raw: any): BroadcastNotificationItem => ({
  NotificationId: Number(raw?.NotificationId ?? raw?.notificationId ?? 0),
  BroadcastId: Number(raw?.BroadcastId ?? raw?.broadcastId ?? raw?.notificationId ?? 0),
  EmpCode: String(raw?.EmpCode ?? raw?.empCode ?? "").trim(),
  Title: String(raw?.Title ?? raw?.title ?? raw?.Message ?? raw?.message ?? "Announcement").trim(),
  Body: String(raw?.Body ?? raw?.body ?? raw?.TDesc ?? raw?.tDesc ?? "").trim(),
  Category: String(raw?.Category ?? raw?.category ?? "Announcement").trim(),
  Priority: String(raw?.Priority ?? raw?.priority ?? raw?.TPriority ?? raw?.tPriority ?? "Normal").trim(),
  SenderName: String(raw?.SenderName ?? raw?.senderName ?? "Administrator").trim(),
  ActionUrl: String(raw?.ActionUrl ?? raw?.actionUrl ?? raw?.url ?? "/").trim(),
  IsRead: Boolean(raw?.IsRead ?? raw?.isRead ?? false),
  CreatedDate: String(raw?.CreatedDate ?? raw?.createdDate ?? "").trim(),
});

const isBroadcastPayload = (payload: any): boolean => {
  if (!payload) return false;
  if (
    payload.type === "penalty" ||
    payload.type === "slip_transfer_request" ||
    payload.type === "work_report_reminder" ||
    payload.type === "attendance_discrepancy" ||
    payload.type === "payment_reminder" ||
    payload.tID === "WORK_REPORT_REMINDER"
  ) {
    return false;
  }
  if (payload.type === "general_broadcast" || payload.type === "broadcast") {
    return true;
  }
  const hasNumericTid = payload.tID != null && !isNaN(Number(payload.tID)) && Number(payload.tID) > 0;
  return !hasNumericTid && Boolean(payload.broadcastId || payload.actionUrl);
};

export const BroadcastNotificationModal: React.FC = () => {
  const [notifications, setNotifications] = useState<BroadcastNotificationItem[]>([]);
  const history = useHistory();

  const fetchUnreadBroadcasts = useCallback(async () => {
    const empCode = getLoggedInEmpCode();
    if (!empCode) return;

    try {
      const res = await apiService.getMyBroadcastNotifications(empCode);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const normalized = list.map(normalizeItem).filter((n: BroadcastNotificationItem) => !n.IsRead);
      setNotifications(normalized);
    } catch (err) {
      console.warn("[BroadcastNotification] Failed to fetch unread broadcasts:", err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadBroadcasts();

    // Poll periodically as fallback in case SignalR was disconnected while backgrounded
    const intervalId = setInterval(fetchUnreadBroadcasts, 60000);

    const handleBroadcastEvent = () => {
      fetchUnreadBroadcasts();
    };
    window.addEventListener("app:broadcast-received", handleBroadcastEvent);
    window.addEventListener("focus", handleBroadcastEvent);

    const handleSignalR = (payload: any) => {
      if (!isBroadcastPayload(payload)) return;

      const myEmpCode = getLoggedInEmpCode();
      const targetEmpCode = payload?.empCode ?? payload?.EmpCode;
      if (targetEmpCode && myEmpCode && String(targetEmpCode).trim() !== myEmpCode) {
        return;
      }

      const item = normalizeItem(payload);
      setNotifications((prev) => {
        const exists = prev.some(
          (n) =>
            (item.BroadcastId > 0 && n.BroadcastId === item.BroadcastId) ||
            (item.NotificationId > 0 && n.NotificationId === item.NotificationId)
        );
        if (exists) return prev;
        return [item, ...prev];
      });

      // Refresh from DB shortly after so exact per-user NotificationId is synced
      setTimeout(fetchUnreadBroadcasts, 600);
    };

    startHub()
      .then(() => {
        const empCode = getLoggedInEmpCode();
        if (empCode && hubConnection.state === "Connected") {
          hubConnection.invoke("JoinUser", empCode).catch(() => {});
        }
      })
      .catch(() => {});

    hubConnection.on("ReceiveNotification", handleSignalR);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("app:broadcast-received", handleBroadcastEvent);
      window.removeEventListener("focus", handleBroadcastEvent);
      hubConnection.off("ReceiveNotification", handleSignalR);
    };
  }, [fetchUnreadBroadcasts]);

  const markRead = async (item: BroadcastNotificationItem) => {
    const empCode = getLoggedInEmpCode() || item.EmpCode;
    setNotifications((prev) =>
      prev.filter(
        (n) =>
          !(
            (item.NotificationId > 0 && n.NotificationId === item.NotificationId) ||
            (item.BroadcastId > 0 && n.BroadcastId === item.BroadcastId)
          )
      )
    );

    if (!empCode) return;
    try {
      await apiService.markBroadcastNotificationAsRead({
        NotificationId: item.NotificationId > 0 && item.NotificationId !== item.BroadcastId ? item.NotificationId : 0,
        BroadcastId: item.BroadcastId,
        EmpCode: empCode,
      });
    } catch (err) {
      console.warn("[BroadcastNotification] MarkAsRead failed:", err);
    }
  };

  const handleOpen = async (item: BroadcastNotificationItem) => {
    await markRead(item);
    if (item.ActionUrl && item.ActionUrl !== "/") {
      history.push(item.ActionUrl);
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="bn-wrapper" role="region" aria-label="Broadcast Notifications">
      {notifications.slice(0, 3).map((item) => {
        const priorityLower = item.Priority.toLowerCase();
        const isUrgent = priorityLower === "urgent";
        const isHigh = priorityLower === "high";
        const priorityClass = isUrgent ? "urgent" : isHigh ? "high" : "normal";

        return (
          <div key={`${item.NotificationId}-${item.BroadcastId}`} className={`bn-card bn-${priorityClass}`}>
            <div className="bn-header">
              <div className="bn-badge-group">
                <span className={`bn-icon-pill bn-${priorityClass}`}>
                  {isUrgent ? <AlertTriangle size={14} /> : <Megaphone size={14} />}
                </span>
                <span className="bn-category">{item.Category || "Announcement"}</span>
                <span className={`bn-priority bn-${priorityClass}`}>{item.Priority || "Normal"}</span>
              </div>
              <button
                type="button"
                className="bn-close-btn"
                onClick={() => markRead(item)}
                title="Mark as Read"
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bn-content">
              <h4 className="bn-title">{item.Title}</h4>
              {item.Body && <p className="bn-body">{item.Body}</p>}
              <div className="bn-meta">
                <span>
                  <Bell size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  By {item.SenderName}
                </span>
                {item.CreatedDate && <span>{item.CreatedDate}</span>}
              </div>
            </div>

            <div className="bn-actions">
              <button type="button" className="bn-btn-read" onClick={() => markRead(item)}>
                <Check size={14} />
                <span>Mark as Read</span>
              </button>
              {item.ActionUrl && item.ActionUrl !== "/" && (
                <button type="button" className="bn-btn-open" onClick={() => handleOpen(item)}>
                  <span>Open</span>
                  <ExternalLink size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
      {notifications.length > 3 && (
        <div className="bn-more-pill">+{notifications.length - 3} more unread announcements</div>
      )}
    </div>
  );
};

export default BroadcastNotificationModal;
