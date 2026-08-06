import { useEffect, useState, useCallback } from "react";
import { TrackingEngine, PermissionService, HealthService } from "../TrackingEngine";

export const useLocationBroadcaster = () => {
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [movementStatus, setMovementStatus] = useState<string>("Idle");
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [permissionState, setPermissionState] = useState<string>("unknown");
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);

  // Get current logged-in employee code
  const getEmpCode = (): string => {
    try {
      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        const user = JSON.parse(userRaw);
        return user.EmpCode || user.empCode || user.username || "";
      }
    } catch {}
    return "";
  };

  const empCode = getEmpCode();

  // Initialize and restore session on mount
  useEffect(() => {
    const init = async () => {
      if (!empCode) return;

      await TrackingEngine.initialize(empCode);
      const gpsState = await PermissionService.checkGPSPermissions();
      setPermissionState(gpsState);

      // Auto-send initial heartbeat so backend instantly registers device health & online status
      HealthService.sendHeartbeat(empCode).catch(() => {});

      if (gpsState === "granted") {
        const started = await TrackingEngine.start(empCode);
        setIsTracking(started);
      } else {
        setIsTracking(TrackingEngine.isActive());
      }

      setSessionId(TrackingEngine.getSessionId());
    };
    init();

    // Poll indicators to refresh UI cards
    const interval = setInterval(async () => {
      setIsTracking(TrackingEngine.isActive());
      setSessionId(TrackingEngine.getSessionId());
    }, 2000);

    return () => clearInterval(interval);
  }, [empCode]);

  const requestLocationPermission = async () => {
    const state = await PermissionService.requestGPSPermissions();
    setPermissionState(state);
    return state;
  };

  const triggerImmediatePing = useCallback(async () => {
    if (TrackingEngine.isActive()) {
      await TrackingEngine.syncSinglePosition();
      setLastPingTime(new Date());
    }
  }, []);

  // Sync isTracking toggle with core engine
  useEffect(() => {
    const handleToggle = async () => {
      if (isTracking && !TrackingEngine.isActive()) {
        const success = await TrackingEngine.start(empCode);
        if (!success) setIsTracking(false);
      } else if (!isTracking && TrackingEngine.isActive()) {
        await TrackingEngine.stop();
      }
      setSessionId(TrackingEngine.getSessionId());
    };
    handleToggle();
  }, [isTracking, empCode]);

  return {
    isTracking,
    setIsTracking,
    sessionId,
    movementStatus,
    lastPingTime,
    permissionState,
    currentSpeedKmh,
    requestLocationPermission,
    triggerImmediatePing,
  };
};
