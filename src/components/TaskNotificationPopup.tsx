import React, { useEffect, useRef, useState } from "react";
import { useTaskNotification, TaskNotification } from "../hooks/useTaskNotification";
import "./TaskNotificationPopup.css";

const AUTO_DISMISS_MS = 8000;

const priorityColor = (p: string) => {
  const lower = (p ?? "").toLowerCase();
  if (lower === "high") return "#d63031";
  if (lower === "medium") return "#d68910";
  return "#27ae60";
};

const priorityClass = (p: string) => {
  const lower = (p ?? "").toLowerCase();
  if (lower === "high") return "high";
  if (lower === "medium") return "medium";
  return "low";
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getCleanSenderName = (raw: string) => {
  if (!raw) return "Someone";
  const parts = raw.split("-");
  return parts.length > 1 ? parts.slice(1).join("-").trim() : raw;
};

const getDesc = (n: TaskNotification) =>
  n.TDesc?.trim() || n.Message?.trim() || "A new task has been assigned to you.";

interface SingleCardProps {
  notification: TaskNotification;
  onDismiss: (notificationId: number, tid: string) => void;
}

const NotificationCard: React.FC<SingleCardProps> = ({ notification, onDismiss }) => {
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Avoid triggering card click (goToTasks)
    }
    if (dismissing) return;
    setDismissing(true);
    setTimeout(() => onDismiss(notification.NotificationId, notification.TID), 340);
  };

  const goToTasks = () => {
    dismiss();
    setTimeout(() => {
      window.location.href = "/tasks";
    }, 400); // Wait for the transition to complete
  };

  useEffect(() => {
    timerRef.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const accent = priorityColor(notification.TPriority);
  const desc = getDesc(notification);

  return (
    <div
      className={`tn-card ${dismissing ? "tn-dismissing" : ""}`}
      style={{ "--tn-accent": accent } as React.CSSProperties}
      onClick={goToTasks}
    >
      {/* Auto-dismiss progress bar */}
      <div className="tn-progress" style={{ background: accent }} />

      <div className="tn-content-row">
        {/* Left Column - App Icon */}
        <div className="tn-app-icon-wrapper">
          <img src="/images/dbase.png" alt="App Icon" className="tn-app-icon" />
        </div>

        {/* Middle Column - Notification text details */}
        <div className="tn-text-wrapper">
          <div className="tn-title-row">
            <h4 className="tn-card-title">New Task Assigned</h4>
          </div>
          <div className="tn-card-source">
            From: {getCleanSenderName(notification.SenderName)}
          </div>
          <div className="tn-card-body">
            {desc.length > 80 ? desc.substring(0, 80) + "..." : desc}
          </div>
          <div className="tn-meta-row">
            <span className={`tn-priority-badge ${priorityClass(notification.TPriority)}`}>
              {notification.TPriority || "Low"}
            </span>
            {notification.TDueDate && (
              <span className="tn-date">Due: {formatDate(notification.TDueDate)}</span>
            )}
          </div>
        </div>

        {/* Right Column - Close Button and priority dot indicator */}
        <div className="tn-right-wrapper">
          <button
            className="tn-card-close-btn"
            onClick={(e) => dismiss(e)}
            title="Dismiss"
          >
            ✕
          </button>
          <div
            className="tn-card-priority-indicator"
            style={{ background: accent }}
          />
        </div>
      </div>
    </div>
  );
};

const TaskNotificationPopup: React.FC = () => {
  const { pendingNotifications, dismissNotification } = useTaskNotification();

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };

  const todayNotifications = pendingNotifications.filter((n) =>
    isToday(n.CreatedDate)
  );

  if (todayNotifications.length === 0) return null;

  return (
    <div className="tn-wrapper">
      {todayNotifications.map((notif) => (
        <NotificationCard
          key={`${notif.NotificationId}-${notif.TID}`}
          notification={notif}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
};

export default TaskNotificationPopup;
