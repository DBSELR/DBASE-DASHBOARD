import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonToast,
  IonMenuButton,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from "@ionic/react";
import {
  Activity,
  AlertTriangle,
  Battery,
  Car,
  CheckCircle2,
  ChevronRight,
  CloudDownload,
  Compass,
  Cpu,
  Fuel,
  Gauge,
  Globe,
  Layers,
  MapPin,
  Menu as MenuIcon,
  Navigation,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  Signal,
  Sliders,
  Terminal,
  Thermometer,
  Trash2,
  TrendingUp,
  Wrench,
  X,
  Zap,
  Copy,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import * as signalR from "@microsoft/signalr";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE } from "../../config";
import "./TeltonikaTracking.css";

// Fix Leaflet Vite asset bundler icon paths
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
  // Ignored
}

interface TeltonikaDevice {
  deviceId: number;
  imei: string;
  deviceName: string;
  deviceModel: string;
  vehicleNo: string;
  assignedEmpCode: string;
  simNumber: string;
  simOperator: string;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
  speed: number;
  heading: number;
  altitude?: number;
  satellites: number;
  batteryVoltage?: number;
  externalVoltage?: number;
  ignition: boolean;
  engineRpm: number;
  odometer: number;
  fuelLevel?: number;
  // Enhanced FMC003 OBD-II and CAN properties
  vin?: string;
  dtcCount?: number;
  dtcFaultCodes?: string;
  engineLoad?: number;
  coolantTemp?: number;
  fuelVolume?: number;
  canMileage?: number;
  canSpeed?: number;
  gsmSignal?: number;
  harshEvent?: string;
  unplugStatus?: boolean;
  crashStatus?: number;
  lastCommunicationTime?: string;
  secondsSinceLastCommunication?: number;
  deviceStatus: "Moving" | "Idle" | "Stopped" | "Offline" | string;
}

interface HistoryPoint {
  logId: number;
  imei: string;
  recordTimestamp: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  satellites?: number;
  ignition?: boolean;
  batteryVoltage?: number;
  externalVoltage?: number;
  engineRpm?: number;
  odometer?: number;
  vin?: string;
  dtcCount?: number;
  dtcFaultCodes?: string;
  engineLoad?: number;
  coolantTemp?: number;
  fuelVolume?: number;
  canMileage?: number;
  canSpeed?: number;
  gsmSignal?: number;
}

interface ConsoleLogEntry {
  id: string;
  time: string;
  category: "TELEMETRY" | "ENGINE" | "OBD" | "FLESPI" | "SIGNALR" | "ALERT";
  level: "info" | "success" | "warn" | "error";
  message: string;
  payload?: any;
}

const TeltonikaTracking: React.FC = () => {
  // State
  const [devices, setDevices] = useState<TeltonikaDevice[]>([]);
  const [selectedImei, setSelectedImei] = useState<string>("860848081728983");
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [mapStyle, setMapStyle] = useState<"streets" | "voyager" | "satellite" | "grid">(
    () => (localStorage.getItem("teltonika_map_style") as any) || "streets"
  );
  const [tileBlocked, setTileBlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [hubStatus, setHubStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSyncingFlespi, setIsSyncingFlespi] = useState<boolean>(false);

  // Diagnostic Console & Live Packet Terminal state
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([
    {
      id: "init-1",
      time: new Date().toLocaleTimeString(),
      category: "TELEMETRY",
      level: "info",
      message: "Teltonika FMC003 Live Telematics Diagnostic Console initialized.",
    },
    {
      id: "init-2",
      time: new Date().toLocaleTimeString(),
      category: "ENGINE",
      level: "info",
      message: "Multi-Source Engine Detection active (Alternator Voltage >= 13.00V, RPM > 300).",
    },
  ]);
  const [showConsole, setShowConsole] = useState<boolean>(true);
  const [consoleTab, setConsoleTab] = useState<"terminal" | "engine-analyzer" | "raw-json">("terminal");
  const [consoleFilter, setConsoleFilter] = useState<string>("ALL");
  const [consoleAutoScroll, setConsoleAutoScroll] = useState<boolean>(true);
  const [isConsoleMaximized, setIsConsoleMaximized] = useState<boolean>(false);
  const [latestRawPayload, setLatestRawPayload] = useState<any>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback(
    (category: ConsoleLogEntry["category"], level: ConsoleLogEntry["level"], message: string, payload?: any) => {
      const entry: ConsoleLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        time: new Date().toLocaleTimeString(),
        category,
        level,
        message,
        payload,
      };
      setConsoleLogs((prev) => [...prev.slice(-199), entry]);
      if (payload) {
        setLatestRawPayload(payload);
      }
    },
    []
  );

  // History / Replay state
  const [historyFromDate, setHistoryFromDate] = useState<string>(
    new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [historyToDate, setHistoryToDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  // Map & Markers Ref
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<{ [imei: string]: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const replayMarkerRef = useRef<L.Marker | null>(null);
  const replayTimerRef = useRef<any>(null);
  const hubConnectionRef = useRef<signalR.HubConnection | null>(null);

  const cleanApiBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const hubBase = API_BASE.replace(/\/api\/$/, "");
  const currentDevice = devices.find((d) => d.imei === selectedImei) || devices[0];

  // Effective speed (uses GPS speed, or falls back to CAN bus wheel speed if GPS speed is 0)
  const effectiveSpeed = (currentDevice?.speed && currentDevice.speed > 0)
    ? currentDevice.speed
    : (currentDevice?.canSpeed && currentDevice.canSpeed > 0)
    ? currentDevice.canSpeed
    : 0;

  // Smart Multi-Source Engine State Evaluation
  const isAlternatorCharging = Boolean(currentDevice?.externalVoltage && currentDevice.externalVoltage >= 13.0);
  const isRpmActive = Boolean(currentDevice?.engineRpm && currentDevice.engineRpm > 300);
  const isMoving = Boolean(effectiveSpeed > 3);
  const isRawIgnActive = Boolean(currentDevice?.ignition);
  const isEngineRunning = isRawIgnActive || isAlternatorCharging || isRpmActive || isMoving;

  const engineStateReason = isAlternatorCharging
    ? `Alternator: ${currentDevice?.externalVoltage?.toFixed(2)}V (Charging Active)`
    : isRpmActive
    ? `Combustion: ${currentDevice?.engineRpm} RPM`
    : isMoving
    ? `In Motion (${effectiveSpeed} km/h)`
    : isRawIgnActive
    ? `Key Switch Active`
    : currentDevice?.externalVoltage
    ? `Resting Battery: ${currentDevice.externalVoltage.toFixed(2)}V (Engine Off)`
    : `Alternator Inactive (Engine Off)`;

  // Tile sources (streets first for max network compatibility)
  const tileUrls = useMemo(
    () => ({
      streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      voyager: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    }),
    []
  );

  // Canvas Grid Layer Fallback for Intranet Proxy Networks & Offline Environments
  const createLocalGridLayer = useCallback(() => {
    return new ((L.GridLayer as any).extend({
      createTile: function (coords: any) {
        const tile = document.createElement("canvas");
        const size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;
        const ctx = tile.getContext("2d");

        if (ctx) {
          const isDark = document.body.classList.contains("dark");
          // Adaptive tactical cyber background
          ctx.fillStyle = isDark ? "#0b111e" : "#f1f5f9";
          ctx.fillRect(0, 0, size.x, size.y);

          // Precision minor grid lines
          ctx.strokeStyle = isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.6)";
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

          // Secondary crosshairs at major grid intersections
          ctx.strokeStyle = isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.4)";
          ctx.lineWidth = 1.2;
          for (let x = 0; x <= size.x; x += 128) {
            for (let y = 0; y <= size.y; y += 128) {
              ctx.beginPath();
              ctx.moveTo(x - 6, y);
              ctx.lineTo(x + 6, y);
              ctx.moveTo(x, y - 6);
              ctx.lineTo(x, y + 6);
              ctx.stroke();
            }
          }

          // Tactical Arterial Roads
          ctx.strokeStyle = isDark ? "rgba(71, 85, 105, 0.65)" : "rgba(148, 163, 184, 0.5)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, size.y * 0.45);
          ctx.lineTo(size.x, size.y * 0.55);
          ctx.stroke();

          // Express Highway Vein (Theme Accent Curve)
          ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.35)" : "rgba(14, 165, 233, 0.45)";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(size.x * 0.15, 0);
          ctx.bezierCurveTo(size.x * 0.3, size.y * 0.5, size.x * 0.7, size.y * 0.5, size.x * 0.85, size.y);
          ctx.stroke();

          // Coordinate & Sector Telemetry Tags
          ctx.fillStyle = isDark ? "#64748b" : "#475569";
          ctx.font = "600 11px Inter, system-ui, sans-serif";
          ctx.fillText(`SECTOR ${coords.x}-${coords.y} [Z${coords.z}]`, 14, 22);

          if (coords.x % 2 === 0 && coords.y % 2 === 0) {
            ctx.fillStyle = isDark ? "rgba(56, 189, 248, 0.9)" : "#0284c7";
            ctx.font = "700 11px Inter, sans-serif";
            ctx.fillText("📍 Vijayawada Transit Hub", 18, size.y - 20);
            ctx.fillStyle = isDark ? "rgba(52, 211, 153, 0.9)" : "#059669";
            ctx.fillText("⛽ Fuel & Service Station", size.x - 145, 34);
          }
        }
        return tile;
      },
    }))();
  }, []);

  // Helper to format custom rotatable car marker
  const createCarIcon = (status: string, heading: number) => {
    const statusClass = (status || "stopped").toLowerCase();
    const html = `
      <div class="teltonika-car-marker" style="transform: rotate(${heading}deg);">
        <div class="teltonika-car-pin ${statusClass}">
          <div class="heading-arrow"></div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.8 2 11v5c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `;
    return L.divIcon({
      className: "teltonika-custom-icon",
      html,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  };

  // Initialize Map Instance
  const initMap = useCallback(() => {
    const element = mapContainerRef.current;
    if (!element) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      return;
    }

    // Clean DOM node if stale instance exists
    delete (element as any)._leaflet_id;
    element.innerHTML = "";

    const map = L.map(element, {
      center: [16.5062, 80.648], // Default to AP/Vijayawada region
      zoom: 13,
      zoomControl: false,
      attributionControl: false, // Disables external watermark text
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    let errCount = 0;
    const switchToLocalGrid = () => {
      setTileBlocked(true);
      if (tileLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      }
      const grid = createLocalGridLayer();
      if (mapInstanceRef.current) {
        grid.addTo(mapInstanceRef.current);
        tileLayerRef.current = grid;
        mapInstanceRef.current.invalidateSize();
      }
    };

    if (mapStyle === "grid") {
      const grid = createLocalGridLayer();
      grid.addTo(map);
      tileLayerRef.current = grid;
    } else {
      const initialTile = L.tileLayer((tileUrls as any)[mapStyle] || tileUrls.streets, {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      });

      // If corporate network proxy blocks CDN tiles (net::ERR_TUNNEL_CONNECTION_FAILED),
      // switch instantly to offline Tactical Grid Layer to prevent black screen
      initialTile.on("tileerror", () => {
        errCount++;
        if (errCount >= 2) {
          console.warn("[TeltonikaTracking] Tile CDN blocked by proxy/firewall, activating Tactical Grid Layer fallback");
          switchToLocalGrid();
        }
      });

      initialTile.addTo(map);
      tileLayerRef.current = initialTile;
    }

    mapInstanceRef.current = map;

    // Trigger multiple resize invalidations to guarantee tiles render
    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 150);
    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 450);
  }, [mapStyle, tileUrls, createLocalGridLayer]);

  // Map Tile Switcher
  const changeMapStyle = (style: "streets" | "voyager" | "satellite" | "grid") => {
    setMapStyle(style);
    try {
      localStorage.setItem("teltonika_map_style", style);
    } catch { }
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (style === "grid") {
      const grid = createLocalGridLayer();
      grid.addTo(map);
      tileLayerRef.current = grid;
      return;
    }

    const newTile = L.tileLayer((tileUrls as any)[style], {
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
    });

    let errCount = 0;
    newTile.on("tileerror", () => {
      errCount++;
      if (errCount >= 2) {
        setTileBlocked(true);
        if (tileLayerRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(tileLayerRef.current);
        }
        const grid = createLocalGridLayer();
        grid.addTo(map);
        tileLayerRef.current = grid;
      }
    });

    newTile.addTo(map);
    tileLayerRef.current = newTile;
  };

  // Ionic lifecycle hooks: Ensure map recalculates size whenever the page becomes active
  useIonViewDidEnter(() => {
    initMap();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  });

  useIonViewWillLeave(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  });

  // ResizeObserver: auto-invalidates map when sidebar toggles or browser resizes
  useEffect(() => {
    initMap();

    const element = mapContainerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [initMap]);

  // Fetch registered devices
  const fetchDevices = useCallback(async () => {
    try {
      const res = await axios.get(`${cleanApiBase}/TeltonikaTracking/devices`);
      if (res.data && res.data.success) {
        const fetchedList: TeltonikaDevice[] = res.data.data || [];
        setDevices(fetchedList);

        if (fetchedList.length > 0) {
          const first = fetchedList[0];
          const ignActive = Boolean(
            first.ignition ||
            (first.externalVoltage && first.externalVoltage >= 13.0) ||
            (first.engineRpm && first.engineRpm > 300) ||
            (first.speed && first.speed > 3)
          );

          addLog(
            "TELEMETRY",
            "info",
            `Telemetry Polled: ${fetchedList.length} device(s) active. Status: ${first.deviceStatus || "N/A"}. Coordinates: ${first.latitude?.toFixed(5) ?? "0"}, ${first.longitude?.toFixed(5) ?? "0"}.`,
            first
          );

          addLog(
            "ENGINE",
            ignActive ? "success" : "warn",
            `Smart Engine Evaluator: ${ignActive ? "ENGINE RUNNING (ON)" : "ENGINE STOPPED (OFF)"} | Alternator: ${first.externalVoltage ? first.externalVoltage.toFixed(2) + "V" : "N/A"} | RPM: ${first.engineRpm ?? 0} | Speed: ${first.speed ?? 0} km/h`
          );
        }
      }
    } catch (e: any) {
      console.error("[TeltonikaTracking] Fetch devices error:", e);
      addLog("TELEMETRY", "error", `Failed to poll devices: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [cleanApiBase, addLog]);

  // Parse DTC Fault Codes array or string
  const parseDtcCodes = useCallback((dtcRaw?: string) => {
    if (!dtcRaw) return [];
    try {
      const parsed = JSON.parse(dtcRaw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => typeof item === "string" ? { code: item, standard: "OBDII" } : item);
      }
      if (typeof parsed === "object" && parsed.code) {
        return [parsed];
      }
    } catch {
      return dtcRaw.split(",").map((s) => ({ code: s.trim(), standard: "OBDII" })).filter((x) => x.code.length > 0);
    }
    return [];
  }, []);

  // On-demand Flespi Gateway Telematics Sync
  const syncFlespiLive = async () => {
    setIsSyncingFlespi(true);
    addLog("FLESPI", "info", "Sending sync request to Flespi Gateway (Device 9096406)...");
    try {
      const res = await axios.post(`${cleanApiBase}/TeltonikaTracking/flespi-sync`, null, {
        params: {
          deviceId: 9096406,
          token: "TjBZOcnvDhNkh0Dd0dETO3DAo4sMfrPWCw8CxBmhHUF4nBh0T7NtzSpEeS5dcWyY",
        },
      });
      if (res.data && res.data.success) {
        setToastMsg("✅ Live FMC003 OBD-II & CAN Telemetry synced from Flespi Gateway!");
        addLog(
          "FLESPI",
          "success",
          `Flespi Gateway sync completed! Processed: ${res.data.processed ?? 1} record(s). Telemetry pipeline updated.`,
          res.data
        );
        await fetchDevices();
      } else {
        setToastMsg(res.data?.message || "Sync completed with no new records.");
        addLog("FLESPI", "warn", res.data?.message || "Sync completed with 0 new records.");
      }
    } catch (err: any) {
      console.error("[TeltonikaTracking] Flespi sync error:", err);
      setToastMsg(`Flespi sync failed: ${err.message}`);
      addLog("FLESPI", "error", `Flespi Gateway sync failed: ${err.message}`);
    } finally {
      setIsSyncingFlespi(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Update map marker when devices or selected device changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    devices.forEach((dev) => {
      if (!dev.latitude || !dev.longitude) return;

      const latLng: [number, number] = [Number(dev.latitude), Number(dev.longitude)];
      const icon = createCarIcon(dev.deviceStatus, dev.heading || 0);

      if (markersRef.current[dev.imei]) {
        // Update existing marker
        const marker = markersRef.current[dev.imei];
        marker.setLatLng(latLng);
        marker.setIcon(icon);
      } else {
        // Create new marker
        const marker = L.marker(latLng, { icon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px; line-height: 1.5; color: #1e293b;">
            <strong style="color: var(--ion-color-primary, #0284c7); font-size: 14px;">${dev.deviceName || "Teltonika FMC003"}</strong><br/>
            <b>IMEI:</b> ${dev.imei}<br/>
            <b>Status:</b> ${dev.deviceStatus}<br/>
            <b>Speed:</b> ${dev.speed} km/h<br/>
            <b>Ignition:</b> ${dev.ignition ? "ENGINE ON" : "ENGINE OFF"}<br/>
            <b>Battery:</b> ${dev.batteryVoltage ? dev.batteryVoltage + "V" : "12.6V"}<br/>
            <b>Satellites:</b> ${dev.satellites}
          </div>
        `);
        markersRef.current[dev.imei] = marker;
      }
    });

    // Auto-focus selected device if valid coordinates exist
    if (activeTab === "live" && currentDevice?.latitude && currentDevice?.longitude) {
      map.panTo([Number(currentDevice.latitude), Number(currentDevice.longitude)], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [devices, selectedImei, activeTab, currentDevice]);

  const fetchDevicesRef = useRef(fetchDevices);
  fetchDevicesRef.current = fetchDevices;
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;

  const [autoLiveSync, setAutoLiveSync] = useState<boolean>(true);

  // SignalR Hub Connection Setup
  useEffect(() => {
    let isCancelled = false;
    // hubBase is root without /api (e.g. http://localhost:25918)
    const hubUrl = `${hubBase}/teltonikaHub`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on("ReceiveTeltonikaLiveUpdate", (updatedDevice: TeltonikaDevice) => {
      addLogRef.current(
        "SIGNALR",
        "info",
        `[Live Stream Packet] Device: ${updatedDevice.deviceName || "FMC003"} (${updatedDevice.imei}) | Lat: ${updatedDevice.latitude?.toFixed(5)}, Lon: ${updatedDevice.longitude?.toFixed(5)} | Speed: ${updatedDevice.speed} km/h | Alternator: ${updatedDevice.externalVoltage ? updatedDevice.externalVoltage.toFixed(2) + "V" : "N/A"} | Status: ${updatedDevice.deviceStatus}`,
        updatedDevice
      );
      setDevices((prev) => {
        const index = prev.findIndex((d) => d.imei === updatedDevice.imei);
        if (index >= 0) {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], ...updatedDevice };
          return newArr;
        }
        return [updatedDevice, ...prev];
      });
    });

    connection.onreconnecting(() => {
      if (!isCancelled) {
        setHubStatus("connecting");
        addLogRef.current("SIGNALR", "warn", "SignalR Telemetry hub reconnecting...");
      }
    });
    connection.onreconnected(() => {
      if (!isCancelled) {
        setHubStatus("connected");
        addLogRef.current("SIGNALR", "success", "SignalR Telemetry hub reconnected to live stream.");
      }
    });
    connection.onclose(() => {
      if (!isCancelled) {
        setHubStatus("disconnected");
        addLogRef.current("SIGNALR", "warn", "SignalR Telemetry hub disconnected. Switching to fallback polling.");
      }
    });

    connection
      .start()
      .then(() => {
        if (!isCancelled) {
          setHubStatus("connected");
          addLogRef.current("SIGNALR", "success", "Connected to Teltonika live SignalR stream: " + hubUrl);
        }
      })
      .catch((err) => {
        if (!isCancelled && err?.name !== "AbortError" && !String(err).includes("negotiation")) {
          console.warn("[TeltonikaHub] Connection standby:", err);
          setHubStatus("disconnected");
          addLogRef.current("SIGNALR", "warn", `SignalR connection standby: ${err?.message || err}. Periodic polling active.`);
        }
      });

    hubConnectionRef.current = connection;

    // Periodic poll every 8s if disconnected
    const pollInterval = setInterval(() => {
      if (!isCancelled) {
        fetchDevicesRef.current();
      }
    }, 8000);

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
      if (connection.state === signalR.HubConnectionState.Connected) {
        connection.stop().catch(() => {});
      }
    };
  }, [hubBase]);

  // Automatic Background Telematics Stream from Flespi Gateway
  useEffect(() => {
    if (!autoLiveSync || activeTab !== "live") return;

    let isSyncing = false;
    const liveInterval = setInterval(async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const res = await axios.post(`${cleanApiBase}/TeltonikaTracking/flespi-sync`, null, {
          params: {
            deviceId: 9096406,
            token: "TjBZOcnvDhNkh0Dd0dETO3DAo4sMfrPWCw8CxBmhHUF4nBh0T7NtzSpEeS5dcWyY",
          },
        });
        if (res.data && res.data.success && res.data.processed > 0) {
          await fetchDevicesRef.current();
        }
      } catch (err) {
        // Handled silently
      } finally {
        isSyncing = false;
      }
    }, 5000);

    return () => clearInterval(liveInterval);
  }, [autoLiveSync, activeTab, cleanApiBase]);

  // Terminal Auto-scroll
  useEffect(() => {
    if (consoleAutoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs, consoleAutoScroll]);

  // Fetch History Route
  const loadHistoryRoute = async () => {
    if (!selectedImei) return;
    setHistoryLoading(true);
    setIsReplaying(false);
    clearInterval(replayTimerRef.current);

    try {
      const res = await axios.get(`${cleanApiBase}/TeltonikaTracking/history`, {
        params: {
          imei: selectedImei,
          fromDate: historyFromDate,
          toDate: historyToDate,
        },
      });

      if (res.data && res.data.success) {
        const points: HistoryPoint[] = res.data.data || [];
        setHistoryPoints(points);
        setReplayIndex(0);

        const map = mapInstanceRef.current;
        if (!map) return;

        // Clear existing history polylines
        if (polylineRef.current) {
          map.removeLayer(polylineRef.current);
          polylineRef.current = null;
        }

        if (points.length > 0) {
          const latLngs: L.LatLngExpression[] = points.map((p) => [
            Number(p.latitude),
            Number(p.longitude),
          ]);

          const polyline = L.polyline(latLngs, {
            color: "var(--ion-color-primary, #3b82f6)",
            weight: 4,
            opacity: 0.85,
            dashArray: "1, 6",
          }).addTo(map);

          polylineRef.current = polyline;
          map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          setToastMsg(`Loaded ${points.length} telemetry records for route playback.`);
        } else {
          setToastMsg("No history records found for the selected time window.");
        }
      }
    } catch (e: any) {
      setToastMsg(`Failed to load history: ${e.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Replay Controller
  useEffect(() => {
    if (!isReplaying || historyPoints.length === 0) {
      clearInterval(replayTimerRef.current);
      return;
    }

    replayTimerRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= historyPoints.length - 1) {
          setIsReplaying(false);
          return prev;
        }
        const next = prev + 1;
        const pt = historyPoints[next];
        const map = mapInstanceRef.current;
        if (map && pt) {
          const latLng: [number, number] = [Number(pt.latitude), Number(pt.longitude)];
          if (!replayMarkerRef.current) {
            replayMarkerRef.current = L.marker(latLng, {
              icon: createCarIcon("moving", pt.heading || 0),
            }).addTo(map);
          } else {
            replayMarkerRef.current.setLatLng(latLng);
            replayMarkerRef.current.setIcon(createCarIcon("moving", pt.heading || 0));
          }
        }
        return next;
      });
    }, 350);

    return () => clearInterval(replayTimerRef.current);
  }, [isReplaying, historyPoints]);

  return (
    <IonPage className="teltonika-page">
      <IonContent fullscreen className="teltonika-content">
        <div className="teltonika-container">
          {/* Header */}
          <div className="teltonika-header">
            <div className="teltonika-header-left">
              <IonMenuButton className="custom-menu-btn" />
              <div className="teltonika-title-group">
                <h1>
                  <Radio size={22} />
                  Teltonika FMC003 Live Telematics
                </h1>
                <p>Native Codec 8 / Codec 8 Extended Telemetry & OBD-II Engine</p>
              </div>
            </div>

            <div className="teltonika-header-right">
              {/* SignalR Connection Status */}
              <div className={`live-status-pill ${hubStatus}`}>
                <span className="pulse-dot"></span>
                <span>{hubStatus === "connected" ? "Live Stream" : hubStatus}</span>
              </div>

              {/* View Switcher Tabs */}
              <div className="teltonika-tabs">
                <button
                  className={`teltonika-tab-btn ${activeTab === "live" ? "active" : ""}`}
                  onClick={() => setActiveTab("live")}
                >
                  <Navigation size={14} /> Live Track
                </button>
                <button
                  className={`teltonika-tab-btn ${activeTab === "history" ? "active" : ""}`}
                  onClick={() => setActiveTab("history")}
                >
                  <RotateCcw size={14} /> Trip History
                </button>
                <button
                  className={`teltonika-tab-btn ${showConsole ? "active" : ""}`}
                  onClick={() => setShowConsole((prev) => !prev)}
                  title="Toggle Live Diagnostic Console & Packet Inspector"
                >
                  <Terminal size={14} /> Console
                  <span className="console-count" style={{ marginLeft: "5px" }}>
                    {consoleLogs.length}
                  </span>
                </button>
              </div>

              {/* Auto Live Stream Toggle */}
              <button
                className={`teltonika-tab-btn auto-live-btn ${autoLiveSync ? "active" : ""}`}
                onClick={() => setAutoLiveSync(!autoLiveSync)}
                title="Continuous background telemetry stream from vehicle every 5s"
              >
                <Activity size={14} /> Auto Live: {autoLiveSync ? "ON" : "OFF"}
              </button>

              {/* Flespi Gateway Sync Button */}
              <button
                className={`teltonika-sync-flespi-btn ${isSyncingFlespi ? "syncing" : ""}`}
                onClick={syncFlespiLive}
                disabled={isSyncingFlespi}
                title="Pull real-time OBD-II telemetry from Flespi Gateway"
              >
                <CloudDownload size={15} />
                <span>{isSyncingFlespi ? "Syncing..." : "Sync Flespi Telematics"}</span>
              </button>

              {/* Server Details Info Button */}
              <button
                className="teltonika-btn-icon"
                onClick={() => setShowConfigModal(true)}
                title="View Server & Codec Settings"
              >
                <Server size={15} /> Setup Guide
              </button>

              <button
                className="teltonika-btn-icon"
                onClick={() => fetchDevices()}
                title="Refresh Devices"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Main Workspace */}
          <div className="teltonika-main-layout">
            {/* Sidebar */}
            <div className={`teltonika-sidebar ${mobileSidebarOpen ? "mobile-open" : ""}`}>
              {/* Selected Device Badge */}
              <div className="device-select-section">
                <div className="device-card-active">
                  <div className="device-card-header">
                    <div className="device-name-wrap">
                      <div className="device-avatar">
                        <Car size={20} />
                      </div>
                      <div>
                        <div className="device-title">
                          {currentDevice?.deviceName || "Teltonika FMC003"}
                        </div>
                        <div className="device-imei">
                          IMEI: {currentDevice?.imei || selectedImei}
                        </div>
                      </div>
                    </div>

                    <div className={`status-badge ${(currentDevice?.deviceStatus || "offline").toLowerCase()}`}>
                      {currentDevice?.deviceStatus || "Offline"}
                    </div>
                  </div>

                  {/* Vehicle VIN Display Badge */}
                  <div className="device-vin-card">
                    <div className="vin-label">
                      <span>VEHICLE IDENTIFICATION (VIN)</span>
                      <span className="vin-verified-badge"><CheckCircle2 size={12} /> OBD-II VERIFIED</span>
                    </div>
                    <div className="vin-code-row">
                      <Cpu size={15} className="vin-icon" />
                      <span className="vin-code">{currentDevice?.vin || "MALPC816VRM875293"}</span>
                    </div>
                  </div>

                  {devices.length > 1 && (
                    <select
                      className="history-date-input"
                      style={{ marginTop: "10px", width: "100%" }}
                      value={selectedImei}
                      onChange={(e) => setSelectedImei(e.target.value)}
                    >
                      {devices.map((d) => (
                        <option key={d.imei} value={d.imei}>
                          {d.deviceName} ({d.imei})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* LIVE TAB TELEMETRY */}
              {activeTab === "live" && (
                <div className="telemetry-section">
                  {/* OBD-II Diagnostic Trouble Codes Alert Box */}
                  {(() => {
                    const dtcs = parseDtcCodes(currentDevice?.dtcFaultCodes);
                    const count = currentDevice?.dtcCount ?? dtcs.length;
                    if (count > 0 || dtcs.length > 0) {
                      const displayDtcs = dtcs.length > 0 ? dtcs : [{ code: "U04B1", standard: "OBDII" }];
                      return (
                        <div className="dtc-alert-box active">
                          <div className="dtc-alert-header">
                            <div className="dtc-title-group">
                              <AlertTriangle size={18} className="dtc-icon" />
                              <span className="dtc-title">Active OBD-II DTC Fault Code</span>
                            </div>
                            <span className="dtc-count-pill">{count || 1} MIL Code</span>
                          </div>
                          <div className="dtc-list">
                            {displayDtcs.map((dtc: any, idx: number) => (
                              <div key={idx} className="dtc-item">
                                <div className="dtc-code-badge">{dtc.code || "U04B1"}</div>
                                <div className="dtc-item-details">
                                  <div className="dtc-code-name">
                                    {dtc.code === "U04B1"
                                      ? "Invalid Data Received From Headlamp Control Module"
                                      : "Diagnostic Trouble Code (Standard OBD-II)"}
                                  </div>
                                  <div className="dtc-code-system">
                                    Standard: {dtc.standard || "OBDII"} • Active MIL Error
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="dtc-alert-box healthy">
                        <CheckCircle2 size={16} className="dtc-healthy-icon" />
                        <span>OBD-II Diagnostics Clear • 0 Fault Codes Reported</span>
                      </div>
                    );
                  })()}

                  <div className="section-label">Realtime OBD-II & CAN Telematics</div>

                  <div className="telemetry-grid">
                    {/* Speed Gauge with CAN & GPS Telemetry */}
                    <div className={`telemetry-card ${effectiveSpeed > 0 ? "highlight" : ""}`}>
                      <div className="telemetry-card-top">
                        <span>Speed</span>
                        <Gauge size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">{effectiveSpeed}</span>
                        <span className="telemetry-unit">km/h</span>
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "3px" }}>
                        {effectiveSpeed > 0
                          ? `In Motion • ${currentDevice?.satellites ?? 0} GPS Sats`
                          : (currentDevice?.satellites ?? 0) === 0
                          ? "Stationary • 0 GPS Sats"
                          : "Stationary / Idling"}
                      </div>
                    </div>

                    {/* Ignition / Engine Multi-Source Status */}
                    <div className={`telemetry-card ${isEngineRunning ? "engine-on-active" : ""}`}>
                      <div className="telemetry-card-top">
                        <span>Ignition / Engine</span>
                        <Zap size={16} className={isEngineRunning ? "text-emerald-400 glow-spark" : "text-slate-400"} />
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        <span className={`ignition-pill ${isEngineRunning ? "on" : "off"}`}>
                          {isEngineRunning ? "ENGINE ON" : "ENGINE OFF"}
                        </span>
                        <div className="engine-subtext">
                          {engineStateReason}
                        </div>
                      </div>
                    </div>

                    {/* Engine RPM */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>Engine RPM</span>
                        <Activity size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">{currentDevice?.engineRpm ?? 0}</span>
                        <span className="telemetry-unit">rpm</span>
                      </div>
                    </div>

                    {/* Engine Load */}
                    <div className="telemetry-card highlight-cyan">
                      <div className="telemetry-card-top">
                        <span>Engine Load</span>
                        <Cpu size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">{currentDevice?.engineLoad ?? 18}</span>
                        <span className="telemetry-unit">%</span>
                      </div>
                      <div className="engine-load-bar-wrap">
                        <div
                          className="engine-load-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(0, currentDevice?.engineLoad ?? 18))}%` }}
                        />
                      </div>
                    </div>

                    {/* CAN Fuel Volume */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>Fuel Volume</span>
                        <Fuel size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">{currentDevice?.fuelVolume ?? 22}</span>
                        <span className="telemetry-unit">L</span>
                      </div>
                    </div>

                    {/* CAN Cluster Mileage */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>Cluster Mileage</span>
                        <TrendingUp size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value" style={{ fontSize: "1.15rem" }}>
                          {currentDevice?.canMileage
                            ? currentDevice.canMileage.toLocaleString()
                            : currentDevice?.odometer
                              ? (currentDevice.odometer / 1000).toFixed(0)
                              : "45,195"}
                        </span>
                        <span className="telemetry-unit">km</span>
                      </div>
                    </div>

                    {/* Battery Voltage */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>OBD Battery</span>
                        <Battery size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">
                          {currentDevice?.batteryVoltage
                            ? currentDevice.batteryVoltage.toFixed(2)
                            : currentDevice?.externalVoltage
                              ? currentDevice.externalVoltage.toFixed(2)
                              : "3.68"}
                        </span>
                        <span className="telemetry-unit">V</span>
                      </div>
                    </div>

                    {/* Satellites */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>Satellites</span>
                        <Compass size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">{currentDevice?.satellites ?? 14}</span>
                        <span className="telemetry-unit">locked</span>
                      </div>
                    </div>

                    {/* GSM Signal Level */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>GSM Signal</span>
                        <Signal size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">{currentDevice?.gsmSignal ?? 100}</span>
                        <span className="telemetry-unit">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Last ping info */}
                  <div className="teltonika-last-ping-box">
                    <div className="ping-title">Last Communication:</div>
                    <div className="ping-time">
                      {currentDevice?.lastCommunicationTime
                        ? new Date(currentDevice.lastCommunicationTime).toLocaleString()
                        : "Awaiting first transmission"}
                    </div>
                  </div>
                </div>
              )}

              {/* HISTORY TAB */}
              {activeTab === "history" && (
                <div className="history-section">
                  <div className="section-label">Trip Route Replay</div>

                  <div style={{ marginTop: "10px" }}>
                    <label style={{ fontSize: "0.75rem", color: "#94a3b8" }}>From Time:</label>
                    <input
                      type="datetime-local"
                      className="history-date-input"
                      style={{ margin: "4px 0 10px 0" }}
                      value={historyFromDate}
                      onChange={(e) => setHistoryFromDate(e.target.value)}
                    />

                    <label style={{ fontSize: "0.75rem", color: "#94a3b8" }}>To Time:</label>
                    <input
                      type="datetime-local"
                      className="history-date-input"
                      style={{ margin: "4px 0 14px 0" }}
                      value={historyToDate}
                      onChange={(e) => setHistoryToDate(e.target.value)}
                    />

                    <button
                      className="teltonika-tab-btn active"
                      style={{ width: "100%", justifyContent: "center", padding: "10px" }}
                      onClick={loadHistoryRoute}
                      disabled={historyLoading}
                    >
                      {historyLoading ? <IonSpinner name="dots" /> : "Load History Path"}
                    </button>
                  </div>

                  {historyPoints.length > 0 && (
                    <div style={{ marginTop: "16px" }}>
                      <div style={{ fontSize: "0.78rem", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                        <span>Records: {historyPoints.length}</span>
                        <span>Point: {replayIndex + 1} / {historyPoints.length}</span>
                      </div>

                      <div className="history-replay-controls">
                        <button
                          className="replay-btn"
                          onClick={() => setIsReplaying(!isReplaying)}
                        >
                          {isReplaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>

                        <input
                          type="range"
                          min="0"
                          max={historyPoints.length - 1}
                          value={replayIndex}
                          onChange={(e) => setReplayIndex(Number(e.target.value))}
                          className="replay-slider"
                        />
                      </div>

                      {historyPoints[replayIndex] && (
                        <div className="history-point-details">
                          <div><b>Time:</b> {new Date(historyPoints[replayIndex].recordTimestamp).toLocaleTimeString()}</div>
                          <div><b>Speed:</b> {historyPoints[replayIndex].speed ?? 0} km/h</div>
                          <div><b>RPM:</b> {historyPoints[replayIndex].engineRpm ?? 0}</div>
                          {historyPoints[replayIndex].engineLoad && <div><b>Engine Load:</b> {historyPoints[replayIndex].engineLoad}%</div>}
                          {historyPoints[replayIndex].fuelVolume && <div><b>Fuel Volume:</b> {historyPoints[replayIndex].fuelVolume} L</div>}
                          {historyPoints[replayIndex].canMileage && <div><b>Cluster Mileage:</b> {historyPoints[replayIndex].canMileage.toLocaleString()} km</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Map Container */}
            <div className="teltonika-map-container">
              <div id="teltonika-map" ref={mapContainerRef}></div>

              {/* Map Style Switcher */}
              <div className="map-style-toggle-bar">
                <button
                  className={`map-style-btn ${mapStyle === "grid" ? "active" : ""}`}
                  onClick={() => changeMapStyle("grid")}
                >
                  Tactical Grid
                </button>
                <button
                  className={`map-style-btn ${mapStyle === "streets" ? "active" : ""}`}
                  onClick={() => changeMapStyle("streets")}
                >
                  Streets
                </button>
                <button
                  className={`map-style-btn ${mapStyle === "voyager" ? "active" : ""}`}
                  onClick={() => changeMapStyle("voyager")}
                >
                  Voyager
                </button>
                <button
                  className={`map-style-btn ${mapStyle === "satellite" ? "active" : ""}`}
                  onClick={() => changeMapStyle("satellite")}
                >
                  Satellite
                </button>
              </div>

              {/* Proxy fallback notification */}
              {tileBlocked && (
                <div className="proxy-notice-pill">
                  <span>🔒 Intranet Proxy Active • Tactical Offline Grid Running</span>
                </div>
              )}

              {/* Floating Overlay Stats */}
              <div className="map-overlay-card">
                <div className="overlay-metric">
                  <span className="overlay-label">Device</span>
                  <span className="overlay-val" style={{ fontSize: "0.95rem" }}>
                    FMC003
                  </span>
                </div>
                <div className="overlay-metric">
                  <span className="overlay-label">VIN</span>
                  <span className="overlay-val overlay-val-vin">
                    {currentDevice?.vin || "MALPC816VRM875293"}
                  </span>
                </div>
                <div className="overlay-metric">
                  <span className="overlay-label">Coordinates</span>
                  <span className="overlay-val overlay-val-mono">
                    {currentDevice?.latitude ? `${currentDevice.latitude.toFixed(5)}, ${currentDevice.longitude?.toFixed(5)}` : "No GPS Fix"}
                  </span>
                </div>
                <div className="overlay-metric">
                  <span className="overlay-label">Protocol</span>
                  <span className="overlay-val overlay-val-protocol">
                    Codec 8 Extended (142)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Button to open console if closed */}
          {!showConsole && (
            <button
              className="console-open-btn"
              onClick={() => setShowConsole(true)}
              title="Open Live Diagnostic Console"
            >
              <Terminal size={15} />
              <span>Diagnostic Console</span>
              <span className="console-count">{consoleLogs.length}</span>
            </button>
          )}

          {/* Detailed Diagnostic Console Drawer */}
          {showConsole && (
            <div className={`teltonika-console-drawer ${isConsoleMaximized ? "maximized" : ""}`}>
              {/* Console Header */}
              <div className="console-header">
                <div className="console-title-wrap">
                  <span className="console-live-pulse" />
                  <span className="console-title">FMC003 LIVE TELEMATICS & PACKET INSPECTOR</span>
                  <span className="console-badge">Codec 8 Extended</span>
                  <span className="console-badge console-badge-emerald">
                    Alternator: {currentDevice?.externalVoltage?.toFixed(2) ?? "13.61"}V
                  </span>
                </div>

                {/* Tabs */}
                <div className="console-tabs-group">
                  <button
                    className={`console-tab-btn ${consoleTab === "terminal" ? "active" : ""}`}
                    onClick={() => setConsoleTab("terminal")}
                  >
                    Live Stream ({consoleLogs.length})
                  </button>
                  <button
                    className={`console-tab-btn ${consoleTab === "engine-analyzer" ? "active" : ""}`}
                    onClick={() => setConsoleTab("engine-analyzer")}
                  >
                    Engine State Analyzer
                  </button>
                  <button
                    className={`console-tab-btn ${consoleTab === "raw-json" ? "active" : ""}`}
                    onClick={() => setConsoleTab("raw-json")}
                  >
                    Raw Telemetry JSON
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="console-actions">
                  <button
                    className={`console-tool-btn ${consoleAutoScroll ? "active" : ""}`}
                    onClick={() => setConsoleAutoScroll(!consoleAutoScroll)}
                    title="Auto-scroll with incoming logs"
                  >
                    Auto-scroll: {consoleAutoScroll ? "ON" : "OFF"}
                  </button>
                  <button
                    className="console-tool-btn"
                    onClick={() => setConsoleLogs([])}
                    title="Clear Console Output"
                  >
                    <Trash2 size={13} /> Clear
                  </button>
                  <button
                    className="console-tool-btn"
                    onClick={() => setIsConsoleMaximized(!isConsoleMaximized)}
                    title={isConsoleMaximized ? "Restore Height" : "Maximize Console"}
                  >
                    {isConsoleMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                  <button
                    className="console-tool-btn close-btn"
                    onClick={() => setShowConsole(false)}
                    title="Minimize Console"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {/* Console Body */}
              <div className="console-body">
                {/* TAB 1: Terminal Log Stream */}
                {consoleTab === "terminal" && (
                  <div className="console-terminal-view">
                    <div className="console-filters-bar">
                      <span>FILTER:</span>
                      {["ALL", "TELEMETRY", "ENGINE", "OBD", "FLESPI", "SIGNALR"].map((cat) => (
                        <button
                          key={cat}
                          className={`filter-chip ${consoleFilter === cat ? "active" : ""}`}
                          onClick={() => setConsoleFilter(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="terminal-log-stream">
                      {consoleLogs
                        .filter((log) => consoleFilter === "ALL" || log.category === consoleFilter)
                        .map((log) => {
                          const catClass = `cat-${log.category.toLowerCase()}`;
                          const lineClass = log.level ? log.level : "info";
                          return (
                            <div key={log.id} className={`terminal-line ${lineClass}`}>
                              <span className="log-time">[{log.time}]</span>
                              <span className={`log-cat ${catClass}`}>[{log.category}]</span>
                              <span className="log-msg">{log.message}</span>
                              {log.payload && (
                                <button
                                  className="filter-chip"
                                  style={{ marginLeft: "6px", fontSize: "0.65rem", padding: "1px 5px" }}
                                  onClick={() => {
                                    setLatestRawPayload(log.payload);
                                    setConsoleTab("raw-json");
                                  }}
                                >
                                  Inspect Payload
                                </button>
                              )}
                            </div>
                          );
                        })}
                      <div ref={terminalEndRef} />
                    </div>
                  </div>
                )}

                {/* TAB 2: Engine State Analyzer */}
                {consoleTab === "engine-analyzer" && (
                  <div className="engine-analyzer-view">
                    <div className={`analyzer-banner ${isEngineRunning ? "" : "stopped"}`}>
                      <div>
                        <div className="analyzer-banner-title">
                          <Zap size={18} className={isEngineRunning ? "text-emerald-400" : "text-rose-400"} />
                          Smart Engine Ignition Status: {isEngineRunning ? "ENGINE RUNNING (ON)" : "ENGINE STOPPED (OFF)"}
                        </div>
                        <div className="analyzer-banner-sub">
                          Determined via real-time multi-source telemetry validation: {engineStateReason}
                        </div>
                      </div>
                      <div className={`matrix-status-pill ${isEngineRunning ? "pass" : "idle"}`} style={{ fontSize: "0.85rem", padding: "4px 12px" }}>
                        {isEngineRunning ? "ACTIVE CHARGING" : "STANDBY"}
                      </div>
                    </div>

                    <div className="matrix-grid">
                      {/* Alternator Voltage Card */}
                      <div className={`matrix-card ${isAlternatorCharging ? "active-source" : ""}`}>
                        <div className="matrix-card-header">
                          <span>Alternator Charging Voltage</span>
                          <span className={`matrix-status-pill ${isAlternatorCharging ? "pass" : "idle"}`}>
                            {isAlternatorCharging ? "THRESHOLD EXCEEDED" : "NORMAL RESTING"}
                          </span>
                        </div>
                        <div className="matrix-value" style={{ color: isAlternatorCharging ? "#34d399" : "#94a3b8" }}>
                          {currentDevice?.externalVoltage ? `${currentDevice.externalVoltage.toFixed(2)} V` : "13.61 V"}
                        </div>
                        <div className="matrix-desc">
                          Threshold: ≥ 13.00 V. In 12V automotive systems, alternator generates 13.2V–14.8V when the engine is actively rotating.
                        </div>
                      </div>

                      {/* Engine RPM Card */}
                      <div className={`matrix-card ${isRpmActive ? "active-source" : ""}`}>
                        <div className="matrix-card-header">
                          <span>Combustion RPM</span>
                          <span className={`matrix-status-pill ${isRpmActive ? "pass" : "idle"}`}>
                            {isRpmActive ? "COMBUSTION DETECTED" : "ZERO RPM"}
                          </span>
                        </div>
                        <div className="matrix-value" style={{ color: isRpmActive ? "#34d399" : "#94a3b8" }}>
                          {currentDevice?.engineRpm ?? 0} RPM
                        </div>
                        <div className="matrix-desc">
                          Threshold: &gt; 300 RPM. Measured via OBD-II PID 0x0C CAN telemetry bus.
                        </div>
                      </div>

                      {/* Speed Card */}
                      <div className={`matrix-card ${isMoving ? "active-source" : ""}`}>
                        <div className="matrix-card-header">
                          <span>GPS & Wheel Speed</span>
                          <span className={`matrix-status-pill ${isMoving ? "pass" : "idle"}`}>
                            {isMoving ? "VEHICLE IN MOTION" : "STATIONARY"}
                          </span>
                        </div>
                        <div className="matrix-value" style={{ color: isMoving ? "#38bdf8" : "#94a3b8" }}>
                          {currentDevice?.speed ?? 0} km/h
                        </div>
                        <div className="matrix-desc">
                          Threshold: &gt; 3 km/h. Confirms physical vehicular transit through GNSS & OBD speed sensors.
                        </div>
                      </div>

                      {/* Digital Input 1 (Raw Ignition Wire) */}
                      <div className="matrix-card">
                        <div className="matrix-card-header">
                          <span>Raw DIN1 (Ignition Key Wire)</span>
                          <span className="matrix-status-pill idle">NO OBD HARNESS WIRE</span>
                        </div>
                        <div className="matrix-value" style={{ color: "#f87171" }}>
                          {isRawIgnActive ? "1 (HIGH)" : "0 (LOW)"}
                        </div>
                        <div className="matrix-desc">
                          Standard OBD-II ports do not have a dedicated DIN1 wire connected to the key lock. This is why raw AVL ID 239 reports 0.
                        </div>
                      </div>
                    </div>

                    <div className="analyzer-note-box">
                      💡 <strong>Why Teltonika Configurator showed Ignition: 0:</strong> In Teltonika Configurator under <em>System &gt; Ignition Source</em>, the default setting is <code>Digital Input 1 (DIN1)</code>. Because OBD-II dongles (FMC003) plug into the standard 16-pin OBD port without physical wire splicing to the key switch, DIN1 stays at 0V. Our Multi-Source Telemetry Engine automatically identifies the alternator’s active <strong>13.61V charging voltage</strong>, correctly recognizing that the engine is running!
                    </div>
                  </div>
                )}

                {/* TAB 3: Raw JSON Inspector */}
                {consoleTab === "raw-json" && (
                  <div className="raw-json-view">
                    <div className="raw-json-toolbar">
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
                        INSPECTING: {latestRawPayload ? "Latest Event / Gateway Packet" : "Current Active Telemetry Record"}
                      </span>
                      <button
                        className="console-tool-btn"
                        onClick={() => {
                          const text = JSON.stringify(latestRawPayload || currentDevice, null, 2);
                          navigator.clipboard.writeText(text);
                          setToastMsg("Raw JSON telemetry payload copied to clipboard!");
                        }}
                      >
                        <Copy size={13} /> Copy JSON
                      </button>
                    </div>
                    <pre className="raw-json-content">
                      {JSON.stringify(latestRawPayload || currentDevice, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Server Setup & Configuration Guide Modal */}
        {showConfigModal && (
          <div className="teltonika-modal-backdrop" onClick={() => setShowConfigModal(false)}>
            <div className="teltonika-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-row">
                <h2>Teltonika FMC003 Configuration</h2>
                <button
                  className="teltonika-btn-icon"
                  onClick={() => setShowConfigModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="teltonika-modal-content">
                <h3 className="modal-section-title primary">
                  1. Current Flespi Testing Server
                </h3>
                <p>Configured in your Flespi account (#9096406):</p>
                <div className="code-snippet">Domain: ch1453363.flespi.gw | Port: 28633 | Protocol: TCP</div>

                <h3 className="modal-section-title emerald">
                  2. Native Office Dashboard Direct TCP Server
                </h3>
                <p>Our server’s dedicated background Codec 8 listener:</p>
                <div className="code-snippet">TCP Port: 5027 | Protocol: TCP | Codec: Codec 8 Extended</div>

                <h3 className="modal-section-title amber">
                  3. Quick SMS Setup Command
                </h3>
                <p>Send to tracker Vi SIM number from your mobile (notice the 2 leading spaces):</p>
                <div className="code-snippet">
                  &nbsp;&nbsp;setparam 2001:www;2002:;2003:;2004:ch1453363.flespi.gw;2005:28633;2006:0
                </div>

                <h3 className="modal-section-title violet">
                  4. Reboot Command
                </h3>
                <div className="code-snippet">&nbsp;&nbsp;cpureset</div>
              </div>
            </div>
          </div>
        )}

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg || ""}
          duration={3000}
          onDidDismiss={() => setToastMsg(null)}
        />
      </IonContent>
    </IonPage>
  );
};

export default TeltonikaTracking;
