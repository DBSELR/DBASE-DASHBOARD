import React, { useEffect, useState, useRef } from "react";
import { useHistory } from "react-router-dom";
import { IonModal, IonIcon } from "@ionic/react";
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
  speedometerOutline,
  closeOutline,
  radioOutline,
  timeOutline,
  moveOutline
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);

  // Floating Bar position & dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingVisual, setIsDraggingVisual] = useState(false);

  const openTimeRef = useRef<number>(0);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    isDragging: boolean;
    moved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    isDragging: false,
    moved: false,
  });
  const floatingBarRef = useRef<HTMLDivElement>(null);

  const isPermissionIssue =
    broadcaster.permissionState === "denied" || broadcaster.permissionState === "prompt";

  const openModal = () => {
    openTimeRef.current = Date.now();
    setIsModalOpen(true);
  };

  const handleDismissModal = () => {
    // Prevent ghost click immediately dismissing the modal upon opening on touch screens
    if (Date.now() - openTimeRef.current < 350) {
      return;
    }
    setIsModalOpen(false);
  };

  // Set initial floating bar position (docked lower-right with safe margins)
  useEffect(() => {
    const initPos = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      if (screenWidth <= 600) {
        const barWidth = 230;
        const defaultX = Math.max(12, screenWidth - barWidth - 16);
        const defaultY = Math.max(80, screenHeight - 145);
        setPosition({ x: defaultX, y: defaultY });
      } else {
        const defaultX = Math.max(20, screenWidth - 340);
        const defaultY = Math.max(90, screenHeight - 160);
        setPosition({ x: defaultX, y: defaultY });
      }
    };

    initPos();
    window.addEventListener("resize", initPos);
    return () => window.removeEventListener("resize", initPos);
  }, []);

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

  // --- Dedicated Touch Drag Handlers (Mobile) ---
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const curX = position?.x ?? 16;
    const curY = position?.y ?? 100;

    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: curX,
      initialY: curY,
      isDragging: true,
      moved: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragStartRef.current.isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartRef.current.startX;
    const deltaY = touch.clientY - dragStartRef.current.startY;
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > 8) {
      if (!dragStartRef.current.moved) {
        dragStartRef.current.moved = true;
        setIsDraggingVisual(true);
      }

      const barEl = floatingBarRef.current;
      const rect = barEl?.getBoundingClientRect();
      const barWidth = rect?.width || 220;
      const barHeight = rect?.height || 50;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const minX = 8;
      const maxX = Math.max(minX, screenWidth - barWidth - 8);
      const minY = 50;
      const maxY = Math.max(minY, screenHeight - barHeight - 65);

      let nextX = dragStartRef.current.initialX + deltaX;
      let nextY = dragStartRef.current.initialY + deltaY;

      nextX = Math.min(Math.max(nextX, minX), maxX);
      nextY = Math.min(Math.max(nextY, minY), maxY);

      setPosition({ x: nextX, y: nextY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragStartRef.current.isDragging) return;
    const wasMoved = dragStartRef.current.moved;
    dragStartRef.current.isDragging = false;
    setIsDraggingVisual(false);

    if (!wasMoved) {
      if (e.cancelable) {
        e.preventDefault(); // Prevents delayed ghost click on mobile backdrop
      }
      openModal();
    }
  };

  // --- Dedicated Mouse Drag Handlers (Desktop) ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const curX = position?.x ?? 16;
    const curY = position?.y ?? 100;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: curX,
      initialY: curY,
      isDragging: true,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStartRef.current.isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > 8) {
      if (!dragStartRef.current.moved) {
        dragStartRef.current.moved = true;
        setIsDraggingVisual(true);
      }

      const barEl = floatingBarRef.current;
      const rect = barEl?.getBoundingClientRect();
      const barWidth = rect?.width || 220;
      const barHeight = rect?.height || 50;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const minX = 8;
      const maxX = Math.max(minX, screenWidth - barWidth - 8);
      const minY = 50;
      const maxY = Math.max(minY, screenHeight - barHeight - 65);

      let nextX = dragStartRef.current.initialX + deltaX;
      let nextY = dragStartRef.current.initialY + deltaY;

      nextX = Math.min(Math.max(nextX, minX), maxX);
      nextY = Math.min(Math.max(nextY, minY), maxY);

      setPosition({ x: nextX, y: nextY });
    }
  };

  const handleMouseUp = () => {
    if (!dragStartRef.current.isDragging) return;
    const wasMoved = dragStartRef.current.moved;
    dragStartRef.current.isDragging = false;
    setIsDraggingVisual(false);

    if (!wasMoved) {
      openModal();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragStartRef.current.moved) {
      e.stopPropagation();
      return;
    }
    openModal();
  };

  const handleManualPing = async () => {
    setIsPinging(true);
    setPingSuccess(false);
    try {
      await broadcaster.triggerImmediatePing();
      setPingSuccess(true);
      setTimeout(() => setPingSuccess(false), 3000);
    } catch (e) {
      console.warn("Ping failed", e);
    } finally {
      setTimeout(() => setIsPinging(false), 1000);
    }
  };

  const handleNavigateToOnDuty = () => {
    setIsModalOpen(false);
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
      {/* ============================================================ */}
      {/* 1. MOVABLE FLOATING STATUS BAR (DRAGGABLE & TAP-FRIENDLY)   */}
      {/* ============================================================ */}
      <div
        ref={floatingBarRef}
        className={`onduty-floating-bar ${
          isApproved ? "status-approved" : isRejected ? "status-rejected" : "status-pending"
        } ${isDraggingVisual ? "dragging" : ""}`}
        style={{
          transform: position ? `translate3d(${position.x}px, ${position.y}px, 0)` : "none",
          left: 0,
          top: 0,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="View Today's On-Duty Status"
        title="Drag to move anywhere, tap to view details"
      >
        {/* Left Indicator & Icon */}
        <div className="floating-bar-left">
          <div className="floating-status-icon-wrapper">
            <span className="floating-status-pulse-ring"></span>
            <span className="floating-status-dot"></span>
            <IonIcon
              icon={hasStartedRide ? carOutline : isApproved ? navigateOutline : radioOutline}
              className="floating-car-icon"
            />
          </div>

          <div className="floating-bar-info">
            <div className="floating-bar-title-row">
              <span className="floating-bar-title">On-Duty</span>
              <span className="floating-mini-status-badge">
                {isApproved
                  ? hasStartedRide
                    ? "RIDE ACTIVE"
                    : "APPROVED"
                  : isRejected
                  ? "REJECTED"
                  : "PENDING"}
              </span>
            </div>

            <div className="floating-bar-subtext">
              {isApproved ? (
                <span className="floating-speed-sub">
                  <span className="speed-highlight">⚡ {broadcaster.currentSpeedKmh.toFixed(1)} km/h</span>
                  {dutyInfo.vehicleNo ? ` • ${dutyInfo.vehicleNo}` : ""}
                </span>
              ) : (
                <span className="floating-desc-sub">
                  {dutyInfo.college || "Field Duty"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions & Drag Handle */}
        <div className="floating-bar-right">
          <div className="floating-pill-view-btn" title="Tap to expand details">
            <span>Details</span>
            <IonIcon icon={arrowForwardOutline} className="floating-view-arrow" />
          </div>

          <div className="floating-drag-handle" title="Hold and drag to move">
            <IonIcon icon={moveOutline} />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. ON-DUTY DETAILS MODAL (IONIC MODAL NATIVE OVERLAY)       */}
      {/* ============================================================ */}
      <IonModal
        isOpen={isModalOpen}
        onDidDismiss={handleDismissModal}
        backdropDismiss={true}
        className="onduty-detail-modal"
      >
        <div className="onduty-modal-container">
          {/* Mobile Sheet Pull Bar */}
          <div className="onduty-sheet-pull-bar"></div>

          {/* Modal Header */}
          <div className="onduty-modal-header">
            <div className="onduty-modal-header-left">
              <div
                className={`onduty-modal-badge-icon ${
                  isApproved
                    ? hasStartedRide
                      ? "badge-ride-active"
                      : "badge-approved"
                    : isRejected
                    ? "badge-rejected"
                    : "badge-pending"
                }`}
              >
                <IonIcon
                  icon={hasStartedRide ? carOutline : isApproved ? navigateOutline : radioOutline}
                />
              </div>
              <div>
                <h3 className="onduty-modal-title">Today's On-Duty</h3>
                <p className="onduty-modal-subtitle">Field Duty Assignment & Telemetry</p>
              </div>
            </div>

            <div className="onduty-modal-header-right">
              {/* Dynamic Status Badge */}
              <div
                className={`modal-approval-badge ${
                  isApproved ? "approved" : isRejected ? "rejected" : "pending"
                }`}
              >
                <span className="badge-pulse-dot"></span>
                {isApproved
                  ? hasStartedRide
                    ? "✅ APPROVED • 🚗 RIDE ACTIVE"
                    : "✅ APPROVED"
                  : isRejected
                  ? "❌ REJECTED"
                  : `⏳ ${dutyInfo.approvalBadgeText}`}
              </div>

              <button
                className="onduty-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close dialog"
                title="Close"
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="onduty-modal-body">
            {/* Duty Location & Purpose Details Card */}
            <div className="onduty-info-card">
              <div className="onduty-info-card-header">
                <IonIcon icon={locationOutline} className="onduty-location-icon" />
                <div className="onduty-info-titles">
                  <h4 className="onduty-college-name">{dutyInfo.college || "Field Duty Assignment"}</h4>
                  <p className="onduty-duty-desc">{dutyInfo.description || dutyInfo.location || "Active On-Duty Visit"}</p>
                </div>
              </div>

              {/* Transport Mode & Vehicle Number Chip */}
              {(dutyInfo.transportMode || dutyInfo.vehicleNo) && (
                <div className="onduty-transport-chip">
                  <IonIcon icon={carOutline} />
                  <span>
                    {dutyInfo.transportMode || "Vehicle"}
                    {dutyInfo.vehicleNo ? ` • ${dutyInfo.vehicleNo}` : ""}
                  </span>
                </div>
              )}

              {/* Ride Meter Readings if Active */}
              {hasStartedRide && (
                <div className="onduty-meter-chip">
                  <IonIcon icon={speedometerOutline} />
                  <span>
                    Meter: <strong>{dutyInfo.latestReadingFrom || "0"}</strong>
                    {dutyInfo.latestReadingTo ? ` → ${dutyInfo.latestReadingTo}` : ""}
                    {dutyInfo.latestDistance ? ` (${dutyInfo.latestDistance} KMs)` : ""}
                    {dutyInfo.latestFuel ? ` • Fuel: ₹${dutyInfo.latestFuel}` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Status Instruction Banner */}
            <div
              className={`onduty-instruction-banner ${
                isApproved ? "banner-approved" : isRejected ? "banner-rejected" : "banner-pending"
              }`}
            >
              <div className="instruction-header-row">
                <IonIcon
                  icon={
                    isApproved
                      ? checkmarkCircleOutline
                      : isRejected
                      ? alertCircleOutline
                      : timeOutline
                  }
                  className="instruction-status-icon"
                />
                <span className="instruction-main-heading">
                  {isApproved
                    ? hasStartedRide
                      ? "🚗 Active On-Duty Journey"
                      : "✅ Duty Request Approved!"
                    : isRejected
                    ? "❌ Duty Request Rejected by RA"
                    : `⏳ Awaiting Approval from ${dutyInfo.pendingRA || "RA"}`}
                </span>
              </div>
              <p className="instruction-body-text">
                {isApproved
                  ? hasStartedRide
                    ? "Ride is in progress. Real-time GPS tracking is active. Tap below to manage trip logs & readings."
                    : "All approvals received. Tap below to open On Duty Manager and log vehicle meter readings or duty days."
                  : isRejected
                    ? "This On-Duty request was rejected. You cannot start ride tracking. Please contact your Reporting Authority."
                    : `Current Status: ${dutyInfo.approvalBadgeText}. Ride logging will unlock once all Reporting Authorities approve.`}
              </p>
            </div>

            {/* Real-time Telemetry Stats (Speed, Last Ping, GPS State) */}
            {isApproved && (
              <div className="onduty-telemetry-grid">
                {/* Speed Box */}
                <div className="telemetry-box speed-box">
                  <div className="telemetry-label">
                    <span className="telemetry-emoji">⚡</span> Speed
                  </div>
                  <div className="telemetry-value">
                    <span className="speed-number">{broadcaster.currentSpeedKmh.toFixed(1)}</span>
                    <span className="speed-unit">km/h</span>
                  </div>
                </div>

                {/* Last Ping Box */}
                <div className="telemetry-box ping-box">
                  <div className="telemetry-label">
                    <span className="telemetry-emoji">⏱️</span> Last Ping
                  </div>
                  <div className="telemetry-value">
                    <span className="ping-time-text">
                      {broadcaster.lastPingTime
                        ? broadcaster.lastPingTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "Connecting..."}
                    </span>
                  </div>
                </div>

                {/* GPS State Box */}
                <div className="telemetry-box gps-box">
                  <div className="telemetry-label">
                    <span className="telemetry-emoji">🟢</span> GPS State
                  </div>
                  <div className="telemetry-value">
                    <span
                      className={`gps-state-pill ${
                        isPermissionIssue
                          ? "gps-required"
                          : broadcaster.isTracking
                          ? "gps-active"
                          : "gps-ready"
                      }`}
                    >
                      {isPermissionIssue
                        ? "Required"
                        : broadcaster.isTracking
                        ? "Active"
                        : "Ready"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Ping notification message */}
            {pingSuccess && (
              <div className="ping-feedback-msg">
                <IonIcon icon={checkmarkCircleOutline} />
                <span>GPS location synced successfully!</span>
              </div>
            )}
          </div>

          {/* Modal Actions Footer */}
          <div className="onduty-modal-footer">
            <button
              className="onduty-primary-action-btn"
              onClick={handleNavigateToOnDuty}
            >
              <IonIcon
                icon={
                  hasStartedRide
                    ? carOutline
                    : isApproved
                    ? checkmarkCircleOutline
                    : lockClosedOutline
                }
              />
              <span>
                {hasStartedRide
                  ? "Manage Duty & Logs"
                  : isApproved
                  ? "Open On-Duty Manager"
                  : "View in On-Duty Manager"}
              </span>
              <IonIcon icon={arrowForwardOutline} className="btn-arrow-icon" />
            </button>

            {isApproved && broadcaster.isTracking && (
              <button
                className="onduty-secondary-ping-btn"
                onClick={handleManualPing}
                disabled={isPinging}
                title="Force GPS Sync"
              >
                <IonIcon
                  icon={refreshOutline}
                  className={isPinging ? "spinning" : ""}
                />
                <span>{isPinging ? "Pinging..." : "Ping GPS"}</span>
              </button>
            )}

            {isPermissionIssue && (
              <button
                className="onduty-fix-gps-btn"
                onClick={() => setShowPermissionModal(true)}
              >
                <IonIcon icon={warningOutline} />
                <span>Fix GPS</span>
              </button>
            )}
          </div>
        </div>
      </IonModal>

      {/* Location Permission Modal if needed */}
      <LocationPermissionModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onPermissionGranted={() => broadcaster.triggerImmediatePing()}
      />
    </>
  );
};

export default OnDutyEmployeeStatusCard;
