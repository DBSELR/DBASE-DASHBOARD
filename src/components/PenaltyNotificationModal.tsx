import React, { useState, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  X,
  FileText,
  Clock,
  User,
  Info,
  ArrowRightLeft
} from "lucide-react";
import { hubConnection, startHub } from "../services/signalRService";
import "./PenaltyNotificationModal.css";

export interface PenaltyAlertPayload {
  notificationId?: number;
  penaltyId?: number;
  empCode?: string;
  fromEmpCode?: string;
  toEmpCode?: string;
  slipType?: string;
  penaltyType?: string;
  remarks?: string;
  appliedBy?: string;
  message?: string;
  alertTitle?: string;
  createdDate?: string;
  type?: string;
  action?: string;
}

export const PenaltyNotificationModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [alertData, setAlertData] = useState<PenaltyAlertPayload | null>(null);
  const history = useHistory();
  const location = useLocation();

  const getLoggedInEmpCode = (): string => {
    try {
      const uStr = localStorage.getItem("user");
      if (!uStr) return "";
      const u = JSON.parse(uStr);
      return String(u?.empCode || u?.EmpCode || u?.username || "").trim();
    } catch {
      return "";
    }
  };

  // ── Web Audio Chime Synthesizer ──
  const playAlertSound = useCallback((isCleared: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isCleared) {
        // High-pitched happy double chime
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else {
        // Alert chime
        osc.type = "triangle";
        osc.frequency.setValueAtTime(466.16, ctx.currentTime); // Bb4
        osc.frequency.setValueAtTime(392.00, ctx.currentTime + 0.14); // G4
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch {
      // Audio playback might be restricted if user hasn't clicked anything yet
    }
  }, []);

  // ── Native Browser Notification ──
  const showNativeNotification = useCallback((title: string, body: string) => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(title, {
            body: body,
            icon: "/assets/icon/favicon.png"
          });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") {
              new Notification(title, {
                body: body,
                icon: "/assets/icon/favicon.png"
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[PenaltyNotificationModal] Native notification error", e);
    }
  }, []);

  const triggerAlert = useCallback((data: PenaltyAlertPayload) => {
    const myEmpCode = getLoggedInEmpCode();
    const targetEmp = String(data.empCode || data.toEmpCode || "").trim();

    // If targetEmp is provided and doesn't match our logged-in employee code, ignore it
    if (targetEmp && myEmpCode && targetEmp.toLowerCase() !== myEmpCode.toLowerCase()) {
      return;
    }

    const isCleared =
      data.penaltyType === "Slip Cleared" ||
      data.action === "slip_cleared" ||
      (data.message && data.message.toLowerCase().includes("cleared")) ||
      false;

    setAlertData(data);
    setIsOpen(true);
    playAlertSound(Boolean(isCleared));

    const defaultTitle = isCleared
      ? "🎉 Penalty Slip Cleared!"
      : `⚠️ ${data.slipType || "Penalty Slip"} Issued!`;
    const title = data.alertTitle || defaultTitle;
    const body = data.message || data.remarks || "A penalty update was recorded on your account.";
    showNativeNotification(title, body);
  }, [playAlertSound, showNativeNotification]);

  useEffect(() => {
    // 1. Ensure SignalR connection is active
    startHub().catch(() => {});

    // 2. Listen for real-time penalty broadcasts and updates
    const handleBroadcast = (payload: any) => {
      if (!payload) return;
      if (
        payload.type === "penalty" ||
        payload.type === "slip_transfer_request" ||
        payload.slipType ||
        payload.penaltyType
      ) {
        triggerAlert(payload);
      }
    };

    const handleGeneralNotification = (payload: any) => {
      if (!payload) return;
      if (
        payload.type === "penalty" ||
        (payload.message &&
          (payload.message.toLowerCase().includes("slip") ||
            payload.message.toLowerCase().includes("penalty")))
      ) {
        triggerAlert(payload);
      }
    };

    // 3. Listen for custom window event for manual triggering or tests
    const handleTestEvent = (e: CustomEvent<PenaltyAlertPayload>) => {
      if (e.detail) {
        triggerAlert(e.detail);
      }
    };

    try {
      hubConnection.on("ReceivePenaltyBroadcast", handleBroadcast);
      hubConnection.on("ReceivePenaltyUpdate", handleBroadcast);
      hubConnection.on("ReceiveNotification", handleGeneralNotification);
    } catch (err) {
      console.warn("[PenaltyNotificationModal] SignalR bind error:", err);
    }

    window.addEventListener("test-penalty-alert" as any, handleTestEvent);

    return () => {
      try {
        hubConnection.off("ReceivePenaltyBroadcast", handleBroadcast);
        hubConnection.off("ReceivePenaltyUpdate", handleBroadcast);
        hubConnection.off("ReceiveNotification", handleGeneralNotification);
      } catch {}
      window.removeEventListener("test-penalty-alert" as any, handleTestEvent);
    };
  }, [triggerAlert]);

  const handleDismiss = () => {
    setIsOpen(false);
  };

  const handleViewPenalties = () => {
    setIsOpen(false);
    if (location.pathname !== "/employee-penalties") {
      history.push("/employee-penalties");
    }
  };

  if (!isOpen || !alertData) return null;

  // Determine themes
  const slipType = alertData.slipType || "Yellow Slip";
  const slipLower = slipType.toLowerCase();
  const isCleared =
    alertData.penaltyType === "Slip Cleared" ||
    alertData.action === "slip_cleared" ||
    (alertData.message && alertData.message.toLowerCase().includes("cleared"));

  let colorTheme = "yellow";
  if (isCleared || slipLower.includes("green")) {
    colorTheme = "green";
  } else if (slipLower.includes("red")) {
    colorTheme = "red";
  } else if (slipLower.includes("orange")) {
    colorTheme = "orange";
  }

  const modalTitle = isCleared
    ? "🎉 Penalty Slip Cleared!"
    : alertData.action === "slip_received"
    ? "🚨 Transferred Slip Received!"
    : `⚠️ New ${slipType} Issued`;

  return (
    <div className="pnm-overlay" onClick={handleDismiss}>
      <div
        className={`pnm-card pnm-glow-${colorTheme}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`pnm-header pnm-header-${colorTheme}`}>
          <div className="pnm-header-title-box">
            {isCleared ? (
              <CheckCircle2 size={24} className="pnm-bell-icon" />
            ) : colorTheme === "red" ? (
              <ShieldAlert size={24} className="pnm-bell-icon" />
            ) : (
              <AlertTriangle size={24} className="pnm-bell-icon" />
            )}
            <h3>{modalTitle}</h3>
          </div>
          <button className="pnm-close-btn" onClick={handleDismiss} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="pnm-body">
          {/* Top Badges */}
          <div className="pnm-top-badges">
            <span className={`pnm-slip-badge pnm-slip-${colorTheme}`}>
              {isCleared ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>SLIP CLEARED</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} />
                  <span>{slipType}</span>
                </>
              )}
            </span>
            <div className="pnm-time-tag">
              <Clock size={13} />
              <span>
                {alertData.createdDate
                  ? new Date(alertData.createdDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "Just Now"}
              </span>
            </div>
          </div>

          {/* Details Card */}
          <div className="pnm-details-card">
            <div className="pnm-violation-title">
              <FileText size={16} />
              <span>{alertData.penaltyType || "Policy Violation"}</span>
            </div>

            {alertData.remarks && (
              <div className="pnm-remarks-box">
                <strong>Reason: </strong>
                {alertData.remarks}
              </div>
            )}

            {alertData.message && !alertData.remarks && (
              <div className="pnm-remarks-box">
                {alertData.message}
              </div>
            )}

            <div className="pnm-meta-row">
              <span>
                <strong>Issued by: </strong>
                {alertData.appliedBy || "HR / Management"}
              </span>
              <span>
                <strong>Ref ID: </strong>#{alertData.penaltyId || alertData.notificationId || "N/A"}
              </span>
            </div>
          </div>

          {/* Advice callout */}
          {isCleared ? (
            <div className="pnm-callout pnm-callout-success">
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
              <div>
                <strong>Record Updated:</strong> This violation has been officially removed from your active slips and performance scorecard.
              </div>
            </div>
          ) : (
            <div className="pnm-callout pnm-callout-warning">
              <Info size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
              <div>
                <strong>Action Option:</strong> You can review this slip or <strong>Transfer</strong> it to another employee if you observed a policy violation with evidence.
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pnm-actions">
            <button
              className={`pnm-btn-primary pnm-btn-primary-${colorTheme}`}
              onClick={handleViewPenalties}
            >
              <span>View My Penalty Slips</span>
              <ArrowRight size={17} />
            </button>
            <button className="pnm-btn-secondary" onClick={handleDismiss}>
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PenaltyNotificationModal;
