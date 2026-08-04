import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { Geolocation } from "@capacitor/geolocation";

const authHeaders = () => {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("Token") ||
    sessionStorage.getItem("token") ||
    "";
  const token = raw.replace(/^"|"$/g, "");
  return token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : {};
};

interface LocationPoint {
  sessionId?: number | null;
  empCode?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  batteryLevel: number | null;
  isCharging: boolean;
  powerSaveMode: boolean;
  devicePlatform: string;
  movementStatus: string;
  recordedAt: string;
}

const OFFLINE_QUEUE_KEY = "tracking_offline_gps_queue";

// Calculate distance between two coordinates in meters (Haversine formula)
const getDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const useLocationBroadcaster = () => {
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [movementStatus, setMovementStatus] = useState<string>("Idle");
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);

  const lastPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const idleStartTimeRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);

  // Helper to send queue
  const flushOfflineQueue = async () => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return;
      const queue: LocationPoint[] = JSON.parse(raw);
      if (queue.length === 0) return;

      await axios.post(
        `${API_BASE}Tracking/batch-sync-locations`,
        queue,
        { headers: authHeaders() }
      );

      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      console.log(`[TrackingBroadcaster] Flushed ${queue.length} offline GPS points.`);
    } catch (err) {
      console.warn("[TrackingBroadcaster] Offline queue flush failed:", err);
    }
  };

  // Battery helper
  const getBatteryInfo = async () => {
    let batteryLevel: number | null = null;
    let isCharging = false;

    if ("getBattery" in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        batteryLevel = Math.round(battery.level * 100);
        isCharging = battery.charging;
      } catch {
        // Battery API unavailable
      }
    }
    return { batteryLevel, isCharging };
  };

  // Single Ping Sender
  const sendPing = async (lat: number, lng: number, speed: number, heading: number, accuracy: number) => {
    const now = Date.now();
    let status = "Idle";
    let dist = 0;

    if (lastPosRef.current) {
      dist = getDistanceMeters(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng);
      const timeDiffSec = (now - lastPosRef.current.time) / 1000;
      const calcSpeedKmh = timeDiffSec > 0 ? (dist / timeDiffSec) * 3.6 : 0;
      const effectiveSpeed = Math.max(speed, calcSpeedKmh);

      if (dist >= 5 || effectiveSpeed >= 1.0) {
        status = "Moving";
        idleStartTimeRef.current = null;
      } else {
        if (!idleStartTimeRef.current) idleStartTimeRef.current = now;
        status = "Idle";
      }
    } else {
      idleStartTimeRef.current = now;
    }

    lastPosRef.current = { lat, lng, time: now };
    setMovementStatus(status);

    const rawUser = localStorage.getItem("user");
    let empCode = "";
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        empCode = u.empCode || u.EmpCode || u.username || "";
      } catch {}
    }

    const battery = await getBatteryInfo();
    const payload: LocationPoint = {
      sessionId: sessionId,
      empCode: empCode,
      latitude: lat,
      longitude: lng,
      speed: Math.round(speed * 10) / 10,
      heading: Math.round(heading),
      accuracy: Math.round(accuracy),
      batteryLevel: battery.batteryLevel,
      isCharging: battery.isCharging,
      powerSaveMode: false,
      devicePlatform: "web",
      movementStatus: status,
      recordedAt: new Date().toISOString(),
    };

    if (navigator.onLine) {
      try {
        await axios.post(`${API_BASE}Tracking/sync-location`, payload, {
          headers: authHeaders(),
        });
        setLastPingTime(new Date());
        // Also flush any pending offline points
        flushOfflineQueue();
      } catch (err) {
        console.warn("[TrackingBroadcaster] Live ping failed, queueing offline:", err);
        queueOffline(payload);
      }
    } else {
      queueOffline(payload);
    }
  };

  const queueOffline = (point: LocationPoint) => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: LocationPoint[] = raw ? JSON.parse(raw) : [];
      queue.push(point);
      // Cap at 100 points
      if (queue.length > 100) queue.shift();
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error("[TrackingBroadcaster] Queue write error:", e);
    }
  };

  // Main Effect: Check active session & start broadcaster
  useEffect(() => {
    let isMounted = true;

    const checkAndStart = async () => {
      try {
        const rawUser = localStorage.getItem("user");
        let empCode = "";
        if (rawUser) {
          try {
            const u = JSON.parse(rawUser);
            empCode = u.empCode || u.EmpCode || u.username || "";
          } catch {}
        }

        const res = await axios.post(
          `${API_BASE}Tracking/auto-start-session`,
          { sessionType: "OnDuty", empCode },
          { headers: authHeaders() }
        );

        if (isMounted && res.data && res.data.active) {
          setSessionId(res.data.sessionId);
          setIsTracking(true);
          console.log("[TrackingBroadcaster] Active On-Duty session detected:", res.data.sessionId);

          // Prompt Native Location Permission on APK startup
          try {
            const status = await Geolocation.checkPermissions();
            if (status.location !== "granted") {
              await Geolocation.requestPermissions();
            }
          } catch (pe) {
            console.warn("[TrackingBroadcaster] Permission prompt error:", pe);
          }
        } else if (isMounted) {
          setIsTracking(false);
          setSessionId(null);
        }
      } catch (err) {
        console.warn("[TrackingBroadcaster] Auto-session check error:", err);
      }
    };

    checkAndStart();
    const checkInterval = setInterval(checkAndStart, 60000); // Re-check session status every 1 min

    return () => {
      isMounted = false;
      clearInterval(checkInterval);
    };
  }, []);

  // GPS Watcher & Adaptive Interval
  useEffect(() => {
    if (!isTracking) return;

    // Use Capacitor Geolocation if native, else HTML5
    const obtainPosition = async () => {
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== "granted") {
          await Geolocation.requestPermissions();
        }

        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });

        if (pos && pos.coords) {
          sendPing(
            pos.coords.latitude,
            pos.coords.longitude,
            (pos.coords.speed || 0) * 3.6,
            pos.coords.heading || 0,
            pos.coords.accuracy || 0
          );
        }
      } catch (err) {
        // Fallback to HTML5 Geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              sendPing(
                p.coords.latitude,
                p.coords.longitude,
                (p.coords.speed || 0) * 3.6,
                p.coords.heading || 0,
                p.coords.accuracy || 0
              );
            },
            (e) => console.warn("[TrackingBroadcaster] Geolocation error:", e),
            { enableHighAccuracy: true }
          );
        }
      }
    };

    // First ping immediately
    obtainPosition();

    // Adaptive sampling interval timer
    const intervalMs = movementStatus === "Moving" ? 10000 : 30000;
    timerRef.current = setInterval(obtainPosition, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, movementStatus, sessionId]);

  return {
    isTracking,
    sessionId,
    movementStatus,
    lastPingTime,
  };
};
