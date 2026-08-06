import React, { useEffect, useState } from "react";
import { IonIcon } from "@ionic/react";
import {
  navigateOutline,
  refreshOutline,
  warningOutline,
  locationOutline
} from "ionicons/icons";
import axios from "axios";
import { API_BASE } from "../config";
import { useLocationBroadcaster } from "../hooks/useLocationBroadcaster";
import LocationPermissionModal from "./LocationPermissionModal";
import "./OnDutyEmployeeStatusCard.css";

interface DutyDetails {
  active: boolean;
  dutyId?: string;
  college?: string;
  description?: string;
}

export const OnDutyEmployeeStatusCard: React.FC = () => {
  const broadcaster = useLocationBroadcaster();
  const [dutyInfo, setDutyInfo] = useState<DutyDetails | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  const isPermissionIssue =
    broadcaster.permissionState === "denied" || broadcaster.permissionState === "prompt";

  useEffect(() => {
    const fetchTodayDuty = async () => {
      try {
        const rawUser = localStorage.getItem("user");
        let empCode = "";
        if (rawUser) {
          const u = JSON.parse(rawUser);
          empCode = String(
            u.empCode ||
            u.EmpCode ||
            u.emp_code ||
            u.Emp_Code ||
            u.username ||
            u.Username ||
            u.UserId ||
            u.userid ||
            u.id ||
            ""
          ).trim();
        }
        if (!empCode) return;

        const rawToken =
          localStorage.getItem("token") ||
          localStorage.getItem("Token") ||
          sessionStorage.getItem("token") ||
          "";
        const token = rawToken.replace(/^"|"$/g, "");
        const headers = token
          ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
          : {};

        // 1. Primary check via Tracking API
        try {
          const res = await axios.post(
            `${API_BASE}Session/auto-start-session`,
            { sessionType: "OnDuty", empCode },
            { headers, timeout: 8000 }
          );

          const data = res.data;
          const isActive = data && (data.active === true || data.isActive === true || data.Active === true || data.IsActive === true);
          if (isActive) {
            setDutyInfo({
              active: true,
              dutyId: String(data.referenceId || data.ReferenceId || data.dutyId || ""),
              college: data.clientName || data.ClientName || data.college || "Field Duty",
              description: data.description || data.Description || "Active Field Duty",
            });
            if (!broadcaster.isTracking) {
              console.log("[OnDutyStatusCard] On-duty active. Auto-starting tracking...");
              broadcaster.setIsTracking(true);
            }
            return;
          }
        } catch (e) {}

        // 2. Fallback check via OnDuty list endpoints
        try {
          const cleanApiBase = API_BASE.replace(/\/api\/$/, "/");
          const dutyRes = await axios.get(
            `${cleanApiBase}OnDuty/load_my_duties?empCode=${empCode}`,
            { headers, timeout: 8000 }
          );

          const list: any[] = Array.isArray(dutyRes.data)
            ? dutyRes.data
            : dutyRes.data?.data || [];

          const todayStr = new Date().toISOString().split("T")[0];
          const todayDuty = list.find((d: any) => {
            const df = (d.DateFrom || d.Date || "").split("T")[0];
            const dt = (d.DateTo || d.DateFrom || d.Date || "").split("T")[0];
            return df <= todayStr && todayStr <= dt;
          });

          if (todayDuty) {
            setDutyInfo({
              active: true,
              dutyId: String(todayDuty.id || todayDuty.ID || ""),
              college: todayDuty.College || todayDuty.Location || "Field Duty Assignment",
              description: todayDuty.Description || "Active On-Duty Visit",
            });
            if (!broadcaster.isTracking) {
              console.log("[OnDutyStatusCard] Fallback on-duty active. Auto-starting tracking...");
              broadcaster.setIsTracking(true);
            }
            return;
          }
        } catch (e) {}

        // Self-cleaning: if no active duty is found for today, ensure tracking is stopped
        if (broadcaster.isTracking) {
          console.log("[OnDutyStatusCard] No active duty found. Stopping tracking.");
          broadcaster.setIsTracking(false);
        }
      } catch (err) {
        console.warn("[OnDutyStatusCard] Fetch duty info warning:", err);
      }
    };

    fetchTodayDuty();
  }, []);

  const handleManualPing = async () => {
    setIsPinging(true);
    await broadcaster.triggerImmediatePing();
    setTimeout(() => setIsPinging(false), 1200);
  };

  // DO NOT show this card to non-on-duty employees!
  if (!dutyInfo || !dutyInfo.active) {
    return null;
  }

  return (
    <>
      <div className="native-onduty-card">
        {/* Header Status Row */}
        <div className="native-onduty-card-header">
          <div className="native-onduty-title-group">
            <IonIcon icon={navigateOutline} className="native-onduty-title-icon" />
            <span className="native-onduty-title-text">Today's Field Duty</span>
          </div>

          <div
            className={`native-onduty-badge ${
              isPermissionIssue
                ? "warning"
                : broadcaster.movementStatus === "Moving"
                ? "moving"
                : "idle"
            }`}
            onClick={() => isPermissionIssue && setShowPermissionModal(true)}
            style={{ cursor: isPermissionIssue ? "pointer" : "default" }}
          >
            <span className="native-pulse-dot"></span>
            {isPermissionIssue
              ? "Permission Required"
              : `GPS ${broadcaster.movementStatus}`}
          </div>
        </div>

        {/* Card Body - Duty Details */}
        <div className="native-onduty-body">
          <div className="native-duty-details">
            <IonIcon icon={locationOutline} className="native-duty-location-icon" />
            <div className="native-duty-text-content">
              <h4>{dutyInfo.college || "On-Duty Field Assignment"}</h4>
              <p>{dutyInfo.description || "Active Duty in Progress"}</p>
            </div>
          </div>

          {/* Realtime Metrics Grid */}
          <div className="native-metrics-row">
            <div className="native-metric-box">
              <span className="native-metric-label">⚡ Speed</span>
              <span className="native-metric-val">
                {broadcaster.currentSpeedKmh.toFixed(1)} km/h
              </span>
            </div>

            <div className="native-metric-box">
              <span className="native-metric-label">⏱️ Last Ping</span>
              <span className="native-metric-val">
                {broadcaster.lastPingTime
                  ? broadcaster.lastPingTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "Connecting..."}
              </span>
            </div>

            <div className="native-metric-box">
              <span className="native-metric-label">🟢 GPS State</span>
              <span className="native-metric-val">
                {isPermissionIssue ? "⚠️ Required" : "Active"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="native-onduty-actions">
            <button
              className="native-btn-ping"
              onClick={handleManualPing}
              disabled={isPinging}
            >
              <IonIcon
                icon={refreshOutline}
                style={{
                  animation: isPinging ? "spin 1s linear infinite" : "none",
                }}
              />
              {isPinging ? "Pinging GPS..." : "Ping Location Now"}
            </button>

            {isPermissionIssue && (
              <button
                className="native-btn-warning"
                onClick={() => setShowPermissionModal(true)}
              >
                <IonIcon icon={warningOutline} />
                Fix Permission
              </button>
            )}
          </div>
        </div>
      </div>

      <LocationPermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onPermissionGranted={() => broadcaster.triggerImmediatePing()}
      />
    </>
  );
};

export default OnDutyEmployeeStatusCard;
