import React, { useState } from "react";
import { IonIcon } from "@ionic/react";
import { locationOutline, alertCircleOutline, pulseOutline, warningOutline } from "ionicons/icons";
import LocationPermissionModal from "./LocationPermissionModal";
import "./LocationStatusBanner.css";

interface Props {
  isTracking: boolean;
  movementStatus?: string;
  lastPingTime?: Date | null;
  permissionState?: string;
}

export const LocationStatusBanner: React.FC<Props> = ({
  isTracking,
  movementStatus = "Idle",
  lastPingTime,
  permissionState = "granted",
}) => {
  const [showModal, setShowModal] = useState(false);

  const isPermissionIssue = permissionState === "denied" || permissionState === "prompt";

  return (
    <>
      <div className={`location-status-banner ${isTracking ? "active" : "inactive"}`}>
        <div className="banner-content" onClick={() => isPermissionIssue && setShowModal(true)}>
          <div className="banner-left">
            <span className={`status-indicator-dot ${isTracking ? movementStatus.toLowerCase() : "off"}`}></span>
            <div className="banner-text">
              <span className="banner-title">
                {isTracking
                  ? `🟢 Field GPS Active (${movementStatus})`
                  : isPermissionIssue
                  ? "⚠️ Location Permission Required"
                  : "🟡 Location Service Standby"}
              </span>
              <span className="banner-subtitle">
                {isTracking && lastPingTime
                  ? `Last ping: ${lastPingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : isPermissionIssue
                  ? "Tap here to enable location tracking for field duty"
                  : "Connecting live GPS stream..."}
              </span>
            </div>
          </div>

          {isPermissionIssue && (
            <button className="banner-action-chip" onClick={() => setShowModal(true)}>
              Enable GPS
            </button>
          )}
        </div>
      </div>

      <LocationPermissionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

export default LocationStatusBanner;
