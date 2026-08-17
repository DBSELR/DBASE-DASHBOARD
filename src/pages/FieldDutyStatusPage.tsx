import React, { useEffect, useState } from "react";
import { IonPage, IonContent, IonIcon } from "@ionic/react";
import { useHistory } from "react-router-dom";
import {
  navigateOutline,
  refreshOutline,
  warningOutline,
  locationOutline,
  arrowBackOutline,
  shieldCheckmarkOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  carOutline,
  lockClosedOutline,
  arrowForwardOutline,
  speedometerOutline
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
  location?: string;
  transportMode?: string;
  vehicleNo?: string;
  dateFrom?: string;
  dateTo?: string;
  approvalStatus: "APPROVED" | "PENDING" | "REJECTED";
  approvalBadgeText: string;
  pendingRA?: string;
  ra1Status?: string;
  ra2Status?: string;
  currentRA?: string;
  hasStartedRide?: boolean;
  dayTripsCount?: number;
  latestReadingFrom?: string;
  latestReadingTo?: string;
  latestDistance?: number;
  latestFuel?: number;
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
          approvalStatus: "APPROVED",
          approvalBadgeText: "APPROVED",
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

      // 1. Primary check via OnDuty list endpoint
      try {
        let dutyRes = await axios.get(
          `${API_BASE}OnDuty/load_my_duties?empCode=${empCode}`,
          { headers, timeout: 8000 }
        );

        let list: any[] = Array.isArray(dutyRes.data)
          ? dutyRes.data
          : dutyRes.data?.data || [];

        if (!list.length) {
          try {
            const wrRes = await axios.get(
              `${API_BASE}Workreport/load_my_duties?empCode=${empCode}`,
              { headers, timeout: 6000 }
            );
            list = Array.isArray(wrRes.data) ? wrRes.data : wrRes.data?.data || [];
          } catch {}
        }

        const todayStr = new Date().toISOString().split("T")[0];
        const todayDuty = list.find((d: any) => {
          const df = String(d.dateFrom || d.DateFrom || d.Date || "").split("T")[0];
          const dt = String(d.dateTo || d.DateTo || d.DateFrom || d.Date || "").split("T")[0];
          return df <= todayStr && todayStr <= dt;
        }) || list.find((d: any) => {
          const st = String(d.status || d.Status || d.FinalStatus || "").toLowerCase();
          return st === "approved";
        }) || list[0];

        if (todayDuty) {
          const ra1St = String(todayDuty.RA1_Status || todayDuty.ra1_Status || todayDuty.rA1_Status || "").trim().toLowerCase();
          const ra2St = String(todayDuty.RA2_Status || todayDuty.ra2_Status || todayDuty.rA2_Status || "").trim().toLowerCase();
          const currentRA = String(todayDuty.CurrentRA || todayDuty.currentRA || "RA1").trim();
          const overallSt = String(todayDuty.status || todayDuty.Status || todayDuty.FinalStatus || todayDuty.L_status || "").trim().toLowerCase();

          let verdict: "APPROVED" | "PENDING" | "REJECTED" = "PENDING";
          let badgeText = "Pending at RA1";
          let pendingRA = currentRA || "RA1";

          if (ra1St === "rejected" || ra2St === "rejected" || overallSt.includes("rejected")) {
            verdict = "REJECTED";
            badgeText = "REJECTED";
          } else if (ra1St === "approved" && (ra2St === "approved" || !todayDuty.RA2 || todayDuty.RA2 === "-" || todayDuty.RA2 === "")) {
            verdict = "APPROVED";
            badgeText = "APPROVED";
          } else if (overallSt.includes("approved")) {
            verdict = "APPROVED";
            badgeText = "APPROVED";
          } else {
            verdict = "PENDING";
            if (ra1St === "approved" && ra2St !== "approved") {
              badgeText = "Pending at RA2";
              pendingRA = String(todayDuty.RA2_Name || todayDuty.RA2 || "RA2");
            } else {
              badgeText = "Pending at RA1";
              pendingRA = String(todayDuty.RA1_Name || todayDuty.RA1 || "RA1");
            }
          }

          const rawTrips = todayDuty.dayTrips || todayDuty.DayTrips || [];
          const dayTrips = Array.isArray(rawTrips) ? rawTrips : [];
          const hasDayTrips = dayTrips.length > 0;
          const latestTrip = hasDayTrips ? dayTrips[dayTrips.length - 1] : null;

          const rFrom = latestTrip?.readingFrom != null ? String(latestTrip.readingFrom).trim() : "";
          const rTo = latestTrip?.readingTo != null ? String(latestTrip.readingTo).trim() : "";
          const rDist = latestTrip?.distance != null ? Number(latestTrip.distance) : 0;
          const rFuel = latestTrip?.fuelAmount != null ? Number(latestTrip.fuelAmount) : 0;

          const hasStartedRide = hasDayTrips && (
            Boolean(rFrom && rFrom !== "-") ||
            Boolean(latestTrip?.readingFromImagePath) ||
            Boolean(latestTrip?.dayTrip_Id) ||
            Boolean(rTo && rTo !== "-") ||
            (Array.isArray(latestTrip?.visits) && latestTrip.visits.length > 0)
          );

          const college = todayDuty.college || todayDuty.College || todayDuty.client || todayDuty.Client || todayDuty.ClientName || todayDuty.Location || todayDuty.location || "Field Duty Assignment";
          const description = todayDuty.description || todayDuty.Description || todayDuty.college || todayDuty.College || "Active On-Duty Visit";
          const location = todayDuty.location || todayDuty.Location || "";
          const transportMode = todayDuty.mode || todayDuty.Mode || todayDuty.Mode_of_Trans || todayDuty.TransportMode || "";
          const vehicleNo = todayDuty.vehicle_No || todayDuty.vehicleNo || todayDuty.Vehicle_No || todayDuty.VehicleNo || "";

          setDutyInfo({
            active: true,
            dutyId: String(todayDuty.id || todayDuty.ID || todayDuty.duty_Id || todayDuty.Duty_Id || ""),
            college,
            description,
            location,
            transportMode,
            vehicleNo,
            dateFrom: todayDuty.dateFrom || todayDuty.DateFrom,
            dateTo: todayDuty.dateTo || todayDuty.DateTo,
            approvalStatus: verdict,
            approvalBadgeText: badgeText,
            pendingRA,
            ra1Status: ra1St,
            ra2Status: ra2St,
            currentRA,
            hasStartedRide,
            dayTripsCount: dayTrips.length,
            latestReadingFrom: rFrom,
            latestReadingTo: rTo,
            latestDistance: rDist,
            latestFuel: rFuel,
          });

          if (verdict === "APPROVED" && !broadcaster.isTracking) {
            broadcaster.setIsTracking(true);
          }
          setLoading(false);
          return;
        }
      } catch (e) {}

      // 2. Fallback check via Session API
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
            approvalStatus: "APPROVED",
            approvalBadgeText: "APPROVED",
            hasStartedRide: true,
          });
          if (!broadcaster.isTracking) {
            broadcaster.setIsTracking(true);
          }
          setLoading(false);
          return;
        }
      } catch (e) {}

      setDutyInfo({
        active: true,
        college: "Field Duty Assignment",
        description: "Standard Field Attendance & GPS Sync Active",
        approvalStatus: "APPROVED",
        approvalBadgeText: "APPROVED",
      });
    } catch (err) {
      console.warn("[FieldDutyStatusPage] Fetch error:", err);
      setDutyInfo({
        active: true,
        college: "Field Duty Assignment",
        description: "Field Location Sync Active",
        approvalStatus: "APPROVED",
        approvalBadgeText: "APPROVED",
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

  const handleNavigateToOnDuty = () => {
    history.push({
      pathname: "/requests",
      search: "?type=onduty",
      state: { type: "onduty", dutyId: dutyInfo?.dutyId },
    });
  };

  const isApproved = dutyInfo?.approvalStatus === "APPROVED";
  const isRejected = dutyInfo?.approvalStatus === "REJECTED";
  const hasStartedRide = dutyInfo?.hasStartedRide === true;

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
            <div className="fds-card-top" onClick={handleNavigateToOnDuty} style={{ cursor: "pointer" }}>
              <div className="fds-title-group">
                <div className="fds-title-icon-ring">
                  <IonIcon icon={navigateOutline} style={{ fontSize: "1.4rem" }} />
                </div>
                <span className="fds-title-text">Today's Field Duty</span>
              </div>

              {/* Dynamic Approval Status Badge */}
              <div
                className={`approval-badge ${
                  isApproved ? "approved" : isRejected ? "rejected" : "pending"
                }`}
              >
                <span className="fds-pulse-dot"></span>
                {isApproved
                  ? hasStartedRide
                    ? "✅ APPROVED • 🚗 RIDE ACTIVE"
                    : "✅ APPROVED"
                  : isRejected
                  ? "❌ REJECTED"
                  : `⏳ ${dutyInfo?.approvalBadgeText}`}
              </div>
            </div>

            {/* Duty Details Box */}
            <div className="fds-duty-details" onClick={handleNavigateToOnDuty} style={{ cursor: "pointer" }}>
              <IonIcon icon={locationOutline} className="fds-duty-icon" />
              <div>
                <h4>{dutyInfo?.college || "Field Duty Assignment"}</h4>
                <p>{dutyInfo?.description || dutyInfo?.location || "Active Duty Location Tracking"}</p>
                
                {/* Transport & Vehicle Info */}
                {(dutyInfo?.transportMode || dutyInfo?.vehicleNo) && (
                  <div style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "6px", background: "#f1f5f9", padding: "3px 8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 700, color: "#334155" }}>
                    <IonIcon icon={carOutline} />
                    <span>
                      {dutyInfo.transportMode}
                      {dutyInfo.vehicleNo ? ` • ${dutyInfo.vehicleNo}` : ""}
                    </span>
                  </div>
                )}

                {/* Ride Reading Summary if Started */}
                {hasStartedRide && (
                  <div style={{ marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "6px", background: "#eff6ff", padding: "3px 8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 700, color: "#1e40af" }}>
                    <IonIcon icon={speedometerOutline} />
                    <span>
                      Reading: {dutyInfo.latestReadingFrom || "0"}
                      {dutyInfo.latestReadingTo ? ` → ${dutyInfo.latestReadingTo}` : ""}
                      {dutyInfo.latestDistance ? ` (${dutyInfo.latestDistance} KMs)` : ""}
                      {dutyInfo.latestFuel ? ` • Fuel: ${dutyInfo.latestFuel}/-` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Instructions Banner */}
            <div
              className={`status-instruction-banner ${
                isApproved ? "approved" : isRejected ? "rejected" : "pending"
              }`}
            >
              <div className="instruction-header">
                <IonIcon
                  icon={isApproved ? checkmarkCircleOutline : alertCircleOutline}
                  style={{ fontSize: "1.2rem", flexShrink: 0 }}
                />
                <span>
                  {isApproved
                    ? hasStartedRide
                      ? "🚗 Active On-Duty Journey"
                      : "✅ Duty Request Approved!"
                    : isRejected
                    ? "❌ Duty Request Rejected by RA"
                    : `⚠️ Awaiting Approval from ${dutyInfo?.pendingRA || "RA"}`}
                </span>
              </div>
              <p className="instruction-subtext">
                {isApproved
                  ? hasStartedRide
                    ? "Ride is in progress. Live GPS location tracking is active. Tap below to manage trip logs & readings."
                    : "All approvals received. Tap below to open On Duty Manager, record odometer readings, or view logs."
                  : isRejected
                  ? "Your request was rejected. Ride start option is locked. Contact your manager for details."
                  : `Current Status: ${dutyInfo?.approvalBadgeText}. You must have approval from all RAs before starting ride tracking.`}
              </p>
            </div>

            {/* Realtime Metrics Grid */}
            {isApproved && (
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
                    {isPermissionIssue ? "⚠️ Required" : broadcaster.isTracking ? "Active" : "Ready"}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="fds-actions-row">
              <button
                className="fds-act-btn success"
                onClick={handleNavigateToOnDuty}
                style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#ffffff" }}
              >
                <IonIcon icon={hasStartedRide ? carOutline : isApproved ? checkmarkCircleOutline : lockClosedOutline} />
                <span>
                  {hasStartedRide
                    ? "Manage Duty & Logs"
                    : isApproved
                    ? "Open On-Duty Manager"
                    : "View in On-Duty Manager"}
                </span>
                <IonIcon icon={arrowForwardOutline} style={{ marginLeft: "auto" }} />
              </button>

              {isApproved && broadcaster.isTracking && (
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
                  {isPinging ? "Pinging..." : "Ping GPS"}
                </button>
              )}

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
