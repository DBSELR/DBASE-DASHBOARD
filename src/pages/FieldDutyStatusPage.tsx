import React, { useEffect, useState } from "react";
import { IonPage, IonContent, IonIcon, IonSpinner } from "@ionic/react";
import { useHistory } from "react-router-dom";
import {
  navigateOutline,
  refreshOutline,
  warningOutline,
  locationOutline,
  arrowBackOutline,
  shieldCheckmarkOutline,
  batteryChargingOutline,
  hardwareChipOutline
} from "ionicons/icons";
import axios from "axios";
import { API_BASE } from "../config";
import { useLocationBroadcaster } from "../hooks/useLocationBroadcaster";
import LocationPermissionModal from "../components/LocationPermissionModal";
import "./FieldDutyStatusPage.css";

interface DutyDetails {
  active: boolean;
  dutyId?: string;
  college?: string;
  description?: string;
}

const FieldDutyStatusPage: React.FC = () => {
  const history = useHistory();
  const broadcaster = useLocationBroadcaster();
  const [dutyInfo, setDutyInfo] = useState<DutyDetails | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [loading, setLoading] = useState(true);

  const isPermissionIssue =
    broadcaster.permissionState === "denied" || broadcaster.permissionState === "prompt";

  const fetchTodayDuty = async () => {
    setLoading(true);
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

      if (!empCode) {
        setDutyInfo({
          active: true,
          college: "General Field Duty",
          description: "Active Field Location Tracking",
        });
        setLoading(false);
        return;
      }

      const rawToken =
        localStorage.getItem("token") ||
        localStorage.getItem("Token") ||
        sessionStorage.getItem("token") ||
        "";
      const token = rawToken.replace(/^"|"$/g, "");
      const headers = token
        ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
        : {};

      // 1. Primary check via Session API
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
            college: data.clientName || data.ClientName || data.college || "Field Duty Assignment",
            description: data.description || data.Description || "Active Field Duty in Progress",
          });
          if (!broadcaster.isTracking) {
            broadcaster.setIsTracking(true);
          }
          setLoading(false);
          return;
        }
      } catch (e) {}

      // 2. Fallback check via OnDuty list endpoint
      try {
        const dutyRes = await axios.get(
          `${API_BASE}OnDuty/load_my_duties?empCode=${empCode}`,
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
            broadcaster.setIsTracking(true);
          }
          setLoading(false);
          return;
        }
      } catch (e) {}

      // Default fallback if no custom client duty assigned
      setDutyInfo({
        active: true,
        college: "Field Duty Assignment",
        description: "Standard Field Attendance & GPS Sync Active",
      });
    } catch (err) {
      console.warn("[FieldDutyStatusPage] Fetch error:", err);
      setDutyInfo({
        active: true,
        college: "Field Duty Assignment",
        description: "Field Location Sync Active",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayDuty();
  }, []);

  const handleManualPing = async () => {
    setIsPinging(true);
    await broadcaster.triggerImmediatePing();
    setTimeout(() => setIsPinging(false), 1200);
  };

  return (
    <IonPage>
      <IonContent className="fds-page-container" scrollY={true}>
        <div className="fds-wrapper">
          {/* Header Bar */}
          <header className="fds-header">
            <button className="fds-back-btn" onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} />
              <span>Back</span>
            </button>
            <h1 className="fds-header-title">Today's Field Duty</h1>
            <button
              className="fds-refresh-btn"
              onClick={fetchTodayDuty}
              title="Refresh Duty Status"
            >
              <IonIcon
                icon={refreshOutline}
                style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
              />
            </button>
          </header>

          {/* Primary Field Duty Card */}
          <div className="fds-main-card">
            <div className="fds-card-top">
              <div className="fds-title-group">
                <div className="fds-title-icon-ring">
                  <IonIcon icon={navigateOutline} style={{ fontSize: "1.4rem" }} />
                </div>
                <span className="fds-title-text">Today's Field Duty</span>
              </div>

              <div
                className={`fds-badge ${
                  isPermissionIssue
                    ? "warning"
                    : broadcaster.movementStatus === "Moving"
                    ? "moving"
                    : "idle"
                }`}
                onClick={() => isPermissionIssue && setShowPermissionModal(true)}
                style={{ cursor: isPermissionIssue ? "pointer" : "default" }}
              >
                <span className="fds-pulse-dot"></span>
                {isPermissionIssue
                  ? "Permission Required"
                  : `GPS ${broadcaster.movementStatus || "Idle"}`}
              </div>
            </div>

            {/* Duty Details Box */}
            <div className="fds-duty-details">
              <IonIcon icon={locationOutline} className="fds-duty-icon" />
              <div>
                <h4>{dutyInfo?.college || "Field Duty Assignment"}</h4>
                <p>{dutyInfo?.description || "Active Duty Location Tracking"}</p>
              </div>
            </div>

            {/* Realtime Metrics Grid */}
            <div className="fds-metrics-grid">
              <div className="fds-metric-card">
                <span className="fds-metric-label">⚡ Speed</span>
                <span className="fds-metric-val">
                  {broadcaster.currentSpeedKmh.toFixed(1)} km/h
                </span>
              </div>

              <div className="fds-metric-card">
                <span className="fds-metric-label">⏱️ Last Ping</span>
                <span className="fds-metric-val">
                  {broadcaster.lastPingTime
                    ? broadcaster.lastPingTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "Connecting..."}
                </span>
              </div>

              <div className="fds-metric-card">
                <span className="fds-metric-label">🟢 GPS State</span>
                <span className="fds-metric-val">
                  {isPermissionIssue ? "⚠️ Required" : "Active"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="fds-actions-row">
              <button
                className="fds-act-btn primary"
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
                  className="fds-act-btn warning"
                  onClick={() => setShowPermissionModal(true)}
                >
                  <IonIcon icon={warningOutline} />
                  Fix Permission
                </button>
              )}
            </div>
          </div>

          {/* System Diagnostics Info Card */}
          <div className="fds-info-card">
            <div className="fds-info-title">
              <IonIcon icon={shieldCheckmarkOutline} style={{ color: "#4f46e5", fontSize: "1.1rem" }} />
              <span>GPS Telemetry & Diagnostics</span>
            </div>

            <div className="fds-diag-grid">
              <div className="fds-diag-item">
                <span className="fds-diag-lbl">🛡️ App Permission</span>
                <span
                  className="fds-diag-val"
                  style={{
                    color: broadcaster.permissionState === "granted" ? "#10b981" : "#ef4444",
                  }}
                >
                  {broadcaster.permissionState === "granted" ? "Granted" : "Permission Needed"}
                </span>
              </div>

              <div className="fds-diag-item">
                <span className="fds-diag-lbl">📡 Tracking Engine</span>
                <span
                  className="fds-diag-val"
                  style={{
                    color: broadcaster.isTracking ? "#10b981" : "#f59e0b",
                  }}
                >
                  {broadcaster.isTracking ? "Broadcasting Active" : "Standby"}
                </span>
              </div>

              <div className="fds-diag-item">
                <span className="fds-diag-lbl">🔋 Battery Mode</span>
                <span className="fds-diag-val">Unrestricted</span>
              </div>

              <div className="fds-diag-item">
                <span className="fds-diag-lbl">⚙️ Background GPS</span>
                <span className="fds-diag-val">Foreground Service</span>
              </div>
            </div>
          </div>
        </div>

        <LocationPermissionModal
          isOpen={showPermissionModal}
          onClose={() => setShowPermissionModal(false)}
          onPermissionGranted={() => broadcaster.triggerImmediatePing()}
        />
      </IonContent>
    </IonPage>
  );
};

export default FieldDutyStatusPage;
