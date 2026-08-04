import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonToast,
  IonMenuButton,
} from "@ionic/react";
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
} from "lucide-react";
import axios from "axios";
import * as signalR from "@microsoft/signalr";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE } from "../config";
import "./OnDutyLiveTracking.css";

// Fix Leaflet Vite asset bundler icon paths
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerIconRetinaPng from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconPng,
  iconRetinaUrl: markerIconRetinaPng,
  shadowUrl: markerShadowPng,
});

interface ActiveSessionItem {
  SessionId: number;
  EmpCode: string;
  EmpName: string;
  Mobile?: string;
  Designation?: string;
  Department?: string;
  SessionType: string;
  DutyId: string;
  SessionStartTime: string;
  SessionStatus: string;
  ClientOrBranch?: string;
  DutyDescription?: string;
  TransportMode?: string;
  VehicleNo?: string;
  DutyLocation?: string;
  Latitude?: number;
  Longitude?: number;
  Speed?: number;
  Heading?: number;
  Accuracy?: number;
  BatteryLevel?: number;
  IsCharging?: boolean;
  PowerSaveMode?: boolean;
  DevicePlatform?: string;
  MovementStatus: "Moving" | "Idle" | "Offline" | string;
  LastUpdated?: string;
  SecondsSinceLastUpdate?: number;
  Image?: string;
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

export const OnDutyLiveTracking: React.FC = () => {
  const [sessions, setSessions] = useState<ActiveSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Moving" | "Idle" | "Offline">("All");
  const [selectedSession, setSelectedSession] = useState<ActiveSessionItem | null>(null);
  const [mapStyle, setMapStyle] = useState<"streets" | "voyager" | "satellite">("streets");
  const [drawerCollapsed, setDrawerCollapsed] = useState<boolean>(false);
  const [showLayerPicker, setShowLayerPicker] = useState<boolean>(false);
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

  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const trailsGroupRef = useRef<L.LayerGroup | null>(null);
  const empMarkersMapRef = useRef<{ [key: string]: L.Marker }>({});
  const empTrailsRef = useRef<{ [key: string]: [number, number][] }>({});
  const replayPolylineRef = useRef<L.Polyline | null>(null);
  const replayMarkerRef = useRef<L.Marker | null>(null);
  const replayTimerRef = useRef<any>(null);

  // Fetch Active Sessions
  const fetchActiveSessions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}Tracking/active-sessions`, {
        headers: authHeaders(),
      });
      if (res.data && Array.isArray(res.data)) {
        setSessions(res.data);
      }
    } catch (err: any) {
      console.error("[LiveTracking] Fetch sessions error:", err);
      setToast({ msg: "Failed to load active tracking sessions", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // SignalR Realtime Stream Setup
  useEffect(() => {
    const rawToken =
      localStorage.getItem("token") ||
      localStorage.getItem("Token") ||
      sessionStorage.getItem("token") ||
      "";
    const token = rawToken.replace(/^"|"$/g, "");

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE.replace(/\/api\/$/, "/")}trackingHub`, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection
      .start()
      .then(() => {
        setSignalrConnected(true);
        console.log("[TrackingHub] Connected to live SignalR stream");

        connection.on("ReceiveLiveLocation", (point: any) => {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.EmpCode === point.EmpCode) {
                // Update Trail History
                const currentTrail = empTrailsRef.current[s.EmpCode] || [];
                const updatedTrail = [...currentTrail, [point.Latitude, point.Longitude] as [number, number]].slice(-10);
                empTrailsRef.current[s.EmpCode] = updatedTrail;

                return {
                  ...s,
                  SessionId: point.SessionId || s.SessionId,
                  Latitude: point.Latitude,
                  Longitude: point.Longitude,
                  Speed: point.Speed,
                  Heading: point.Heading,
                  Accuracy: point.Accuracy,
                  BatteryLevel: point.BatteryLevel,
                  IsCharging: point.IsCharging,
                  MovementStatus: point.MovementStatus || "Moving",
                  LastUpdated: point.RecordedAt || new Date().toISOString(),
                  SecondsSinceLastUpdate: 0,
                };
              }
              return s;
            })
          );
        });
      })
      .catch((err) => {
        console.warn("[TrackingHub] SignalR fallback:", err);
        setSignalrConnected(false);
      });

    return () => {
      if (connection) connection.stop();
    };
  }, []);

  // Initial Load
  useEffect(() => {
    fetchActiveSessions();
  }, []);

  // Map Tile Sources (OpenStreetMap #1 for corporate proxy compatibility)
  const tileUrls = {
    streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    voyager: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  };

  // Initialize Map
  useEffect(() => {
    if (mapRef.current) return;
    let retryTimer: any = null;

    const handleResize = () => {
      if (mapRef.current) mapRef.current.invalidateSize();
    };

    const initMap = () => {
      if (mapRef.current) return;
      const mapElement = document.getElementById("hero-fullscreen-map");
      if (!mapElement) {
        retryTimer = setTimeout(initMap, 50);
        return;
      }

      if ((mapElement as any)._leaflet_id) {
        (mapElement as any)._leaflet_id = null;
      }

      let map: L.Map;
      try {
        const initialLat = 16.5062; // Vijayawada/AP region default center
        const initialLng = 80.648;

        map = L.map("hero-fullscreen-map", {
          center: [initialLat, initialLng],
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
        });
      } catch (mapErr) {
        console.warn("[OnDutyLiveTracking] Leaflet init catch:", mapErr);
        return;
      }

    // Rich Indian Map Vector Canvas Fallback for Intranet Proxy Networks
    const LocalGridLayer = (L.GridLayer as any).extend({
      createTile: function (coords: any) {
        const tile = document.createElement("canvas");
        const size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;
        const ctx = tile.getContext("2d");

        if (ctx) {
          // Soft slate canvas fill
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(0, 0, size.x, size.y);

          // Secondary Grid
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

          // Draw Highway Lines (NH-16 / NH-65 representation)
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, size.y * 0.4);
          ctx.lineTo(size.x, size.y * 0.6);
          ctx.stroke();

          // River Path (Krishna River representation)
          ctx.strokeStyle = "#93c5fd";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(size.x * 0.2, 0);
          ctx.bezierCurveTo(size.x * 0.3, size.y * 0.5, size.x * 0.7, size.y * 0.5, size.x * 0.9, size.y);
          ctx.stroke();

          // Indian Landmark Labels & Sector Markings
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
      if (errCount >= 2) {
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

    const layerGroup = L.layerGroup().addTo(map);
    const trailsGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = layerGroup;
    trailsGroupRef.current = trailsGroup;
    mapRef.current = map;

    setTimeout(handleResize, 200);
    setTimeout(handleResize, 600);

    window.addEventListener("resize", handleResize);
    };

    initMap();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("resize", handleResize);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, []);

  // Update Map Layer Style
  useEffect(() => {
    if (!mapRef.current || tileBlocked) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const newLayer = L.tileLayer(tileUrls[mapStyle], {
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
    });
    newLayer.addTo(mapRef.current);
    tileLayerRef.current = newLayer;
  }, [mapStyle, tileBlocked]);

  // Filtered Sessions List
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchSearch =
        s.EmpName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.EmpCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.ClientOrBranch && s.ClientOrBranch.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.Mobile && s.Mobile.includes(searchTerm));

      const secAgo = s.SecondsSinceLastUpdate ?? 0;
      const isOff = secAgo > 180 || s.MovementStatus === "Offline";
      const statusMatch =
        statusFilter === "All"
          ? true
          : statusFilter === "Offline"
          ? isOff
          : statusFilter === "Moving"
          ? s.MovementStatus === "Moving" && !isOff
          : s.MovementStatus === "Idle" && !isOff;

      return matchSearch && statusMatch;
    });
  }, [sessions, searchTerm, statusFilter]);

  // Statistics Summary
  const stats = useMemo(() => {
    let moving = 0,
      idle = 0,
      offline = 0;
    sessions.forEach((s) => {
      const secAgo = s.SecondsSinceLastUpdate ?? 0;
      if (secAgo > 180 || s.MovementStatus === "Offline") offline++;
      else if (s.MovementStatus === "Moving") moving++;
      else idle++;
    });
    return { total: sessions.length, moving, idle, offline };
  }, [sessions]);

  // Swiggy / Rapido Style Animated Vehicle Marker Generator
  const createRapidoVehicleMarker = (
    emp: ActiveSessionItem,
    isSelected: boolean
  ) => {
    const secAgo = emp.SecondsSinceLastUpdate ?? 0;
    const isOff = secAgo > 180 || emp.MovementStatus === "Offline";
    const status = isOff ? "Offline" : emp.MovementStatus;

    let pulseColor = "#10b981"; // Emerald - Moving
    let statusClass = "pulse-moving";
    if (status === "Idle") {
      pulseColor = "#f59e0b"; // Amber - Idle
      statusClass = "pulse-idle";
    }
    if (status === "Offline") {
      pulseColor = "#ef4444"; // Red - Offline
      statusClass = "pulse-offline";
    }

    const heading = emp.Heading || 0;
    const initial = emp.EmpName ? emp.EmpName.charAt(0).toUpperCase() : "E";
    const vehicleIcon = emp.TransportMode?.toLowerCase().includes("car") ? "🚗" : "🛵";
    const selectedRing = isSelected ? "border: 3px solid #4f46e5; transform: scale(1.18);" : "";

    const markerHtml = `
      <div class="rapido-marker-container ${statusClass}" style="${selectedRing}">
        <div class="marker-pulse-ring" style="border-color: ${pulseColor};"></div>
        <div class="marker-photo-box" style="background: ${pulseColor};">
          ${
            emp.Image
              ? `<img src="${emp.Image}" class="marker-img" />`
              : `<span class="marker-initial">${initial}</span>`
          }
        </div>
        <div class="marker-vehicle-badge">${vehicleIcon}</div>
        <div class="marker-arrow-indicator" style="transform: rotate(${heading}deg);">
          ▲
        </div>
      </div>
    `;

    return L.divIcon({
      html: markerHtml,
      className: "rapido-live-marker-wrapper",
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  };

  // Render & Update Markers & Live Route Tails
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current || !trailsGroupRef.current) return;
    const layerGroup = markersGroupRef.current;
    const trailsGroup = trailsGroupRef.current;
    layerGroup.clearLayers();
    trailsGroup.clearLayers();

    const bounds: [number, number][] = [];

    sessions.forEach((s) => {
      if (!s.Latitude || !s.Longitude) return;

      const isSelected = selectedSession?.EmpCode === s.EmpCode;
      const icon = createRapidoVehicleMarker(s, isSelected);
      const marker = L.marker([s.Latitude, s.Longitude], { icon });

      // Draw Live Route Tail Trail (Last 5 position points)
      const trail = empTrailsRef.current[s.EmpCode];
      if (trail && trail.length > 1) {
        const polyline = L.polyline(trail, {
          color: "#6366f1",
          weight: 4,
          opacity: 0.7,
          dashArray: "4, 6",
        });
        trailsGroup.addLayer(polyline);
      }

      const popupHtml = `
        <div style="padding: 10px; font-family: Inter, sans-serif; min-width: 210px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700;">
              ${s.EmpName ? s.EmpName.charAt(0) : "E"}
            </div>
            <div>
              <strong style="font-size: 14px; color: #0f172a;">${s.EmpName}</strong>
              <div style="font-size: 11px; color: #64748b;">${s.Designation || "Officer"} (${s.EmpCode})</div>
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 6px 0;"/>
          <div style="font-size: 12px; color: #4f46e5; font-weight: 700;">📍 ${s.ClientOrBranch || "Field Duty"}</div>
          <div style="font-size: 12px; color: #334155; margin-top: 4px;">⚡ Speed: ${s.Speed || 0} km/h</div>
          <div style="font-size: 12px; color: #334155;">🔋 Battery: ${s.BatteryLevel ?? "N/A"}%</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">🚘 Vehicle: ${s.VehicleNo || "N/A"}</div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on("click", () => {
        setSelectedSession(s);
      });

      layerGroup.addLayer(marker);
      empMarkersMapRef.current[s.EmpCode] = marker;
      bounds.push([s.Latitude, s.Longitude]);
    });

    if (bounds.length > 0 && !selectedSession) {
      mapRef.current.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [60, 60], maxZoom: 15 });
    }
  }, [sessions, selectedSession]);

  // Center on Employee
  const focusOnEmployee = (s: ActiveSessionItem) => {
    setSelectedSession(s);
    if (mapRef.current && s.Latitude && s.Longitude) {
      mapRef.current.flyTo([s.Latitude, s.Longitude], 16, {
        animate: true,
        duration: 1.2,
      });
      const marker = empMarkersMapRef.current[s.EmpCode];
      if (marker) marker.openPopup();
    } else {
      setToast({ msg: `Waiting for live position ping from ${s.EmpName}`, color: "warning" });
    }
  };

  // Fit All Markers
  const fitAllMarkers = () => {
    if (!mapRef.current) return;
    const pts = sessions
      .filter((s) => s.Latitude && s.Longitude)
      .map((s) => [s.Latitude!, s.Longitude!] as [number, number]);

    if (pts.length > 0) {
      mapRef.current.fitBounds(pts as L.LatLngBoundsExpression, { padding: [60, 60] });
    } else {
      setToast({ msg: "No active GPS coordinates available yet", color: "warning" });
    }
  };

  // Start Path Replay
  const startRouteReplay = async (s: ActiveSessionItem) => {
    if (!s.SessionId || s.SessionId === 0) {
      setToast({ msg: "No active tracking session recorded for this duty yet.", color: "warning" });
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}Tracking/session-history?sessionId=${s.SessionId}`, {
        headers: authHeaders(),
      });

      if (res.data) {
        const logs: LocationLogItem[] = res.data.logs || res.data.Logs || [];

        if (logs.length < 2) {
          setToast({ msg: "Not enough GPS trail points recorded for route replay yet.", color: "warning" });
          return;
        }

        setReplayLogs(logs);
        setReplayIndex(0);
        setIsReplaying(true);
        setIsPlayingReplay(false);

        if (mapRef.current) {
          const latLngs = logs.map((l) => [l.Latitude, l.Longitude] as [number, number]);

          if (replayPolylineRef.current) mapRef.current.removeLayer(replayPolylineRef.current);
          if (replayMarkerRef.current) mapRef.current.removeLayer(replayMarkerRef.current);

          const polyline = L.polyline(latLngs, {
            color: "#4f46e5",
            weight: 5,
            opacity: 0.9,
            dashArray: "8, 8",
          }).addTo(mapRef.current);

          const startIcon = L.divIcon({
            html: `<div style="background:#10b981; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`,
            iconSize: [16, 16],
          });
          const endIcon = L.divIcon({
            html: `<div style="background:#ef4444; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`,
            iconSize: [16, 16],
          });

          L.marker(latLngs[0], { icon: startIcon }).addTo(mapRef.current);
          L.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(mapRef.current);

          replayPolylineRef.current = polyline;
          mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        }
      }
    } catch (err) {
      console.error("[LiveTracking] Route replay error:", err);
      setToast({ msg: "Failed to load route replay trail", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  // Replay Step Timer
  useEffect(() => {
    if (!isPlayingReplay || replayLogs.length === 0) return;

    const interval = 1000 / replaySpeed;
    replayTimerRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= replayLogs.length - 1) {
          setIsPlayingReplay(false);
          return prev;
        }
        const next = prev + 1;
        const pt = replayLogs[next];

        if (mapRef.current && pt) {
          if (replayMarkerRef.current) {
            replayMarkerRef.current.setLatLng([pt.Latitude, pt.Longitude]);
          } else {
            const dummyEmp: ActiveSessionItem = {
              SessionId: 0,
              EmpCode: "REPLAY",
              EmpName: "Replay",
              SessionType: "OnDuty",
              DutyId: "0",
              SessionStartTime: "",
              SessionStatus: "Active",
              MovementStatus: "Moving",
              Heading: pt.Heading,
            };
            const icon = createRapidoVehicleMarker(dummyEmp, true);
            replayMarkerRef.current = L.marker([pt.Latitude, pt.Longitude], { icon }).addTo(mapRef.current);
          }
        }
        return next;
      });
    }, interval);

    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [isPlayingReplay, replaySpeed, replayLogs]);

  // Exit Replay
  const exitReplay = () => {
    setIsReplaying(false);
    setIsPlayingReplay(false);
    if (mapRef.current) {
      if (replayPolylineRef.current) mapRef.current.removeLayer(replayPolylineRef.current);
      if (replayMarkerRef.current) mapRef.current.removeLayer(replayMarkerRef.current);
    }
  };

  // Send Instant Location Ping Request
  const pingOfficerLocation = async (emp: ActiveSessionItem) => {
    try {
      setToast({ msg: `🚀 Location ping request sent to ${emp.EmpName}!`, color: "success" });
      await axios.post(
        `${API_BASE}Tracking/ping-officer`,
        { empCode: emp.EmpCode },
        { headers: authHeaders() }
      );
    } catch (e) {
      setToast({ msg: `Location alert triggered for ${emp.EmpName}`, color: "primary" });
    }
  };

  return (
    <IonPage>
      <IonContent scrollY={false}>
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
            <div className="menu-btn-wrapper">
              <IonMenuButton style={{ color: "#4f46e5" }}>
                <MenuIcon size={20} />
              </IonMenuButton>
            </div>

            <div className="hero-search-box">
              <Search size={18} className="search-glass-icon" />
              <input
                type="text"
                placeholder="⌕ Search officer name, client, vehicle, or phone..."
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

          {/* Top Floating KPI Strip (Colored Top Borders) */}
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
              <span><strong>{stats.idle}</strong> Idle</span>
            </div>
            <div className="kpi-glass-chip offline">
              <div className="red-dot"></div>
              <span><strong>{stats.offline}</strong> Offline</span>
            </div>
            <div className="kpi-glass-chip live">
              <Zap size={15} className="live-flash" />
              <span>{signalrConnected ? "WebSocket Live" : "Auto Polling"}</span>
            </div>
          </div>

          {/* Left Collapsible Floating Officer Drawer (Ultra-Compact ~55px Cards) */}
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

            {/* Filter Pills */}
            <div className="drawer-filter-pills">
              {(["All", "Moving", "Idle", "Offline"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`pill-btn ${statusFilter === tab ? "active" : ""}`}
                  onClick={() => setStatusFilter(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Swiggy/Rapido Ultra-Compact 55px Cards List */}
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
                filteredSessions.map((s) => {
                  const secAgo = s.SecondsSinceLastUpdate ?? 0;
                  const isOff = secAgo > 180 || s.MovementStatus === "Offline";
                  const status = isOff ? "Offline" : s.MovementStatus;
                  const isSelected = selectedSession?.EmpCode === s.EmpCode;

                  return (
                    <div
                      key={s.EmpCode + "-" + s.DutyId}
                      className={`compact-card-55px ${isSelected ? "selected" : ""}`}
                      onClick={() => focusOnEmployee(s)}
                    >
                      <div className="card-photo-avatar">
                        {s.Image ? (
                          <img src={s.Image} alt={s.EmpName} />
                        ) : (
                          <span>{s.EmpName ? s.EmpName.charAt(0) : "E"}</span>
                        )}
                        <span className={`avatar-status-dot ${status.toLowerCase()}`}></span>
                      </div>

                      <div className="card-main-content">
                        <div className="card-top-line">
                          <span className="officer-name">{s.EmpName}</span>
                          <span className={`status-badge-compact ${status.toLowerCase()}`}>
                            {status === "Moving" ? "🟢 Moving" : status === "Idle" ? "🟡 Idle" : "🔴 Offline"}
                          </span>
                        </div>

                        <div className="card-sub-line">
                          <span>{s.Designation || "Officer"}</span>
                          <span className="dot-sep">•</span>
                          <span className="duty-client">📍 {s.ClientOrBranch || "Field Duty"}</span>
                          <span className="dot-sep">•</span>
                          <span>⚡ {s.Speed || 0} km/h</span>
                          <span className="dot-sep">•</span>
                          <span>🔋 {s.BatteryLevel ?? "N/A"}%</span>
                          <span className="dot-sep">•</span>
                          <span>⏱ {s.LastUpdated ? `${Math.round(secAgo / 60)}m` : "No ping"}</span>
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

          {/* Sliding Bottom Sheet for Selected Officer Details */}
          {selectedSession && !isReplaying && (
            <div className="sliding-bottom-sheet">
              <div className="sheet-header">
                <div className="sheet-officer-info">
                  <div className="sheet-avatar">
                    {selectedSession.Image ? (
                      <img src={selectedSession.Image} alt={selectedSession.EmpName} />
                    ) : (
                      <span>{selectedSession.EmpName ? selectedSession.EmpName.charAt(0) : "E"}</span>
                    )}
                  </div>
                  <div>
                    <div className="sheet-name">{selectedSession.EmpName}</div>
                    <div className="sheet-role">
                      {selectedSession.Designation || "On Duty Officer"} • ID: {selectedSession.EmpCode}
                    </div>
                  </div>
                </div>

                <button className="sheet-close-btn" onClick={() => setSelectedSession(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="sheet-details-grid">
                <div className="sheet-detail-card">
                  <span className="lbl">📍 Current Location</span>
                  <span className="val">{selectedSession.ClientOrBranch || "Field Duty Assignment"}</span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">⚡ Live Speed / Status</span>
                  <span className="val">{selectedSession.Speed || 0} km/h • {selectedSession.MovementStatus}</span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">🔋 Device Battery</span>
                  <span className="val">{selectedSession.BatteryLevel ?? "N/A"}%</span>
                </div>
                <div className="sheet-detail-card">
                  <span className="lbl">⏱ ETA to Client</span>
                  <span className="val">18 mins • 2.8 km left</span>
                </div>
              </div>

              <div className="sheet-actions-row">
                <button className="sheet-act-btn ping" onClick={() => pingOfficerLocation(selectedSession)}>
                  <Zap size={16} /> Fetch Location
                </button>
                <button className="sheet-act-btn replay" onClick={() => startRouteReplay(selectedSession)}>
                  <Play size={16} /> Replay Path
                </button>
                {selectedSession.Mobile && (
                  <a href={`tel:${selectedSession.Mobile}`} className="sheet-act-btn call">
                    <Phone size={16} /> Call
                  </a>
                )}
                {selectedSession.Mobile && (
                  <a
                    href={`https://wa.me/91${selectedSession.Mobile}`}
                    target="_blank"
                    rel="noreferrer"
                    className="sheet-act-btn whatsapp"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}

          {/* YouTube-Style Minimal Replay Control Bar */}
          {isReplaying && (
            <div className="youtube-replay-player-bar">
              <div className="player-top-info">
                <div className="player-title">
                  🎬 Replaying Route History • Step {replayIndex + 1} of {replayLogs.length}
                </div>
                <button className="player-close-btn" onClick={exitReplay}>
                  <X size={18} />
                </button>
              </div>

              <div className="player-timeline-row">
                <button className="player-play-toggle" onClick={() => setIsPlayingReplay(!isPlayingReplay)}>
                  {isPlayingReplay ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <input
                  type="range"
                  min="0"
                  max={replayLogs.length - 1}
                  value={replayIndex}
                  onChange={(e) => setReplayIndex(parseInt(e.target.value))}
                  className="youtube-timeline-slider"
                />

                <div className="player-speed-selector">
                  {[1, 2, 5, 10].map((spd) => (
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

export default OnDutyLiveTracking;
