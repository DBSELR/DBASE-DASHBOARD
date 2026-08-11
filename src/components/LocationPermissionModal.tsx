import React, { useEffect, useState } from "react";
import { IonModal, IonButton, IonIcon, IonSpinner } from "@ionic/react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { BackgroundGeolocation } from "../TrackingEngine/Core/BackgroundPlugin";
import { locationOutline, shieldCheckmarkOutline, settingsOutline, alertCircleOutline, batteryChargingOutline } from "ionicons/icons";
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
      // 1. On Web Browser (development / desktop): request standard browser geolocation
      if (!Capacitor.isNativePlatform()) {
        const res = await Geolocation.requestPermissions();
        setPermissionState(res.location);
        if (res.location === "granted") {
          if (onPermissionGranted) onPermissionGranted();
          onClose();
        }
        return;
      }

      // 2. On Native Mobile App (Android/iOS):
      const res = await Geolocation.requestPermissions();
      setPermissionState(res.location);
      
      if (res.location === "granted") {
        try {
          // Attempt to request background location watcher permission
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
          // Clean up watcher immediately (it was only to prompt permission)
          await BackgroundGeolocation.removeWatcher({ id: watcherId });
          
          if (onPermissionGranted) onPermissionGranted();
          onClose();
        } catch (bgErr) {
          console.warn("[LocationModal] Background location permission check failed:", bgErr);
          // If background permission is still missing or denied, open system settings for user
          await BackgroundGeolocation.openSettings();
        }
      } else {
        // If foreground location was denied by user, open app settings directly
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

        <h3 className="location-modal-title">Location Tracking Disclosure</h3>

        <p className="location-modal-desc">
          DBase Office collects your location to enable field attendance and work-location tracking for authorized marketing activities. Your location may be collected in the background while field tracking is active, including when the app is closed or not in use. This information is used by your organization to verify field presence and work-related activities.
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
          <div className="step-item">
            <IonIcon icon={batteryChargingOutline} className="step-icon" />
            <div>
              <strong>Unrestricted Battery</strong>
              <p>Set app battery usage to 'Unrestricted' for continuous background sync.</p>
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
