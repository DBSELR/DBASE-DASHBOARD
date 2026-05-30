import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
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

// Derive display description: prefer TDesc, fall back to Message
const getDesc = (n: TaskNotification) =>
  n.TDesc?.trim() || n.Message?.trim() || "A new task has been assigned to you.";

interface SingleCardProps {
  notification: TaskNotification;
  onDismiss: (notificationId: number, tid: string) => void;
}

const NotificationCard: React.FC<SingleCardProps> = ({ notification, onDismiss }) => {
  const history = useHistory();
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (dismissing) return;
    setDismissing(true);
    setTimeout(() => onDismiss(notification.NotificationId, notification.TID), 340);
  };

  const goToTasks = () => {
    dismiss();
    setTimeout(() => {
      window.location.href = "/tasks";
    }, 450); // Wait for the animation and API call to complete
  };

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const accent = priorityColor(notification.TPriority);
  const desc = getDesc(notification);

  return (
    <div
      className={`tn-card ${dismissing ? "tn-dismissing" : ""}`}
      style={{ "--tn-accent": accent } as React.CSSProperties}
    >
      {/* Auto-dismiss progress bar */}
      <div className="tn-progress" style={{ background: accent }} />

      {/* Header */}
      <div className="tn-header">
        <div className="tn-header-left">
          <div className="tn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div>
            <div className="tn-title">📋 New Task Assigned!</div>
            <div className="tn-subtitle">
              From: {getCleanSenderName(notification.SenderName)}
            </div>
          </div>
        </div>
        <button className="tn-close-btn" onClick={dismiss} title="Dismiss">✕</button>
      </div>

      {/* Body */}
      <div className="tn-body">
        <div className="tn-desc">
          {desc.length > 100 ? desc.substring(0, 100) + "..." : desc}
        </div>
        <div className="tn-meta">
          <span className={`tn-priority ${priorityClass(notification.TPriority)}`}>
            {notification.TPriority || "Normal"}
          </span>
          {notification.TDueDate && (
            <span className="tn-date">📅 Due: {formatDate(notification.TDueDate)}</span>
          )}
          {notification.CreatedDate && (
            <span className="tn-date">🕐 {formatDate(notification.CreatedDate)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="tn-actions">
        <button className="tn-btn-view" onClick={goToTasks}>View Task</button>
        <button className="tn-btn-dismiss" onClick={dismiss}>Dismiss</button>
      </div>
    </div>
  );
};

const TaskNotificationPopup: React.FC = () => {
  const { pendingNotifications, dismissNotification } = useTaskNotification();

  if (pendingNotifications.length === 0) return null;

  return (
    <div className="tn-wrapper">
      {pendingNotifications.map((notif) => (
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
