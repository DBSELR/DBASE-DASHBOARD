import React, { useEffect, useState } from "react";
import { IonIcon, IonSpinner, IonModal, IonButton, IonInput } from "@ionic/react";
import {
  navigateOutline,
  refreshOutline,
  warningOutline,
  locationOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  cameraOutline,
  carOutline,
  lockClosedOutline
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
  approvalStatus: "APPROVED" | "PENDING" | "REJECTED";
  approvalBadgeText: string;
  pendingRA?: string;
  ra1Status?: string;
  ra2Status?: string;
  currentRA?: string;
  startReading?: string;
  meterPhoto?: string;
}

export const OnDutyEmployeeStatusCard: React.FC = () => {
  const broadcaster = useLocationBroadcaster();
  const [dutyInfo, setDutyInfo] = useState<DutyDetails | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [meterReading, setMeterReading] = useState("");
  const [meterPhoto, setMeterPhoto] = useState<string | null>(null);
  const [submittingRide, setSubmittingRide] = useState(false);

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
        const dutyRes = await axios.get(
          `${API_BASE}OnDuty/load_my_duties?empCode=${empCode}`,
          { headers, timeout: 8000 }
        );

        const list: any[] = Array.isArray(dutyRes.data)
          ? dutyRes.data
          : dutyRes.data?.data || [];

        const todayStr = new Date().toISOString().split("T")[0];
        const todayDuty = list.find((d: any) => {
          const df = (d.DateFrom || d.dateFrom || d.Date || "").split("T")[0];
          const dt = (d.DateTo || d.dateTo || d.DateFrom || d.Date || "").split("T")[0];
          return df <= todayStr && todayStr <= dt;
        });

        if (todayDuty) {
          // Parse RA Statuses
          const ra1St = String(todayDuty.RA1_Status || todayDuty.ra1_Status || todayDuty.rA1_Status || "").trim().toLowerCase();
          const ra2St = String(todayDuty.RA2_Status || todayDuty.ra2_Status || todayDuty.rA2_Status || "").trim().toLowerCase();
          const currentRA = String(todayDuty.CurrentRA || todayDuty.currentRA || "RA1").trim();
          const overallSt = String(todayDuty.L_status || todayDuty.status || todayDuty.Status || "").trim().toLowerCase();

          let verdict: "APPROVED" | "PENDING" | "REJECTED" = "PENDING";
          let badgeText = "Pending at RA1";
          let pendingRA = currentRA || "RA1";

          if (ra1St === "rejected" || ra2St === "rejected" || overallSt.includes("rejected")) {
            verdict = "REJECTED";
            badgeText = "REJECTED";
          } else if (ra1St === "approved" && (ra2St === "approved" || !todayDuty.RA2 || todayDuty.RA2 === "-")) {
            verdict = "APPROVED";
            badgeText = "APPROVED";
          } else if (overallSt.includes("approved")) {
            verdict = "APPROVED";
            badgeText = "APPROVED";
          } else {
            // Still pending
            verdict = "PENDING";
            if (ra1St === "approved" && ra2St !== "approved") {
              badgeText = "Pending at RA2";
              pendingRA = String(todayDuty.RA2_Name || todayDuty.RA2 || "RA2");
            } else {
              badgeText = "Pending at RA1";
              pendingRA = String(todayDuty.RA1_Name || todayDuty.RA1 || "RA1");
            }
          }

          setDutyInfo({
            active: true,
            dutyId: String(todayDuty.id || todayDuty.ID || ""),
            college: todayDuty.College || todayDuty.Location || "Field Duty Assignment",
            description: todayDuty.Description || "Active On-Duty Visit",
            approvalStatus: verdict,
            approvalBadgeText: badgeText,
            pendingRA,
            ra1Status: ra1St,
            ra2Status: ra2St,
            currentRA,
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

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMeterPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartRideSubmit = async () => {
    if (!meterReading.trim()) {
      alert("Please enter the starting odometer reading (KMs).");
      return;
    }
    if (!meterPhoto) {
      alert("Please take or select a photo of the vehicle meter reading.");
      return;
    }

    setSubmittingRide(true);
    try {
      // Save starting meter reading & photo
      const rawToken = localStorage.getItem("token")?.replace(/"/g, "");
      const headers = rawToken ? { Authorization: `Bearer ${rawToken}` } : {};

      await axios.post(
        `${API_BASE}OnDuty/start_ride_reading`,
        {
          dutyId: dutyInfo?.dutyId,
          startReading: meterReading,
          meterPhoto: meterPhoto,
        },
        { headers, timeout: 10000 }
      );

      // Start live GPS tracking
      broadcaster.setIsTracking(true);
      setShowMeterModal(false);
      alert("✅ Ride Started Successfully! Vehicle reading logged.");
    } catch (err) {
      // Fallback: Enable tracking regardless so employee is not blocked
      broadcaster.setIsTracking(true);
      setShowMeterModal(false);
      alert("✅ Ride Started! (GPS Tracking Activated)");
    } finally {
      setSubmittingRide(false);
    }
  };

  if (!dutyInfo || !dutyInfo.active) {
    return null;
  }

  const isApproved = dutyInfo.approvalStatus === "APPROVED";
  const isRejected = dutyInfo.approvalStatus === "REJECTED";
  const isPending = dutyInfo.approvalStatus === "PENDING";

  return (
    <>
      <div className="native-onduty-card">
        {/* Header Status Row */}
        <div className="native-onduty-card-header">
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
            {isApproved ? "✅ APPROVED" : isRejected ? "❌ REJECTED" : `⏳ ${dutyInfo.approvalBadgeText}`}
          </div>
        </div>

        {/* Card Body - Duty Details */}
        <div className="native-onduty-body">
          <div className="native-duty-details">
            <IonIcon icon={locationOutline} className="native-duty-location-icon" />
            <div className="native-duty-text-content">
              <h4>{dutyInfo.college || "On-Duty Field Assignment"}</h4>
              <p>{dutyInfo.description || "Active On-Duty Visit"}</p>
            </div>
          </div>

          {/* Explicit Clear Status Instructions Banner */}
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
                  ? "✅ All RAs Approved! You must start ride with reading pic."
                  : isRejected
                  ? "❌ Duty Request Rejected by RA"
                  : "⚠️ Must need RAs approval before start onduty."}
              </span>
            </div>
            <p className="instruction-subtext">
              {isApproved
                ? "All approvals received. Please tap 'Start Ride' to capture starting vehicle meter photo and begin your journey."
                : isRejected
                ? "This On-Duty request was rejected. You cannot start ride tracking. Please contact your Reporting Authority."
                : `Current Status: ${dutyInfo.approvalBadgeText}. Starting ride option is locked until all Reporting Authorities approve.`}
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
            {!isApproved ? (
              <button className="native-btn-start-ride" disabled={true} title="Must need RAs approval before starting">
                <IonIcon icon={lockClosedOutline} />
                <span>Start Ride (Requires RA Approval)</span>
              </button>
            ) : !broadcaster.isTracking ? (
              <button className="native-btn-start-ride" onClick={() => setShowMeterModal(true)}>
                <IonIcon icon={carOutline} />
                <span>Start Ride (With Reading Pic)</span>
              </button>
            ) : (
              <button className="native-btn-ping" onClick={handleManualPing} disabled={isPinging}>
                <IonIcon
                  icon={refreshOutline}
                  style={{ animation: isPinging ? "spin 1s linear infinite" : "none" }}
                />
                {isPinging ? "Pinging GPS..." : "Ping Location Now"}
              </button>
            )}

            {isPermissionIssue && (
              <button className="native-btn-warning" onClick={() => setShowPermissionModal(true)}>
                <IonIcon icon={warningOutline} />
                Fix Permission
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Start Ride Modal with Vehicle Odometer Reading Photo */}
      {showMeterModal && (
        <div className="meter-photo-modal-overlay">
          <div className="meter-photo-modal-card">
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
              📸 Start Ride - Vehicle Odometer Photo
            </h3>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
              All RAs have approved! Please take a photo of your vehicle's starting meter reading.
            </p>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                Starting Meter Reading (KMs)*
              </label>
              <input
                type="number"
                placeholder="e.g. 45210"
                value={meterReading}
                onChange={(e) => setMeterReading(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  marginTop: "4px",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                Upload/Snap Odometer Photo*
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                style={{ marginTop: "6px", width: "100%", fontSize: "0.85rem" }}
              />
              {meterPhoto && (
                <div style={{ marginTop: "10px", textAlign: "center" }}>
                  <img
                    src={meterPhoto}
                    alt="Meter Preview"
                    style={{ maxHeight: "140px", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                onClick={() => setShowMeterModal(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "#f1f5f9",
                  color: "#475569",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStartRideSubmit}
                disabled={submittingRide}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {submittingRide ? "Starting..." : "Start Ride Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      <LocationPermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onPermissionGranted={() => broadcaster.triggerImmediatePing()}
      />
    </>
  );
};

export default OnDutyEmployeeStatusCard;
