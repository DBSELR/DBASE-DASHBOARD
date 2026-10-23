import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { AlertTriangle, Clock, ArrowRight, X, ShieldAlert } from "lucide-react";
import { hubConnection } from "../services/signalRService";
import "./WorkReportReminderModal.css";

export const WorkReportReminderModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [activeSlot, setActiveSlot] = useState<string>("18_29");
  const [slotTitle, setSlotTitle] = useState<string>("6:29 PM Daily Reminder");
  const [slotDescription, setSlotDescription] = useState<string>(
    "It's 6:29 PM! Work reports are now open. Please review your activities and submit your daily work report."
  );
  const history = useHistory();
  const location = useLocation();

  const checkIfAlreadySubmittedToday = (): boolean => {
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      return localStorage.getItem(`work_report_submitted_${todayKey}`) === "true";
    } catch {
      return false;
    }
  };

  const checkIfDismissedForSlot = (slot: string): boolean => {
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const dismissed = localStorage.getItem("work_report_dismissed_time");
      return dismissed === `${todayKey}_${slot}`;
    } catch {
      return false;
    }
  };

  const markDismissed = (slot: string) => {
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      localStorage.setItem("work_report_dismissed_time", `${todayKey}_${slot}`);
    } catch (err) {
      console.error("Error setting dismissed slot", err);
    }
  };

  const getCurrentReminderSlot = (now: Date): { slot: string; isUrgent: boolean; title: string; desc: string } | null => {
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // After 8:30 PM (20:30)
    if (hours > 20 || (hours === 20 && minutes >= 30)) {
      return {
        slot: "20_30",
        isUrgent: true,
        title: "8:30 PM Final Reminder",
        desc: "It's past 8:30 PM! Final call to submit your daily work report before day close."
      };
    }
    // After 7:30 PM (19:30)
    if (hours > 19 || (hours === 19 && minutes >= 30)) {
      return {
        slot: "19_30",
        isUrgent: true,
        title: "7:30 PM Reminder",
        desc: "It's past 7:30 PM! You have not submitted today's work report yet. Please submit now."
      };
    }
    // After 6:29 PM (18:29)
    if (hours > 18 || (hours === 18 && minutes >= 29)) {
      return {
        slot: "18_29",
        isUrgent: false,
        title: "6:29 PM Daily Reminder",
        desc: "It's 6:29 PM! Submissions are now open. Please review today's activities and submit your work report."
      };
    }
    return null;
  };

  const evaluateAutoReminder = () => {
    const userJson = localStorage.getItem("user");
    if (!userJson) return;
    try {
      const user = JSON.parse(userJson);
      const empCode = String(user?.empCode || user?.EmpCode || "");
      if (["1501", "2001"].includes(empCode)) return;
    } catch {
      // ignore JSON parse error
    }

    const now = new Date();
    // Exclude Sunday (0)
    if (now.getDay() === 0) return;

    const info = getCurrentReminderSlot(now);
    if (!info) return;

    if (checkIfAlreadySubmittedToday()) return;

    if (!checkIfDismissedForSlot(info.slot)) {
      setActiveSlot(info.slot);
      setIsUrgent(info.isUrgent);
      setSlotTitle(info.title);
      setSlotDescription(info.desc);
      setIsOpen(true);
    }
  };

  useEffect(() => {
    evaluateAutoReminder();

    const interval = setInterval(evaluateAutoReminder, 15000);

    const handleTestAlert = (e: CustomEvent<{ isUrgent?: boolean; slot?: string }>) => {
      setIsUrgent(!!e.detail?.isUrgent);
      const slot = e.detail?.slot || (e.detail?.isUrgent ? "20_30" : "18_29");
      setActiveSlot(slot);
      if (slot === "20_30") {
        setSlotTitle("8:30 PM Final Reminder");
        setSlotDescription("It's past 8:30 PM! Final call to submit your daily work report before day close.");
      } else if (slot === "19_30") {
        setSlotTitle("7:30 PM Reminder");
        setSlotDescription("It's past 7:30 PM! You have not submitted today's work report yet. Please submit now.");
      } else {
        setSlotTitle("6:29 PM Daily Reminder");
        setSlotDescription("It's 6:29 PM! Submissions are now open. Please review today's activities and submit your work report.");
      }
      setIsOpen(true);
    };

    const handleSubmitted = () => {
      setIsOpen(false);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "work_report_dismissed_time" || e.key?.startsWith("work_report_submitted_")) {
        const now = new Date();
        const info = getCurrentReminderSlot(now);
        if (checkIfAlreadySubmittedToday() || (info && checkIfDismissedForSlot(info.slot))) {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("test-work-report-alert" as any, handleTestAlert);
    window.addEventListener("work-report-submitted", handleSubmitted);
    window.addEventListener("storage", handleStorageChange);

    const handleNotification = (data: any) => {
      if (
        data?.tID === "WORK_REPORT_REMINDER" ||
        data?.type === "work_report_reminder"
      ) {
        const now = new Date();
        const info = getCurrentReminderSlot(now);
        const slot = data?.slot || info?.slot || "18_29";

        if (!checkIfAlreadySubmittedToday() && !checkIfDismissedForSlot(slot)) {
          setActiveSlot(slot);
          const urgent = slot === "20_30" || slot === "19_30" || data?.message?.includes("8:30") || data?.message?.includes("7:30");
          setIsUrgent(urgent);
          setSlotTitle(urgent ? (slot === "20_30" ? "8:30 PM Final Reminder" : "7:30 PM Reminder") : "6:29 PM Daily Reminder");
          setSlotDescription(data?.message || (info ? info.desc : "Please submit your daily work report."));
          setIsOpen(true);
        }
      }
    };

    try {
      hubConnection.on("ReceiveNotification", handleNotification);
    } catch (e) {
      console.warn("[WorkReportReminderModal] SignalR subscription error", e);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener("test-work-report-alert" as any, handleTestAlert);
      window.removeEventListener("work-report-submitted", handleSubmitted);
      window.removeEventListener("storage", handleStorageChange);
      try {
        hubConnection.off("ReceiveNotification", handleNotification);
      } catch (e) {}
    };
  }, []);

  const handleDismiss = () => {
    const now = new Date();
    const info = getCurrentReminderSlot(now);
    const slot = activeSlot || info?.slot || "18_29";
    markDismissed(slot);
    setIsOpen(false);
  };

  const handleSubmitClick = () => {
    setIsOpen(false);
    if (location.pathname !== "/workreport") {
      history.push("/workreport");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wrr-modal-overlay" onClick={handleDismiss}>
      <div
        className={`wrr-modal-card ${isUrgent ? "wrr-pulse-red" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="wrr-modal-header">
          <div className="wrr-header-title-box">
            <ShieldAlert size={24} className="wrr-header-icon" />
            <h3>
              {isUrgent
                ? `🚨 ${slotTitle.toUpperCase()}`
                : "📝 DAILY WORK REPORT REMINDER"}
            </h3>
          </div>
          <button
            className="wrr-close-btn"
            onClick={handleDismiss}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="wrr-modal-body">
          <div className="wrr-time-badge">
            <Clock size={14} />
            <span>{slotTitle}</span>
          </div>

          <p className="wrr-modal-text">
            {slotDescription}
          </p>

          <div className="wrr-warning-box">
            <AlertTriangle size={18} className="wrr-warning-icon" />
            <div>
              <strong>Daily Policy:</strong> Work report submission must be done 6:29 PM onwards with all pending tasks updated.
            </div>
          </div>

          {/* Actions */}
          <div className="wrr-actions">
            <button className="wrr-btn-submit" onClick={handleSubmitClick}>
              <span>Fill & Submit Work Report</span>
              <ArrowRight size={18} />
            </button>
            <button className="wrr-btn-dismiss" onClick={handleDismiss}>
              Remind Me Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkReportReminderModal;
