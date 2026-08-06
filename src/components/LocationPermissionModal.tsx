import React, { useEffect, useState } from "react";
import { IonModal, IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { Geolocation } from "@capacitor/geolocation";
import { BackgroundGeolocation } from "../TrackingEngine/Core/BackgroundPlugin";
import { locationOutline, shieldCheckmarkOutline, settingsOutline, alertCircleOutline } from "ionicons/icons";
import "./LocationPermissionModal.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted?: () => void;
}

export const LocationPermissionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onPermissionGranted,
}) => {
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<string>("unknown");

  const checkStatus = async () => {
    try {
      const status = await Geolocation.checkPermissions();
      setPermissionState(status.location);
      if (status.location === "granted" && onPermissionGranted) {
        onPermissionGranted();
      }
    } catch (e) {
      console.warn("[LocationModal] Check permission error:", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();

      const handleFocus = () => {
        checkStatus();
      };

      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleFocus);

      return () => {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleFocus);
      };
    }
  }, [isOpen]);

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      // 1. Request foreground permission first
      const res = await Geolocation.requestPermissions();
      setPermissionState(res.location);
      
      if (res.location === "granted") {
        // On native platforms, attempt to request background location via plugin
        try {
          // Using imported BackgroundGeolocation instance

          const watcherId = await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: "Your coordinates are synced with management while on-duty.",
              backgroundTitle: "Field Location Tracking Active",
              requestPermissions: true,
              stale: true,
              distanceFilter: 20,
            },
            () => {}
          );
          // Clean up the temporary watcher immediately
          await BackgroundGeolocation.removeWatcher({ id: watcherId });
          
          if (onPermissionGranted) onPermissionGranted();
          onClose();
        } catch (bgErr) {
          console.warn("[LocationModal] Background location permission check failed:", bgErr);
          // If background permission is not granted, guide the user to system settings
          if (window.confirm("To enable background tracking even when the app is minimized or locked, please select 'Allow All The Time' in the app settings. Open settings now?")) {
            // Using imported BackgroundGeolocation instance
            await BackgroundGeolocation.openSettings();
          }
        }
      } else if (res.location === "denied") {
        // If foreground is denied, directly prompt to open settings
        // Using imported BackgroundGeolocation instance
        await BackgroundGeolocation.openSettings();
      }
    } catch (err) {
      console.error("[LocationModal] Request permission error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="location-permission-modal">
      <div className="location-modal-container">
        <div className="location-modal-icon-header">
          <div className="pulse-icon-ring">
            <IonIcon icon={locationOutline} className="loc-main-icon" />
          </div>
        </div>

        <h3 className="location-modal-title">Enable Live Field Location</h3>

        <p className="location-modal-desc">
          To display your duty status, log movement trails, and sync field locations with management, please grant location access.
        </p>

        <div className="location-modal-steps">
          <div className="step-item">
            <IonIcon icon={shieldCheckmarkOutline} className="step-icon" />
            <div>
              <strong>High Precision GPS</strong>
              <p>Accurate location pings during field duties and client visits.</p>
            </div>
          </div>
          <div className="step-item">
            <IonIcon icon={settingsOutline} className="step-icon" />
            <div>
              <strong>Allow All The Time</strong>
              <p>For background tracking while on duty even when app is minimized.</p>
            </div>
          </div>
        </div>

        {permissionState === "denied" && (
          <div className="location-warning-box">
            <IonIcon icon={alertCircleOutline} />
            <span>Location permission is blocked. Please allow location access in your device settings.</span>
          </div>
        )}

        <div className="location-modal-actions">
          <button
            className="grant-btn"
            onClick={handleRequestPermission}
            disabled={loading}
          >
            {loading ? (
              <IonSpinner name="crescent" color="light" />
            ) : (
              "Enable Location Access"
            )}
          </button>

          <button className="cancel-btn" onClick={onClose}>
            I'll do this later
          </button>
        </div>
      </div>
    </IonModal>
  );
};

export default LocationPermissionModal;
