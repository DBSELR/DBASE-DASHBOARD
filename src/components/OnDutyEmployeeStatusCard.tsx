import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { IonIcon } from "@ionic/react";
import {
  navigateOutline,
  refreshOutline,
  warningOutline,
  locationOutline,
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
import LocationPermissionModal from "./LocationPermissionModal";
import "./OnDutyEmployeeStatusCard.css";

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

export const OnDutyEmployeeStatusCard: React.FC = () => {
  const history = useHistory();
  const broadcaster = useLocationBroadcaster();
  const [dutyInfo, setDutyInfo] = useState<DutyDetails | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  const isPermissionIssue =
    broadcaster.permissionState === "denied" || broadcaster.permissionState === "prompt";

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

      // 1. Check OnDuty list endpoint
      try {
        let dutyRes = await axios.get(
          `${API_BASE}OnDuty/load_my_duties?empCode=${empCode}`,
          { headers, timeout: 8000 }
        );

        let list: any[] = Array.isArray(dutyRes.data)
          ? dutyRes.data
          : dutyRes.data?.data || [];

        // Fallback to Workreport controller if empty
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
          // Parse RA Statuses
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

          // Parse Day Trips & Ride Status
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

          // Auto-start broadcaster tracking ONLY if approved
          if (verdict === "APPROVED" && !broadcaster.isTracking) {
            broadcaster.setIsTracking(true);
          }
          return;
        }
      } catch (e) {}

      // Fallback check via Tracking Session API
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
            approvalStatus: "APPROVED",
            approvalBadgeText: "APPROVED",
            hasStartedRide: true,
          });
          if (!broadcaster.isTracking) {
            broadcaster.setIsTracking(true);
          }
          return;
        }
      } catch (e) {}

      if (broadcaster.isTracking) {
        broadcaster.setIsTracking(false);
      }
    } catch (err) {
      console.warn("[OnDutyStatusCard] Fetch duty info warning:", err);
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

  if (!dutyInfo || !dutyInfo.active) {
    return null;
  }

  const isApproved = dutyInfo.approvalStatus === "APPROVED";
  const isRejected = dutyInfo.approvalStatus === "REJECTED";
  const isPending = dutyInfo.approvalStatus === "PENDING";
  const hasStartedRide = dutyInfo.hasStartedRide === true;

  return (
    <>
      <div className="native-onduty-card">
        {/* Header Status Row */}
        <div className="native-onduty-card-header" onClick={handleNavigateToOnDuty} style={{ cursor: "pointer" }}>
          <div className="native-onduty-title-group">
            <IonIcon icon={navigateOutline} className="native-onduty-title-icon" />
            <span className="native-onduty-title-text">Today's On-Duty</span>
          </div>

          {/* Dynamic Approval Status Badge */}
          <div
            className={`approval-badge ${
              isApproved ? "approved" : isRejected ? "rejected" : "pending"
            }`}
          >
            <span className="native-pulse-dot"></span>
            {isApproved
              ? hasStartedRide
                ? "✅ APPROVED • 🚗 RIDE ACTIVE"
                : "✅ APPROVED"
              : isRejected
              ? "❌ REJECTED"
              : `⏳ ${dutyInfo.approvalBadgeText}`}
          </div>
        </div>

        {/* Card Body - Duty Details */}
        <div className="native-onduty-body">
          <div className="native-duty-details" onClick={handleNavigateToOnDuty} style={{ cursor: "pointer" }}>
            <IonIcon icon={locationOutline} className="native-duty-location-icon" />
            <div className="native-duty-text-content">
              <h4>{dutyInfo.college || "On-Duty Field Assignment"}</h4>
              <p>{dutyInfo.description || dutyInfo.location || "Active On-Duty Visit"}</p>
              
              {/* Transport & Vehicle Info Badge */}
              {(dutyInfo.transportMode || dutyInfo.vehicleNo) && (
                <div className="native-transport-chip">
                  <IonIcon icon={carOutline} />
                  <span>
                    {dutyInfo.transportMode}
                    {dutyInfo.vehicleNo ? ` • ${dutyInfo.vehicleNo}` : ""}
                  </span>
                </div>
              )}

              {/* Ride Reading Summary if Started */}
              {hasStartedRide && (
                <div className="native-reading-chip">
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
                  : `⚠️ Awaiting Approval from ${dutyInfo.pendingRA || "RA"}`}
              </span>
            </div>
            <p className="instruction-subtext">
              {isApproved
                ? hasStartedRide
                  ? "Ride is in progress. Real-time GPS tracking is active. Tap below to manage trip logs & readings."
                  : "All approvals received. Tap below to open On Duty Manager and log vehicle meter readings or duty days."
                : isRejected
                ? "This On-Duty request was rejected. You cannot start ride tracking. Please contact your Reporting Authority."
                : `Current Status: ${dutyInfo.approvalBadgeText}. Ride logging will unlock once all Reporting Authorities approve.`}
            </p>
          </div>

          {/* Realtime Metrics Grid (Shown when Approved / Active) */}
          {isApproved && (
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
                  {isPermissionIssue ? "⚠️ Required" : broadcaster.isTracking ? "Active" : "Ready"}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="native-onduty-actions">
            <button
              className="native-btn-onduty-primary"
              onClick={handleNavigateToOnDuty}
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
              <button className="native-btn-ping" onClick={handleManualPing} disabled={isPinging} title="Ping GPS Location">
                <IonIcon
                  icon={refreshOutline}
                  style={{ animation: isPinging ? "spin 1s linear infinite" : "none" }}
                />
                {isPinging ? "Pinging..." : "Ping GPS"}
              </button>
            )}

            {isPermissionIssue && (
              <button className="native-btn-warning" onClick={() => setShowPermissionModal(true)}>
                <IonIcon icon={warningOutline} />
                Fix GPS
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
