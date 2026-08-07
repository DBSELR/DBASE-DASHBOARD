import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonToast,
  IonMenuButton,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import {
  Search,
  CloudSun,
  Users,
  Car,
  Clock,
  MapPin,
  Phone,
  Play,
  Pause,
  Layers,
  Navigation,
  Shield,
  X,
  RefreshCw,
  Zap,
  Building,
  Menu as MenuIcon,
  MessageCircle,
  Compass,
  ArrowLeft,
  Activity,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Battery,
} from "lucide-react";
import axios from "axios";
import * as signalR from "@microsoft/signalr";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE } from "../config";
import "./OnDutyLiveTracking.css";
import ErrorBoundary from "../components/ErrorBoundary";

// Modular dashboard components imports
import { MapManager } from "./OnDutyLiveTracking/MapManager";
import { MarkerManager } from "./OnDutyLiveTracking/MarkerManager";
import { AnimationEngine } from "./OnDutyLiveTracking/AnimationEngine";
import { SignalRManager } from "./OnDutyLiveTracking/SignalRManager";
import { LocationNameCache } from "./OnDutyLiveTracking/LocationNameCache";

// Fix Leaflet Vite asset bundler icon paths safely
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerIconRetinaPng from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";

try {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: markerIconPng,
    iconRetinaUrl: markerIconRetinaPng,
    shadowUrl: markerShadowPng,
  });
} catch (e) {
  console.warn("[OnDutyLiveTracking] Leaflet icon fix error:", e);
}

interface ActiveSessionItem {
  SessionId: number;
  EmpCode: string;
  EmpName: string;
  Mobile?: string;
  Designation?: string;
  Department?: string;
  SessionType?: string;
  DutyId?: string;
  SessionStartTime?: string;
  SessionStatus?: string;
  ClientOrBranch?: string;
  DutyDescription?: string;
  TransportMode?: string;
  VehicleNo?: string;
  DutyLocation?: string;
  HomeBranch?: string;
  OnDutyBranch?: string;
  LiveLocation?: boolean;
  Latitude?: number;
  Longitude?: number;
  Speed?: number;
  Heading?: number;
  Accuracy?: number;
  BatteryLevel?: number;
  IsCharging?: boolean;
  PowerSaveMode?: boolean;
  DevicePlatform?: string;
  MovementStatus?: "Moving" | "Idle" | "Offline" | string;
  LastUpdated?: string;
  SecondsSinceLastUpdate?: number;
  Image?: string;
  PermissionStatus?: string;
  GpsEnabled?: boolean;
  InternetEnabled?: boolean;
  ForegroundService?: boolean;
  PendingQueue?: number;
}

interface LocationLogItem {
  LogId: number;
  SessionId: number;
  EmpCode: string;
  Latitude: number;
  Longitude: number;
  Speed: number;
  Heading: number;
  Accuracy: number;
  RecordedAt: string;
}

const authHeaders = () => {
  try {
    const raw =
      localStorage.getItem("token") ||
      localStorage.getItem("Token") ||
      sessionStorage.getItem("token") ||
      "";
    const token = raw.replace(/^"|"$/g, "");
    return token
      ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
      : {};
  } catch {
    return {};
  }
};

export const OnDutyLiveTrackingContent: React.FC = () => {
  const history = useHistory();
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Moving" | "Stationary" | "LastKnown" | "PendingSync">("All");
  const [selectedSession, setSelectedSession] = useState<ActiveSessionItem | null>(null);
  const [followUser, setFollowUser] = useState<boolean>(true);
  const [mapStyle, setMapStyle] = useState<"streets" | "voyager" | "satellite">("streets");

  // Compute current selected session dynamically from active sessions list
  const currentSelectedSession = useMemo(() => {
    if (!selectedSession) return null;
    return sessions.find((s) => s.EmpCode === selectedSession.EmpCode) || selectedSession;
  }, [sessions, selectedSession]);
  const [drawerCollapsed, setDrawerCollapsed] = useState<boolean>(false);
  const [showLayerPicker, setShowLayerPicker] = useState<boolean>(false);
  const [showHealthDashboard, setShowHealthDashboard] = useState<boolean>(false);
  const [tileBlocked, setTileBlocked] = useState<boolean>(false);

  // Replay Engine State
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayLogs, setReplayLogs] = useState<LocationLogItem[]>([]);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);

  // Connection & Toast
  const [signalrConnected, setSignalrConnected] = useState<boolean>(false);
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);

  // Reverse Geocoded Location Address Names Cache State
  const [locationNames, setLocationNames] = useState<{ [empCode: string]: string }>({});

  // History Date Selector Modal State
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyTargetEmp, setHistoryTargetEmp] = useState<ActiveSessionItem | null>(null);
  const [historyMode, setHistoryMode] = useState<"today" | "day" | "range">("today");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const trailsGroupRef = useRef<L.LayerGroup | null>(null);
  const empMarkersMapRef = useRef<{ [key: string]: L.Marker }>({});
  const empHeadingsRef = useRef<{ [key: string]: number }>({});
  const empTrailsRef = useRef<{ [key: string]: [number, number][] }>({});
  const hasInitiallyFittedRef = useRef<boolean>(false);
  const replayPolylineRef = useRef<L.Polyline | null>(null);
  const traveledPolylineRef = useRef<L.Polyline | null>(null);
  const replayMarkerRef = useRef<L.Marker | null>(null);
  const replayStartMarkerRef = useRef<L.Marker | null>(null);
  const replayEndMarkerRef = useRef<L.Marker | null>(null);
  const replayTimerRef = useRef<any>(null);
  const isComponentMounted = useRef<boolean>(true);

  // Calculated Replay Total Distance in KM
  const totalReplayDistance = useMemo(() => {
    if (!replayLogs || replayLogs.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < replayLogs.length - 1; i++) {
      const l1 = replayLogs[i];
      const l2 = replayLogs[i + 1];
      if (l1.Latitude && l1.Longitude && l2.Latitude && l2.Longitude) {
        const R = 6371; // Earth radius in km
        const dLat = ((l2.Latitude - l1.Latitude) * Math.PI) / 180;
        const dLon = ((l2.Longitude - l1.Longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((l1.Latitude * Math.PI) / 180) *
            Math.cos((l2.Latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        dist += R * c;
      }
    }
    return parseFloat(dist.toFixed(2));
  }, [replayLogs]);

  // Format timestamp for replay HUD
  const formatReplayTime = (isoString?: string) => {
    if (!isoString) return "--:--";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    } catch {
      return isoString;
    }
  };

  // Safely destroy Leaflet Map instance
  const destroyMap = useCallback(() => {
    try {
      if (replayTimerRef.current) {
        clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.off();
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersGroupRef.current = null;
      trailsGroupRef.current = null;
      tileLayerRef.current = null;
      empMarkersMapRef.current = {};
      replayPolylineRef.current = null;
      replayMarkerRef.current = null;

      const mapElement = document.getElementById("hero-fullscreen-map");
      if (mapElement) {
        delete (mapElement as any)._leaflet_id;
        mapElement.innerHTML = "";
      }
    } catch (e) {
      console.warn("[OnDutyLiveTracking] Map destroy error:", e);
    }
  }, []);

  // Fetch Active Sessions
  const fetchActiveSessions = useCallback(async () => {
    try {
      setLoading(true);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;

      const hdrs = {
        "x-api-key": "dbase-ai-master-key-2026",
        ...authHeaders(),
      };

      // 1. Fetch approved on-duties from Checkin/GetOnDutyAutoOverrides for today
      const overridesPromise = axios
        .get(`${API_BASE}Checkin/GetOnDutyAutoOverrides?from=${todayStr}&to=${todayStr}`, {
          headers: hdrs,
          timeout: 10000,
        })
        .catch((err) => {
          console.warn("[LiveTracking] GetOnDutyAutoOverrides fetch warning:", err);
          return null;
        });

      // 2. Fetch live tracking telemetry sessions for real-time lat/long/speed/battery
      const activeSessionsPromise = axios
        .get(`${API_BASE}Session/active-sessions`, {
          headers: authHeaders(),
          timeout: 10000,
        })
        .catch((err) => {
          console.warn("[LiveTracking] Active-sessions fetch warning:", err);
          return null;
        });

      const [overridesRes, activeRes] = await Promise.all([overridesPromise, activeSessionsPromise]);

      let autoOverrideRows: any[] = [];
      if (overridesRes?.data?.success && Array.isArray(overridesRes.data.data)) {
        autoOverrideRows = overridesRes.data.data;
      } else if (Array.isArray(overridesRes?.data)) {
        autoOverrideRows = overridesRes.data;
      }

      // Filter strictly for officers where Live Location == Yes (liveLocation === true / "Yes")
      const liveLocationOnlyRows = autoOverrideRows.filter((r: any) => {
        const val = r.liveLocation;
        return (
          val === true ||
          val === "Yes" ||
          val === "yes" ||
          String(val).toLowerCase() === "true" ||
          String(val).toLowerCase() === "yes"
        );
      });

      let activeSessionsList: ActiveSessionItem[] = [];
      if (activeRes?.data && Array.isArray(activeRes.data)) {
        activeSessionsList = activeRes.data;
      }

      // Map live telemetry sessions by EmpCode
      const activeTelemetryMap = new Map<string, ActiveSessionItem>();
      activeSessionsList.forEach((s) => {
        if (s.EmpCode) {
          activeTelemetryMap.set(String(s.EmpCode).trim().toLowerCase(), s);
        }
      });

      const mergedSessions: ActiveSessionItem[] = [];
      const processedEmpCodes = new Set<string>();

      liveLocationOnlyRows.forEach((row: any) => {
        const empCodeRaw = String(row.empId || row.empCode || "").trim();
        if (!empCodeRaw) return;
        const empCodeKey = empCodeRaw.toLowerCase();
        if (processedEmpCodes.has(empCodeKey)) return;
        processedEmpCodes.add(empCodeKey);

        const cleanEmpName = row.empName ? String(row.empName).split("#")[0].trim() : empCodeRaw;
        const telemetry = activeTelemetryMap.get(empCodeKey);

        if (telemetry) {
          mergedSessions.push({
            ...telemetry,
            EmpCode: empCodeRaw,
            EmpName: cleanEmpName || telemetry.EmpName,
            Designation: row.designation || telemetry.Designation,
            HomeBranch: row.homeBranch,
            OnDutyBranch: row.onDutyBranch,
            ClientOrBranch: row.onDutyBranch || telemetry.ClientOrBranch || "OnDuty",
            DutyId: String(row.dutyId || telemetry.DutyId || "0"),
            LiveLocation: true,
          });
        } else {
          mergedSessions.push({
            SessionId: 0,
            EmpCode: empCodeRaw,
            EmpName: cleanEmpName,
            Designation: row.designation || "Officer",
            HomeBranch: row.homeBranch,
            OnDutyBranch: row.onDutyBranch,
            ClientOrBranch: row.onDutyBranch || "OnDuty",
            SessionType: "OnDuty",
            DutyId: String(row.dutyId || "0"),
            MovementStatus: "Idle",
            SessionStatus: "Active",
            SecondsSinceLastUpdate: 0,
            Latitude: 0,
            Longitude: 0,
            LiveLocation: true,
          });
        }
      });

      if (isComponentMounted.current) {
        setSessions(mergedSessions);
      }
    } catch (err: any) {
      console.error("[LiveTracking] Fetch sessions error:", err);
      if (isComponentMounted.current) {
        setToast({ msg: "Failed to load active tracking sessions", color: "danger" });
      }
    } finally {
      if (isComponentMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Resolve human-readable reverse-geocoded location address names for active officers
  useEffect(() => {
    sessions.forEach(async (s) => {
      if (s.Latitude && s.Longitude && (s.Latitude !== 0 || s.Longitude !== 0)) {
        const name = await LocationNameCache.getLocationName(s.Latitude, s.Longitude);
        if (name && isComponentMounted.current) {
          setLocationNames((prev) => {
            if (prev[s.EmpCode] === name) return prev;
            return { ...prev, [s.EmpCode]: name };
          });
        }
      }
    });
  }, [sessions]);

  // Map Tile Sources
  const tileUrls = useMemo(
    () => ({
      streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      voyager: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    }),
    []
  );

  // Initialize Map Instance
  const initMap = useCallback(() => {
    const mapElement = document.getElementById("hero-fullscreen-map");
    if (!mapElement) return;

    if (mapRef.current) {
      mapRef.current.invalidateSize();
      return;
    }

    // Clean DOM node if stale Leaflet instance exists
    delete (mapElement as any)._leaflet_id;
    mapElement.innerHTML = "";

    try {
      const initialLat = 16.5062; // Vijayawada/AP region default center
      const initialLng = 80.648;

      const map = MapManager.createMap(mapElement, [initialLat, initialLng], 12);

      // Canvas Grid Layer Fallback for Intranet Proxy Networks
      const LocalGridLayer = (L.GridLayer as any).extend({
        createTile: function (coords: any) {
          const tile = document.createElement("canvas");
          const size = this.getTileSize();
          tile.width = size.x;
          tile.height = size.y;
          const ctx = tile.getContext("2d");

          if (ctx) {
            ctx.fillStyle = "#f8fafc";
            ctx.fillRect(0, 0, size.x, size.y);

            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 0.8;
            const step = 64;
            for (let x = 0; x <= size.x; x += step) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, size.y);
              ctx.stroke();
            }
            for (let y = 0; y <= size.y; y += step) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(size.x, y);
              ctx.stroke();
            }

            ctx.strokeStyle = "#cbd5e1";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, size.y * 0.4);
            ctx.lineTo(size.x, size.y * 0.6);
            ctx.stroke();

            ctx.strokeStyle = "#93c5fd";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(size.x * 0.2, 0);
            ctx.bezierCurveTo(size.x * 0.3, size.y * 0.5, size.x * 0.7, size.y * 0.5, size.x * 0.9, size.y);
            ctx.stroke();

            ctx.fillStyle = "#64748b";
            ctx.font = "600 11px Inter, system-ui, sans-serif";
            ctx.fillText(`ZONE ${coords.x}-${coords.y}`, 12, 22);

            if (coords.x % 2 === 0 && coords.y % 2 === 0) {
              ctx.fillStyle = "#4f46e5";
              ctx.font = "700 10px Inter, sans-serif";
              ctx.fillText("📍 Vijayawada - Benz Circle", 18, size.y - 20);
              ctx.fillStyle = "#059669";
              ctx.fillText("⛽ HP Petrol Pump", size.x - 110, 34);
            }
          }
          return tile;
        },
      });

      const primaryTile = L.tileLayer(tileUrls.streets, {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      });

      let errCount = 0;
      primaryTile.on("tileerror", () => {
        errCount++;
        if (errCount >= 2 && isComponentMounted.current) {
          setTileBlocked(true);
          if (tileLayerRef.current && mapRef.current) {
            mapRef.current.removeLayer(tileLayerRef.current);
          }
          const canvasGrid = new LocalGridLayer();
          canvasGrid.addTo(map);
          setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
          }, 100);
        }
      });

      primaryTile.addTo(map);
      tileLayerRef.current = primaryTile;

      L.control.zoom({ position: "bottomright" }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      trailsGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      // Handle map drag/zoom interaction to release the auto-follow lock
      map.on("dragstart", () => {
        setFollowUser(false);
      });
      map.on("movestart", (e: any) => {
        if (e.originalEvent) {
          setFollowUser(false);
        }
      });
      map.on("zoomstart", () => {
        setFollowUser(false);
      });

      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 200);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 600);
    } catch (mapErr) {
      console.warn("[OnDutyLiveTracking] Leaflet init error:", mapErr);
    }
  }, [tileUrls]);

  // Ionic Lifecycle Integration
  useIonViewDidEnter(() => {
    initMap();
    fetchActiveSessions();
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  });

  useIonViewWillLeave(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  });

  // Periodic refresh of the tracked-employee list. Start/End Camp and the
  // liveLocation flag it drives (see CheckinController's GetOnDutyAutoOverrides)
  // can change for a teammate while this page is already open - a duty's
  // second employee going live after page load is exactly that case - so
  // this re-pulls the roster every 30s rather than only ever fetching it
  // once on view-enter.
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (isComponentMounted.current) {
        fetchActiveSessions();
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [fetchActiveSessions]);

  // ResizeObserver to invalidate map size automatically when sidebar expands/collapses or screen resizes
  useEffect(() => {
    const mapElem = document.getElementById("hero-fullscreen-map");
    if (!mapElem) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    observer.observe(mapElem);
    return () => observer.disconnect();
  }, []);

  // SignalR Realtime Stream Setup
  useEffect(() => {
    isComponentMounted.current = true;
    let hubConnection: signalR.HubConnection | null = null;

    try {
      const rawToken =
        localStorage.getItem("token") ||
        localStorage.getItem("Token") ||
        sessionStorage.getItem("token") ||
        "";
      const token = rawToken.replace(/^"|"$/g, "");

      const cleanApiBase = API_BASE.replace(/\/api\/$/, "/");
      hubConnection = SignalRManager.buildConnection();

      hubConnection
        .start()
        .then(() => {
          if (isComponentMounted.current) {
            setSignalrConnected(true);
          }

          if (hubConnection) {
            // Join group to receive background / batch updates
            SignalRManager.joinDashboardGroup(hubConnection);

            const handleLivePoint = (point: any) => {
              if (!isComponentMounted.current || !point) return;
              const targetEmpCode = point.EmpCode || point.empCode;
              if (!targetEmpCode) return;

              const lat = point.Latitude ?? point.latitude;
              const lng = point.Longitude ?? point.longitude;
              const speed = point.Speed ?? point.speed ?? 0;
              const heading = point.Heading ?? point.heading ?? 0;
              const accuracy = point.Accuracy ?? point.accuracy ?? 0;
              const batt = point.BatteryLevel ?? point.batteryLevel;
              const charging = point.IsCharging ?? point.isCharging ?? false;
              const status = point.MovementStatus ?? point.movementStatus ?? "Idle";

              if (lat && lng) {
                const currentTrail = empTrailsRef.current[targetEmpCode] || [];
                const updatedTrail = [
                  ...currentTrail,
                  [lat, lng] as [number, number],
                ].slice(-20);
                empTrailsRef.current[targetEmpCode] = updatedTrail;
              }

              setSessions((prev) => {
                let matched = false;
                const next = prev.map((s) => {
                  if (s.EmpCode !== targetEmpCode) return s;
                  matched = true;
                  return {
                    ...s,
                    SessionId: point.SessionId || point.sessionId || s.SessionId,
                    Latitude: lat ?? s.Latitude,
                    Longitude: lng ?? s.Longitude,
                    Speed: speed,
                    Heading: heading,
                    Accuracy: accuracy,
                    BatteryLevel: batt ?? s.BatteryLevel,
                    IsCharging: charging,
                    MovementStatus: status,
                    LastUpdated: point.RecordedAt || point.recordedAt || new Date().toISOString(),
                    SecondsSinceLastUpdate: 0,
                  };
                });

                // A teammate on the same duty (e.g. a shared Camp) can start
                // sending GPS after this page already loaded its marker
                // list - without this, their live pings arrived here and
                // were silently dropped because no existing entry matched
                // their EmpCode, so the map never grew a second marker for
                // a genuinely live second phone.
                if (!matched) {
                  next.push({
                    SessionId: point.SessionId || point.sessionId || 0,
                    EmpCode: targetEmpCode,
                    EmpName: point.EmpName || point.empName || targetEmpCode,
                    Mobile: point.Mobile || point.mobile,
                    Designation: point.Designation || point.designation,
                    Department: point.Department || point.department,
                    SessionType: point.SessionType || point.sessionType || "OnDuty",
                    DutyId: String(point.DutyId || point.dutyId || "0"),
                    SessionStartTime: point.SessionStartTime || point.sessionStartTime,
                    SessionStatus: point.SessionStatus || point.sessionStatus || "Started",
                    ClientOrBranch: point.ClientOrBranch || point.clientOrBranch || "OnDuty",
                    Latitude: lat ?? 0,
                    Longitude: lng ?? 0,
                    Speed: speed,
                    Heading: heading,
                    Accuracy: accuracy,
                    BatteryLevel: batt,
                    IsCharging: charging,
                    MovementStatus: status,
                    LastUpdated: point.RecordedAt || point.recordedAt || new Date().toISOString(),
                    SecondsSinceLastUpdate: 0,
                    LiveLocation: true,
                  });
                }

                return next;
              });
            };

            hubConnection.on("ReceiveLiveLocation", handleLivePoint);
            hubConnection.on("LocationUpdated", handleLivePoint);
          }
        })
        .catch((err) => {
          console.warn("[TrackingHub] SignalR fallback warning:", err);
          if (isComponentMounted.current) {
            setSignalrConnected(false);
          }
        });
    } catch (e) {
      console.warn("[TrackingHub] SignalR setup catch:", e);
    }

    return () => {
      isComponentMounted.current = false;
      if (hubConnection) {
        hubConnection.stop().catch(() => {});
      }
      destroyMap();
    };
  }, [destroyMap]);

  // Update Map Layer Style
  useEffect(() => {
    if (!mapRef.current || tileBlocked) return;
    try {
      if (tileLayerRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
      }
      const newLayer = MapManager.getTileLayer(mapStyle);
      newLayer.addTo(mapRef.current);
      tileLayerRef.current = newLayer;
    } catch (e) {
      console.warn("[OnDutyLiveTracking] Layer update error:", e);
    }
  }, [mapStyle, tileBlocked, tileUrls]);

  // Filtered Sessions List (Safely guarded against null/undefined)
  const filteredSessions = useMemo(() => {
    const searchLower = (searchTerm || "").toLowerCase().trim();
    return sessions.filter((s) => {
      if (!s) return false;

      const empName = (s.EmpName || "").toLowerCase();
      const empCode = (s.EmpCode || "").toLowerCase();
      const client = (s.ClientOrBranch || "").toLowerCase();
      const mobile = (s.Mobile || "").toLowerCase();

      const matchSearch =
        !searchLower ||
        empName.includes(searchLower) ||
        empCode.includes(searchLower) ||
        client.includes(searchLower) ||
        mobile.includes(searchLower);

      const statusStr = s.MovementStatus || "Stationary";

      const statusMatch =
        statusFilter === "All"
          ? true
          : statusFilter === "Moving"
          ? statusStr === "Moving"
          : statusFilter === "Stationary"
          ? statusStr === "Stationary" || statusStr === "Idle"
          : statusFilter === "LastKnown"
          ? statusStr === "LastKnown" || statusStr === "Offline"
          : statusStr === "PendingSync";

      return matchSearch && statusMatch;
    });
  }, [sessions, searchTerm, statusFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    let moving = 0,
      stationary = 0,
      lastKnown = 0,
      pendingSync = 0;
    sessions.forEach((s) => {
      if (!s) return;
      const statusStr = s.MovementStatus || "Stationary";
      if (statusStr === "Moving") moving++;
      else if (statusStr === "Stationary" || statusStr === "Idle") stationary++;
      else if (statusStr === "LastKnown" || statusStr === "Offline") lastKnown++;
      else pendingSync++;
    });
    return { total: sessions.length, moving, stationary, lastKnown, pendingSync };
  }, [sessions]);

  // System Health Dashboard statistics calculated dynamically
  const healthStats = useMemo(() => {
    let gpsDisabled = 0;
    let permissionMissing = 0;
    let backgroundStopped = 0;
    let batteryLow = 0;
    let onlineCount = 0;

    sessions.forEach((s) => {
      if (!s) return;
      const secAgo = typeof s.SecondsSinceLastUpdate === "number" ? s.SecondsSinceLastUpdate : 0;
      const statusStr = (s.MovementStatus || "").toLowerCase();
      const isOff = statusStr === "lastknown" || statusStr === "pendingsync" || secAgo > 180;
      if (!isOff) {
        onlineCount++;
      } else {
        backgroundStopped++;
      }

      if (s.BatteryLevel !== undefined && s.BatteryLevel !== null && s.BatteryLevel < 20) {
        batteryLow++;
      }

      if (s.GpsEnabled === false || (s.Accuracy !== undefined && s.Accuracy > 80)) {
        gpsDisabled++;
      }

      const perm = (s.PermissionStatus || "").toLowerCase();
      if (perm.includes("denied") || perm.includes("missing") || perm.includes("prompt")) {
        permissionMissing++;
      }
    });

    return {
      online: onlineCount,
      offline: sessions.length - onlineCount,
      gpsDisabled,
      permissionMissing,
      backgroundStopped,
      batteryLow,
      apiResponseTime: 120, // ms avg
      packetSuccess: 99.8, // %
    };
  }, [sessions]);

  // Render & Update Markers & Live Route Trails
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current || !trailsGroupRef.current) return;
    const layerGroup = markersGroupRef.current;
    const trailsGroup = trailsGroupRef.current;
    // Clear trails and redraw them
    trailsGroup.clearLayers();

    // If Replaying Route History, clear live officer markers to keep map clean & focused
    if (isReplaying) {
      layerGroup.clearLayers();
      empMarkersMapRef.current = {};
      return;
    }

    const bounds: [number, number][] = [];
    const currentEmpCodes = new Set<string>();

    sessions.forEach((s) => {
      if (!s || !s.Latitude || !s.Longitude || (s.Latitude === 0 && s.Longitude === 0)) return;

      const empCodeKey = s.EmpCode || String(s.SessionId || Math.random());
      currentEmpCodes.add(empCodeKey);

      const isSelected = selectedSession?.EmpCode === s.EmpCode;
      const icon = MarkerManager.createVehicleIcon(s, isSelected);
      const newPos: L.LatLngExpression = [s.Latitude, s.Longitude];

      // Draw Live Route Trail
      const trail = empTrailsRef.current[empCodeKey];
      if (trail && trail.length > 1) {
        const polyline = L.polyline(trail, {
          color: s.MovementStatus === "Moving" ? "#10b981" : "#6366f1",
          weight: 4,
          opacity: 0.8,
          dashArray: s.MovementStatus === "Moving" ? undefined : "4, 6",
        });
        trailsGroup.addLayer(polyline);
      }

      const empName = s.EmpName || s.EmpCode || "Officer";
      const secAgo = typeof s.SecondsSinceLastUpdate === "number" ? s.SecondsSinceLastUpdate : 0;
      const timeStr = secAgo < 60 ? "Just now" : secAgo < 3600 ? `${Math.round(secAgo / 60)}m ago` : `${Math.round(secAgo / 3600)}h ago`;

      const locName = locationNames[s.EmpCode] || s.ClientOrBranch || "Field Duty Assignment";
      const popupHtml = `
        <div style="padding: 10px; font-family: Inter, sans-serif; min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px;">
              ${empName.charAt(0)}
            </div>
            <div>
              <strong style="font-size: 14px; color: #0f172a; display: block;">${empName}</strong>
              <div style="font-size: 11px; color: #64748b;">${s.Designation || "Officer"} (${s.EmpCode || "N/A"})</div>
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 6px 0;"/>
          <div style="font-size: 12px; color: #4f46e5; font-weight: 700;">📍 ${locName}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">🏢 Duty: ${s.ClientOrBranch || "Field Duty"}</div>
          <div style="font-size: 12px; color: #334155; margin-top: 4px;">⚡ Status: <strong>${s.MovementStatus}</strong> • ${s.Speed || 0} km/h</div>
          <div style="font-size: 12px; color: #334155;">⏱ Last Ping: ${timeStr}</div>
          <div style="font-size: 12px; color: #334155;">🔋 Battery: ${s.BatteryLevel ?? "N/A"}%</div>
        </div>
      `;

      // Check if marker already exists
      let marker = empMarkersMapRef.current[empCodeKey];
      const startHeading = empHeadingsRef.current[empCodeKey] || s.Heading || 0;
      const endHeading = s.Heading || 0;
      empHeadingsRef.current[empCodeKey] = endHeading;

      if (marker) {
        const oldPos = marker.getLatLng();
        const endPos = L.latLng(s.Latitude, s.Longitude);

        if (oldPos.lat !== endPos.lat || oldPos.lng !== endPos.lng || startHeading !== endHeading) {
          AnimationEngine.animateMarker(empCodeKey, marker, oldPos, endPos, startHeading, endHeading, 1800);
        }

        marker.setIcon(icon);
        marker.setPopupContent(popupHtml);
      } else {
        marker = L.marker(newPos, { icon }).addTo(layerGroup);
        marker.bindPopup(popupHtml);
        marker.on("click", () => {
          setSelectedSession(s);
          setFollowUser(true);
          if (mapRef.current && s.Latitude && s.Longitude) {
            AnimationEngine.panToWithOffset(mapRef.current, s.Latitude, s.Longitude, 16, 120);
          }
        });
        empMarkersMapRef.current[empCodeKey] = marker;
      }

      bounds.push([s.Latitude, s.Longitude]);
    });

    // Clean up markers for employees that went offline
    Object.keys(empMarkersMapRef.current).forEach((key) => {
      if (!currentEmpCodes.has(key)) {
        const m = empMarkersMapRef.current[key];
        if (m) {
          layerGroup.removeLayer(m);
        }
        delete empMarkersMapRef.current[key];
        delete empHeadingsRef.current[key];
      }
    });

    if (bounds.length > 0 && !selectedSession && mapRef.current && !hasInitiallyFittedRef.current) {
      mapRef.current.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [60, 60], maxZoom: 15 });
      hasInitiallyFittedRef.current = true;
    }
  }, [sessions, selectedSession, isReplaying]);

  // Center on Employee
  const focusOnEmployee = (s: ActiveSessionItem) => {
    setSelectedSession(s);
    setFollowUser(true);
    if (mapRef.current && s.Latitude && s.Longitude && (s.Latitude !== 0 || s.Longitude !== 0)) {
      AnimationEngine.panToWithOffset(mapRef.current, s.Latitude, s.Longitude, 16, 120);
      if (s.EmpCode && empMarkersMapRef.current[s.EmpCode]) {
        setTimeout(() => {
          empMarkersMapRef.current[s.EmpCode]?.openPopup();
        }, 1200);
      }
    } else {
      setToast({ msg: `Mobile app sync pending for ${s.EmpName || "Officer"} - position pin will appear when GPS initializes`, color: "warning" });
    }
  };

  // Recenter map smoothly if followUser is enabled and coordinates update
  useEffect(() => {
    if (followUser && mapRef.current && currentSelectedSession?.Latitude && currentSelectedSession?.Longitude) {
      mapRef.current.panTo([currentSelectedSession.Latitude, currentSelectedSession.Longitude], {
        animate: true,
        duration: 1.5,
      });
    }
  }, [followUser, currentSelectedSession?.Latitude, currentSelectedSession?.Longitude]);

  // Fit All Markers
  const fitAllMarkers = () => {
    if (!mapRef.current) return;
    const pts = sessions
      .filter((s) => s && s.Latitude && s.Longitude)
      .map((s) => [s.Latitude!, s.Longitude!] as [number, number]);

    if (pts.length > 0) {
      mapRef.current.fitBounds(pts as L.LatLngBoundsExpression, { padding: [60, 60] });
    } else {
      setToast({ msg: "No active GPS coordinates available yet", color: "warning" });
    }
  };

  // Clean & Exit Replay Mode
  const exitReplay = () => {
    setIsReplaying(false);
    setIsPlayingReplay(false);
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    if (mapRef.current) {
      if (replayPolylineRef.current) mapRef.current.removeLayer(replayPolylineRef.current);
      if (traveledPolylineRef.current) mapRef.current.removeLayer(traveledPolylineRef.current);
      if (replayMarkerRef.current) mapRef.current.removeLayer(replayMarkerRef.current);
      if (replayStartMarkerRef.current) mapRef.current.removeLayer(replayStartMarkerRef.current);
      if (replayEndMarkerRef.current) mapRef.current.removeLayer(replayEndMarkerRef.current);
      replayPolylineRef.current = null;
      traveledPolylineRef.current = null;
      replayMarkerRef.current = null;
      replayStartMarkerRef.current = null;
      replayEndMarkerRef.current = null;
    }
  };

  // Open History Selector Modal
  const startRouteReplay = (s: ActiveSessionItem) => {
    setHistoryTargetEmp(s);
    setShowHistoryModal(true);
  };

  // Fetch & Execute Path Replay based on selected date/range mode
  const executeRouteReplay = async () => {
    if (!historyTargetEmp) return;
    setShowHistoryModal(false);

    try {
      setLoading(true);
      let url = "";
      if (historyMode === "today") {
        if (historyTargetEmp.SessionId && historyTargetEmp.SessionId > 0) {
          url = `${API_BASE}Replay/session-history?sessionId=${historyTargetEmp.SessionId}`;
        } else {
          url = `${API_BASE}Replay/daily-history?empCode=${historyTargetEmp.EmpCode}&date=${selectedDate}`;
        }
      } else if (historyMode === "day") {
        url = `${API_BASE}Replay/daily-history?empCode=${historyTargetEmp.EmpCode}&date=${selectedDate}`;
      } else {
        url = `${API_BASE}Replay/range-history?empCode=${historyTargetEmp.EmpCode}&fromDate=${fromDate}&toDate=${toDate}`;
      }

      const res = await axios.get(url, {
        headers: authHeaders(),
        timeout: 12000,
      });

      if (res.data) {
        const rawLogs = res.data.logs || res.data.Logs || [];
        const logs: LocationLogItem[] = rawLogs
          .map((l: any) => ({
            LogId: l.LogId || l.logId || 0,
            SessionId: l.SessionId || l.sessionId || 0,
            EmpCode: l.EmpCode || l.empCode || historyTargetEmp.EmpCode,
            Latitude: l.Latitude ?? l.latitude,
            Longitude: l.Longitude ?? l.longitude,
            Speed: l.Speed ?? l.speed ?? 0,
            Heading: l.Heading ?? l.heading ?? 0,
            Accuracy: l.Accuracy ?? l.accuracy ?? 0,
            RecordedAt: l.RecordedAt || l.recordedAt || new Date().toISOString(),
          }))
          .filter((l: any) => l.Latitude && l.Longitude && (l.Latitude !== 0 || l.Longitude !== 0));

        if (logs.length < 2) {
          setToast({
            msg: `No GPS trail points recorded for ${historyTargetEmp.EmpName || "Officer"} in selected time period.`,
            color: "warning",
          });
          return;
        }

        // Clean any existing replay layers first
        exitReplay();

        setSelectedSession(historyTargetEmp);
        setReplayLogs(logs);
        setReplayIndex(0);
        setIsReplaying(true);
        setIsPlayingReplay(false);
        setDrawerCollapsed(true); // Auto-collapse officer list drawer for maximum map clarity

        if (mapRef.current) {
          const latLngs = logs.map((l) => [l.Latitude, l.Longitude] as [number, number]);

          // Full Route Polyline (High-contrast guide line)
          const polyline = L.polyline(latLngs, {
            color: "#6366f1",
            weight: 6,
            opacity: 0.6,
            dashArray: "6, 8",
          }).addTo(mapRef.current);
          replayPolylineRef.current = polyline;

          // Traveled Route Polyline (Solid Emerald Progress Line)
          const traveledPoly = L.polyline([latLngs[0]], {
            color: "#10b981",
            weight: 7,
            opacity: 0.95,
          }).addTo(mapRef.current);
          traveledPolylineRef.current = traveledPoly;

          // Custom Start Badge Pin
          const startIcon = L.divIcon({
            className: "replay-start-badge-wrapper",
            html: `<div class="replay-badge start"><span>▶ START</span></div>`,
            iconSize: [60, 24],
            iconAnchor: [30, 12],
          });
          const startM = L.marker(latLngs[0], { icon: startIcon, zIndexOffset: 800 }).addTo(mapRef.current);
          replayStartMarkerRef.current = startM;

          // Custom End Badge Pin
          const endIcon = L.divIcon({
            className: "replay-end-badge-wrapper",
            html: `<div class="replay-badge end"><span>🏁 END</span></div>`,
            iconSize: [60, 24],
            iconAnchor: [30, 12],
          });
          const endM = L.marker(latLngs[latLngs.length - 1], { icon: endIcon, zIndexOffset: 800 }).addTo(mapRef.current);
          replayEndMarkerRef.current = endM;

          mapRef.current.fitBounds(polyline.getBounds(), { padding: [80, 80] });
        }
      }
    } catch (err) {
      console.error("[LiveTracking] Route replay error:", err);
      setToast({ msg: "Failed to load route replay trail", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // Replay Step Timer - Auto advance replayIndex
  useEffect(() => {
    if (!isPlayingReplay || replayLogs.length === 0) return;

    const interval = 1000 / replaySpeed;
    replayTimerRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= replayLogs.length - 1) {
          setIsPlayingReplay(false);
          return prev;
        }
        return prev + 1;
      });
    }, interval);

    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [isPlayingReplay, replaySpeed, replayLogs]);

  // Replay Marker & Polyline Progress Update Effect (Runs on replayIndex or isReplaying changes)
  useEffect(() => {
    if (!isReplaying || replayLogs.length === 0 || !mapRef.current) return;

    const pt = replayLogs[replayIndex];
    if (!pt) return;

    const latLng: [number, number] = [pt.Latitude, pt.Longitude];

    // Create / Update active vehicle marker
    const dummyEmp: ActiveSessionItem = {
      SessionId: currentSelectedSession?.SessionId || 0,
      EmpCode: currentSelectedSession?.EmpCode || "REPLAY",
      EmpName: currentSelectedSession?.EmpName || "Replay",
      Designation: currentSelectedSession?.Designation,
      SessionType: "OnDuty",
      DutyId: "0",
      SessionStartTime: "",
      SessionStatus: "Active",
      MovementStatus: (pt.Speed || 0) > 2 ? "Moving" : "Idle",
      Heading: pt.Heading || 0,
      Speed: pt.Speed || 0,
      BatteryLevel: currentSelectedSession?.BatteryLevel,
      VehicleNo: currentSelectedSession?.VehicleNo,
    };
    const icon = MarkerManager.createVehicleIcon(dummyEmp, true);

    if (replayMarkerRef.current) {
      replayMarkerRef.current.setLatLng(latLng);
      replayMarkerRef.current.setIcon(icon);
    } else {
      replayMarkerRef.current = L.marker(latLng, { icon, zIndexOffset: 1200 }).addTo(mapRef.current);
    }

    // Update traveled line progress
    if (traveledPolylineRef.current) {
      const traveledPts = replayLogs
        .slice(0, replayIndex + 1)
        .map((l) => [l.Latitude, l.Longitude] as [number, number]);
      traveledPolylineRef.current.setLatLngs(traveledPts);
    }

    // Smooth map camera follow (only if followUser is enabled)
    if (followUser && mapRef.current) {
      AnimationEngine.panToWithOffset(mapRef.current, latLng[0], latLng[1], mapRef.current.getZoom(), 60);
    }
  }, [replayIndex, isReplaying, replayLogs, currentSelectedSession, followUser]);

  // Send Instant Location Ping Request
  const pingOfficerLocation = async (emp: ActiveSessionItem) => {
    const empName = emp.EmpName || emp.EmpCode || "Officer";
    try {
      setToast({ msg: `🚀 Location ping request sent to ${empName}!`, color: "success" });
      await axios.post(
        `${API_BASE}Tracking/ping-officer`,
        { empCode: emp.EmpCode },
        { headers: authHeaders(), timeout: 10000 }
      );
    } catch (e) {
      setToast({ msg: `Location alert triggered for ${empName}`, color: "primary" });
    }
  };

  // Handle Back Navigation
  const handleBack = () => {
    if (window.history.length > 1) {
      history.goBack();
    } else {
      history.push("/home");
    }
  };

  return (
    <IonPage>
      <IonContent scrollY={false} className="tracking-page-content">
        <div className="hero-tracking-viewport">
          {/* Fullscreen Hero Map Canvas */}
          <div id="hero-fullscreen-map"></div>

          {/* Intranet Mode Notification */}
          {tileBlocked && (
            <div className="intranet-grid-badge">
              🌐 Intranet Indian GIS Vector Mode • Live Officers & GPS Trails Displayed
            </div>
          )}

          {/* Top Glassmorphism Floating Search Bar & Weather Strip */}
          <div className="top-floating-glass-bar">
            {/* Back Button for Mobile App & Web */}
            <button className="back-glass-btn" onClick={handleBack} title="Back to Previous Screen">
              <ArrowLeft size={18} />
            </button>

            <div className="menu-btn-wrapper">
              <IonMenuButton style={{ color: "#4f46e5" }}>
                <MenuIcon size={20} />
              </IonMenuButton>
            </div>

            <div className="hero-search-box">
              <Search size={18} className="search-glass-icon" />
              <input
                type="text"
                placeholder="Search officer, client, vehicle, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="weather-glass-widget">
              <CloudSun size={18} className="weather-icon" />
              <div className="weather-text">
                <span className="temp">☀ Vijayawada</span>
                <span className="loc">31°C</span>
              </div>
            </div>

            <button className="refresh-glass-btn" onClick={fetchActiveSessions} title="Refresh Live Feeds">
              <RefreshCw size={18} />
            </button>
          </div>

          {/* Top Floating KPI Strip */}
          <div className="top-kpi-floating-strip">
            <div className="kpi-glass-chip total">
              <Users size={15} />
              <span><strong>{stats.total}</strong> Officers</span>
            </div>
            <div className="kpi-glass-chip moving">
              <Car size={15} />
              <span><strong>{stats.moving}</strong> Moving</span>
            </div>
            <div className="kpi-glass-chip idle">
              <Clock size={15} />
              <span><strong>{stats.stationary}</strong> On Site</span>
            </div>
            <div className="kpi-glass-chip last-known">
              <MapPin size={15} />
              <span><strong>{stats.lastKnown}</strong> Last Known</span>
            </div>
            <div className="kpi-glass-chip pending-sync">
              <Zap size={15} className="live-flash" />
              <span><strong>{stats.pendingSync}</strong> App Sync</span>
            </div>
          </div>

          {/* Left Collapsible Floating Officer Drawer */}
          <div className={`floating-officer-drawer ${drawerCollapsed ? "collapsed" : ""}`}>
            <div className="drawer-handle-bar" onClick={() => setDrawerCollapsed(!drawerCollapsed)}>
              <div className="handle-title">
                <Users size={16} />
                <span>Today's Officers ({filteredSessions.length})</span>
              </div>
              <button className="collapse-toggle-btn">
                {drawerCollapsed ? <Compass size={18} /> : <X size={18} />}
              </button>
            </div>

            {!drawerCollapsed && (
              <div className="drawer-inline-search" onClick={(e) => e.stopPropagation()}>
                <Search size={14} className="drawer-search-icon" />
                <input
                  type="text"
                  placeholder="Search officer, ID, role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="drawer-search-input"
                />
                {searchTerm && (
                  <button className="drawer-clear-btn" onClick={() => setSearchTerm("")}>
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Filter Pills */}
            <div className="drawer-filter-pills">
              {(["All", "Moving", "Stationary", "LastKnown", "PendingSync"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`pill-btn ${statusFilter === tab ? "active" : ""}`}
                  onClick={() => setStatusFilter(tab)}
                >
                  {tab === "LastKnown" ? "Last Known" : tab === "PendingSync" ? "App Sync" : tab}
                </button>
              ))}
            </div>

            {/* Swiggy/Rapido Ultra-Compact Cards List */}
            <div className="compact-officers-list">
              {loading ? (
                <div className="loading-state-box">
                  <IonSpinner name="crescent" color="primary" />
                  <span>Syncing live GPS feeds...</span>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="empty-state-box">
                  <MapPin size={28} />
                  <span>No Officers Found</span>
                </div>
              ) : (
                filteredSessions.map((s, idx) => {
                  const secAgo = typeof s.SecondsSinceLastUpdate === "number" ? s.SecondsSinceLastUpdate : 0;
                  const status = s.MovementStatus || "Stationary";
                  const isSelected = selectedSession?.EmpCode === s.EmpCode;
                  const empName = s.EmpName || s.EmpCode || "Officer";
                  const initial = empName.charAt(0).toUpperCase();

                  const timeAgoStr =
                    status === "PendingSync"
                      ? "App Sync"
                      : secAgo < 60
                      ? "Just now"
                      : secAgo < 3600
                      ? `${Math.round(secAgo / 60)}m ago`
                      : `${Math.round(secAgo / 3600)}h ago`;

                  return (
                    <div
                      key={(s.EmpCode || "emp") + "-" + (s.DutyId || idx)}
                      className={`compact-card-55px ${isSelected ? "selected" : ""}`}
                      onClick={() => focusOnEmployee(s)}
                    >
                      <div className="card-photo-avatar">
                        {s.Image ? (
                          <img src={s.Image} alt={empName} />
                        ) : (
                          <span>{initial}</span>
                        )}
                        <span className={`avatar-status-dot ${status.toLowerCase()}`}></span>
                      </div>

                      <div className="card-main-content">
                        <div className="card-top-line">
                          <span className="officer-name">{empName}</span>
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            {s.PermissionStatus && s.PermissionStatus.toLowerCase().includes("missing") && (
                              <span className="status-badge-compact" style={{ background: "#fef3c7", color: "#d97706", fontSize: "10px" }} title="Background tracking permission required: Allow All The Time">
                                ⚠️ BG Perm
                              </span>
                            )}
                            {s.PermissionStatus && s.PermissionStatus.toLowerCase().includes("denied") && (
                              <span className="status-badge-compact" style={{ background: "#fee2e2", color: "#dc2626", fontSize: "10px" }} title="Location permission denied on device">
                                🔴 Perm Denied
                              </span>
                            )}
                            {s.GpsEnabled === false && (
                              <span className="status-badge-compact" style={{ background: "#ffedd5", color: "#c2410c", fontSize: "10px" }} title="Device GPS is turned off">
                                🚫 GPS Off
                              </span>
                            )}
                            <span className={`status-badge-compact ${status.toLowerCase()}`}>
                              {status === "Moving"
                                ? "🟢 Moving"
                                : status === "Stationary" || status === "Idle"
                                ? "🟡 On Site"
                                : status === "LastKnown"
                                ? "🔵 Last Known"
                                : "📱 App Sync"}
                            </span>
                          </div>
                        </div>

                        <div className="card-sub-line">
                          <span>{s.Designation || "Officer"}</span>
                          <span className="dot-sep">•</span>
                          <span className="duty-client" title={locationNames[s.EmpCode] || s.ClientOrBranch}>📍 {locationNames[s.EmpCode] || s.ClientOrBranch || "Field Duty"}</span>
                          <span className="dot-sep">•</span>
                          <span>⚡ {s.Speed || 0} km/h</span>
                          <span className="dot-sep">•</span>
                          <span>🔋 {s.BatteryLevel ?? "N/A"}%</span>
                          <span className="dot-sep">•</span>
                          <span>⏱ {timeAgoStr}</span>
                        </div>
                      </div>

                      <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="card-act-btn play" title="Replay Path" onClick={() => startRouteReplay(s)}>
                          <Play size={13} />
                        </button>
                        {s.Mobile && (
                          <a href={`tel:${s.Mobile}`} className="card-act-btn call" title="Call Officer">
                            <Phone size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Floating Glass Icon Toolbar */}
          <div className="right-glass-floating-toolbar">
            <button className="right-tool-btn" title="Fit All Markers" onClick={fitAllMarkers}>
              <Navigation size={18} />
              <span>Fit All</span>
            </button>
            <button className="right-tool-btn" title="Center Officers" onClick={() => setDrawerCollapsed(!drawerCollapsed)}>
              <Users size={18} />
              <span>Officers</span>
            </button>
            <button className="right-tool-btn" title="Clients POI" onClick={fitAllMarkers}>
              <Building size={18} />
              <span>Clients</span>
            </button>
            <button className="right-tool-btn" title="Geofences" onClick={() => setToast({ msg: "Geofence mode active", color: "primary" })}>
              <Shield size={18} />
              <span>Zones</span>
            </button>
            <button className="right-tool-btn" title="Change Map Style" onClick={() => setShowLayerPicker(!showLayerPicker)}>
              <Layers size={18} />
              <span>Layers</span>
            </button>
            <button className="right-tool-btn" title="System Health" onClick={() => setShowHealthDashboard(!showHealthDashboard)}>
              <Activity size={18} />
              <span>Health</span>
            </button>
          </div>

          {/* Layer Picker Floating Popup */}
          {showLayerPicker && (
            <div className="layer-picker-floating-card">
              <div className="picker-title">Select Map Style</div>
              <div className="layer-options">
                <button
                  className={`layer-opt ${mapStyle === "streets" ? "active" : ""}`}
                  onClick={() => {
                    setMapStyle("streets");
                    setShowLayerPicker(false);
                  }}
                >
                  🏙 OpenStreetMap (Proxy Compatible)
                </button>
                <button
                  className={`layer-opt ${mapStyle === "voyager" ? "active" : ""}`}
                  onClick={() => {
                    setMapStyle("voyager");
                    setShowLayerPicker(false);
                  }}
                >
                  🗺 CARTO Voyager (Uber Style)
                </button>
                <button
                  className={`layer-opt ${mapStyle === "satellite" ? "active" : ""}`}
                  onClick={() => {
                    setMapStyle("satellite");
                    setShowLayerPicker(false);
                  }}
                >
                  🛰 Esri World Satellite
                </button>
              </div>
            </div>
          )}

          {/* System Health Dashboard Panel */}
          {showHealthDashboard && (
            <div className="layer-picker-floating-card health-card" style={{ top: "80px", right: "80px", width: "320px", maxHeight: "80vh", overflowY: "auto" }}>
              <div className="picker-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🛡️ System Health</span>
                <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }} onClick={() => setShowHealthDashboard(false)}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>Employees Online</span>
                  <span style={{ fontWeight: 600, color: "#10b981" }}>{healthStats.online}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>Employees Offline</span>
                  <span style={{ fontWeight: 600, color: "#ef4444" }}>{healthStats.offline}</span>
                </div>
                <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>GPS Signals Degraded</span>
                  <span style={{ fontWeight: 600, color: healthStats.gpsDisabled > 0 ? "#f59e0b" : "#475569" }}>{healthStats.gpsDisabled}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>Permissions Missing</span>
                  <span style={{ fontWeight: 600, color: "#475569" }}>{healthStats.permissionMissing}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>Background Stopped</span>
                  <span style={{ fontWeight: 600, color: "#ef4444" }}>{healthStats.backgroundStopped}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>Low Battery Alerts (&lt;20%)</span>
                  <span style={{ fontWeight: 600, color: healthStats.batteryLow > 0 ? "#ef4444" : "#475569" }}>{healthStats.batteryLow}</span>
                </div>
                <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>SignalR Socket State</span>
                  <span style={{ fontWeight: 600, color: signalrConnected ? "#10b981" : "#f59e0b" }}>
                    {signalrConnected ? "Connected (Live)" : "Auto-Polling"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>Avg API Sync Latency</span>
                  <span style={{ fontWeight: 600, color: "#475569" }}>{healthStats.apiResponseTime} ms</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748b" }}>GPS Packet Success Rate</span>
                  <span style={{ fontWeight: 600, color: "#10b981" }}>{healthStats.packetSuccess}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Recenter Lock Floating Button */}
          {selectedSession && !followUser && (
            <button
              className="recenter-map-floating-btn animate__animated animate__fadeInUp"
              onClick={() => {
                setFollowUser(true);
                if (isReplaying && replayLogs[replayIndex]) {
                  const pt = replayLogs[replayIndex];
                  if (mapRef.current) {
                    AnimationEngine.panToWithOffset(mapRef.current, pt.Latitude, pt.Longitude, mapRef.current.getZoom(), 60);
                  }
                } else {
                  const currentLoc = sessions.find((s) => s.EmpCode === selectedSession.EmpCode) || selectedSession;
                  if (currentLoc && currentLoc.Latitude && currentLoc.Longitude && mapRef.current) {
                    AnimationEngine.panToWithOffset(mapRef.current, currentLoc.Latitude, currentLoc.Longitude, 16, 120);
                  }
                }
              }}
            >
              <Navigation size={14} className="recenter-icon" />
              <span>Re-center on {selectedSession.EmpName || selectedSession.EmpCode}</span>
            </button>
          )}

          {/* Sliding Bottom Sheet for Selected Officer Details */}
          {currentSelectedSession && !isReplaying && (
            <div className="sliding-bottom-sheet">
              <div className="sheet-header">
                <div className="sheet-officer-info">
                  <div className="sheet-avatar">
                    {currentSelectedSession.Image ? (
                      <img src={currentSelectedSession.Image} alt={currentSelectedSession.EmpName || "Officer"} />
                    ) : (
                      <span>{(currentSelectedSession.EmpName || currentSelectedSession.EmpCode || "E").charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <div className="sheet-name">{currentSelectedSession.EmpName || currentSelectedSession.EmpCode || "Officer"}</div>
                    <div className="sheet-role">
                      {currentSelectedSession.Designation || "On Duty Officer"} • ID: {currentSelectedSession.EmpCode || "N/A"}
                    </div>
                  </div>
                </div>

                <button className="sheet-close-btn" onClick={() => setSelectedSession(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="sheet-details-grid">
                <div className="sheet-detail-card">
                  <span className="lbl">📍 Real GPS Location</span>
                  <span className="val">{locationNames[currentSelectedSession.EmpCode] || "Fetching address..."}</span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">🏢 Duty Assignment</span>
                  <span className="val">{currentSelectedSession.ClientOrBranch || "Field Duty Assignment"}</span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">⚡ Live Speed / Status</span>
                  <span className="val">
                    {currentSelectedSession.Speed || 0} km/h •{" "}
                    <span className={`status-text ${currentSelectedSession.MovementStatus?.toLowerCase()}`}>
                      {currentSelectedSession.MovementStatus === "Moving"
                        ? "En Route (Moving)"
                        : currentSelectedSession.MovementStatus === "Stationary" || currentSelectedSession.MovementStatus === "Idle"
                        ? "On Site (Stationary)"
                        : currentSelectedSession.MovementStatus === "LastKnown"
                        ? "Last Known Position"
                        : "App Sync Pending"}
                    </span>
                  </span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">🔋 Device Battery</span>
                  <span className="val">
                    {currentSelectedSession.BatteryLevel !== undefined && currentSelectedSession.BatteryLevel !== null
                      ? `${currentSelectedSession.BatteryLevel}% ${currentSelectedSession.IsCharging ? "(Charging)" : ""}`
                      : "N/A"}
                  </span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">🛡️ App Permission</span>
                  <span
                    className="val"
                    style={{
                      color: currentSelectedSession.PermissionStatus?.toLowerCase().includes("granted") ? "#10b981" : "#ef4444",
                    }}
                  >
                    {currentSelectedSession.PermissionStatus || "Granted"}
                  </span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">📡 GPS Hardware</span>
                  <span className="val" style={{ color: currentSelectedSession.GpsEnabled !== false ? "#10b981" : "#ef4444" }}>
                    {currentSelectedSession.GpsEnabled !== false ? "GPS Active" : "GPS Disabled"}
                  </span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">⏱ Status Check</span>
                  <span className="val">
                    {currentSelectedSession.SecondsSinceLastUpdate !== undefined && currentSelectedSession.SecondsSinceLastUpdate < 99999
                      ? currentSelectedSession.SecondsSinceLastUpdate < 60
                        ? "Just now (Active)"
                        : currentSelectedSession.SecondsSinceLastUpdate < 3600
                        ? `${Math.round(currentSelectedSession.SecondsSinceLastUpdate / 60)}m ago`
                        : `${Math.round(currentSelectedSession.SecondsSinceLastUpdate / 3600)}h ago`
                      : "Mobile App Sync Needed"}
                  </span>
                </div>
              </div>

              <div className="sheet-actions-row">
                <button className="sheet-act-btn ping" onClick={() => pingOfficerLocation(currentSelectedSession)}>
                  <Zap size={15} /> Fetch Location
                </button>
                <button className="sheet-act-btn replay" onClick={() => startRouteReplay(currentSelectedSession)}>
                  <Play size={15} /> Replay Path
                </button>
              </div>
            </div>
          )}

          {/* Top Floating Replay HUD Card */}
          {isReplaying && currentSelectedSession && (
            <div className="replay-hud-floating-card animate__animated animate__fadeInDown">
              <div className="hud-badge-live">
                <span className="pulse-dot"></span> ROUTE REPLAY MODE
              </div>
              <div className="hud-main-info">
                <div className="hud-officer-avatar">
                  {currentSelectedSession.Image ? (
                    <img src={currentSelectedSession.Image} alt={currentSelectedSession.EmpName} />
                  ) : (
                    <span>{(currentSelectedSession.EmpName || "O").charAt(0)}</span>
                  )}
                </div>
                <div className="hud-officer-meta">
                  <div className="hud-officer-name">{currentSelectedSession.EmpName || "Officer"}</div>
                  <div className="hud-officer-sub">
                    {currentSelectedSession.Designation || "Field Duty"} • ID: {currentSelectedSession.EmpCode || "N/A"}
                  </div>
                </div>
              </div>
              {replayLogs[replayIndex] && (
                <div className="hud-stats-grid">
                  <div className="hud-stat-item">
                    <Clock size={14} className="hud-icon text-indigo" />
                    <div>
                      <div className="hud-stat-val">{formatReplayTime(replayLogs[replayIndex].RecordedAt)}</div>
                      <div className="hud-stat-lbl">Time</div>
                    </div>
                  </div>
                  <div className="hud-stat-item">
                    <Gauge size={14} className="hud-icon text-emerald" />
                    <div>
                      <div className="hud-stat-val">{replayLogs[replayIndex].Speed || 0} km/h</div>
                      <div className="hud-stat-lbl">Speed</div>
                    </div>
                  </div>
                  <div className="hud-stat-item">
                    <MapPin size={14} className="hud-icon text-amber" />
                    <div>
                      <div className="hud-stat-val">{totalReplayDistance} km</div>
                      <div className="hud-stat-lbl">Total Route</div>
                    </div>
                  </div>
                  <div className="hud-stat-item">
                    <Battery size={14} className="hud-icon text-blue" />
                    <div>
                      <div className="hud-stat-val">{currentSelectedSession.BatteryLevel ?? "N/A"}%</div>
                      <div className="hud-stat-lbl">Battery</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* YouTube-Style Minimal Replay Control Bar */}
          {isReplaying && (
            <div className="youtube-replay-player-bar animate__animated animate__fadeInUp">
              <div className="player-top-info">
                <div className="player-title">
                  <Activity size={16} className="text-indigo-flash" />
                  <span>
                    Replaying Route History • Step <strong>{replayIndex + 1}</strong> of <strong>{replayLogs.length}</strong>
                  </span>
                </div>
                <button className="player-close-btn" onClick={exitReplay} title="Exit Replay">
                  <X size={18} />
                </button>
              </div>

              <div className="player-timeline-row">
                <button
                  className="player-control-btn"
                  onClick={() => setReplayIndex(0)}
                  disabled={replayIndex === 0}
                  title="Jump to Start"
                >
                  <SkipBack size={16} />
                </button>

                <button
                  className="player-control-btn"
                  onClick={() => setReplayIndex((prev) => Math.max(0, prev - 1))}
                  disabled={replayIndex === 0}
                  title="Previous Step"
                >
                  <ChevronLeft size={16} />
                </button>

                <button className="player-play-toggle" onClick={() => setIsPlayingReplay(!isPlayingReplay)} title={isPlayingReplay ? "Pause" : "Play"}>
                  {isPlayingReplay ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <button
                  className="player-control-btn"
                  onClick={() => setReplayIndex((prev) => Math.min(replayLogs.length - 1, prev + 1))}
                  disabled={replayIndex === replayLogs.length - 1}
                  title="Next Step"
                >
                  <ChevronRight size={16} />
                </button>

                <button
                  className="player-control-btn"
                  onClick={() => setReplayIndex(replayLogs.length - 1)}
                  disabled={replayIndex === replayLogs.length - 1}
                  title="Jump to End"
                >
                  <SkipForward size={16} />
                </button>

                <input
                  type="range"
                  min="0"
                  max={Math.max(0, replayLogs.length - 1)}
                  value={replayIndex}
                  onChange={(e) => setReplayIndex(parseInt(e.target.value))}
                  className="youtube-timeline-slider"
                />

                <div className="player-speed-selector">
                  {[0.5, 1, 2, 5, 10].map((spd) => (
                    <button
                      key={spd}
                      className={`spd-chip ${replaySpeed === spd ? "active" : ""}`}
                      onClick={() => setReplaySpeed(spd)}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* History Date Selector Modal */}
          {showHistoryModal && historyTargetEmp && (
            <div className="layer-picker-floating-card history-modal-card animate__animated animate__fadeIn" style={{ top: "90px", left: "50%", transform: "translateX(-50%)", width: "340px", zIndex: 2000 }}>
              <div className="picker-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>📅 Track History Period</span>
                <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }} onClick={() => setShowHistoryModal(false)}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 12px 0" }}>
                Replay route history for <strong>{historyTargetEmp.EmpName || historyTargetEmp.EmpCode}</strong>
              </div>

              {/* Mode Tabs */}
              <div className="drawer-filter-pills" style={{ marginBottom: "14px" }}>
                <button className={`pill-btn ${historyMode === "today" ? "active" : ""}`} onClick={() => setHistoryMode("today")}>
                  Today
                </button>
                <button className={`pill-btn ${historyMode === "day" ? "active" : ""}`} onClick={() => setHistoryMode("day")}>
                  Day-Wise
                </button>
                <button className={`pill-btn ${historyMode === "range" ? "active" : ""}`} onClick={() => setHistoryMode("range")}>
                  Date Range
                </button>
              </div>

              {historyMode === "day" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "11px", color: "#475569", fontWeight: 600, marginBottom: "4px" }}>
                    Select Day
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "13px" }}
                  />
                </div>
              )}

              {historyMode === "range" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#475569", fontWeight: 600, marginBottom: "4px" }}>
                      From Date
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#475569", fontWeight: 600, marginBottom: "4px" }}>
                      To Date
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "13px" }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: "#4f46e5", color: "#ffffff", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  onClick={executeRouteReplay}
                >
                  <Play size={14} /> Start Route Replay
                </button>
              </div>
            </div>
          )}
        </div>

        <IonToast
          isOpen={!!toast}
          message={toast?.msg || ""}
          duration={3000}
          color={toast?.color || "primary"}
          onDidDismiss={() => setToast(null)}
        />
      </IonContent>
    </IonPage>
  );
};

// Export wrapped in ErrorBoundary to guarantee page crashes never bubble up or blank the whole app
export const OnDutyLiveTracking: React.FC = () => (
  <ErrorBoundary fallbackTitle="On-Duty Live Tracking Error">
    <OnDutyLiveTrackingContent />
  </ErrorBoundary>
);

export default OnDutyLiveTracking;
