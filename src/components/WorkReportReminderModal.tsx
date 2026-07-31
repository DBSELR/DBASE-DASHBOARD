import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { AlertTriangle, Clock, ArrowRight, X, ShieldAlert } from "lucide-react";
import { hubConnection } from "../services/signalRService";
import "./WorkReportReminderModal.css";

export const WorkReportReminderModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
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

    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Past 6:00 PM (18:00)
    if (hours > 18 || (hours === 18 && minutes >= 0)) {
      if (checkIfAlreadySubmittedToday()) return;

      const urgentSlot = hours > 18 || (hours === 18 && minutes >= 20);
      const slot = urgentSlot ? "18_20" : "18_00";

      if (!checkIfDismissedForSlot(slot)) {
        setIsUrgent(urgentSlot);
        setIsOpen(true);
      }
    }
  };

  useEffect(() => {
    evaluateAutoReminder();

    const interval = setInterval(evaluateAutoReminder, 60000);

    const handleTestAlert = (e: CustomEvent<{ isUrgent?: boolean }>) => {
      setIsUrgent(!!e.detail?.isUrgent);
      setIsOpen(true);
    };

    const handleSubmitted = () => {
      setIsOpen(false);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "work_report_dismissed_time" || e.key?.startsWith("work_report_submitted_")) {
        const now = new Date();
        const slot = now.getHours() > 18 || (now.getHours() === 18 && now.getMinutes() >= 20) ? "18_20" : "18_00";
        if (checkIfAlreadySubmittedToday() || checkIfDismissedForSlot(slot)) {
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
        const urgentSlot = data?.slot === "18_20" || now.getHours() > 18 || (now.getHours() === 18 && now.getMinutes() >= 20);
        const slot = data?.slot || (urgentSlot ? "18_20" : "18_00");

        if (!checkIfAlreadySubmittedToday() && !checkIfDismissedForSlot(slot)) {
          setIsUrgent(data?.message?.includes("6:20") || urgentSlot);
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
    const slot =
      now.getHours() > 18 || (now.getHours() === 18 && now.getMinutes() >= 20)
        ? "18_20"
        : "18_00";
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
                ? "🚨 FINAL REMINDER: Submit Work Report"
                : "🚨 Daily Work Report Reminder"}
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
            <span>
              {isUrgent
                ? "6:20 PM Urgent Final Reminder"
                : "6:00 PM Daily Reminder"}
            </span>
          </div>

          <p className="wrr-modal-text">
            {isUrgent
              ? "It's past 6:20 PM! Please submit your daily work report immediately before leaving for the day."
              : "It's 6:00 PM! Please take a moment to submit your daily work report for today."}
          </p>

          <div className="wrr-warning-box">
            <AlertTriangle size={18} className="wrr-warning-icon" />
            <div>
              <strong>Action Required:</strong> Submitting your daily work report
              on time ensures accurate daily tracking and compliance.
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

