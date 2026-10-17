import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonToast,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from "@ionic/react";
import {
  Activity,
  AlertTriangle,
  Battery,
  Car,
  CheckCircle2,
  CloudDownload,
  Compass,
  Cpu,
  Fuel,
  Gauge,
  Layers,
  MapPin,
  Navigation,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  Signal,
  Terminal,
  Thermometer,
  Trash2,
  TrendingUp,
  X,
  Zap,
  Copy,
  Maximize2,
  Minimize2,
  ChevronDown,
  Wind,
  Lock,
  Unlock,
  Send,
  Bell,
  Download,
  FileText,
  Sliders,
  Radio,
  Eye,
  Crosshair,
  UserCheck,
  Grid,
  Map as MapIcon,
  Globe,
  Target,
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
  // Extended Fleet Accessories
  acStatus?: boolean;
  doorStatus?: boolean;
  immobilizer?: boolean;
  driverId?: string;
  cabinTemp?: number;
  engineHours?: number;
  speedLimit?: number;
  unackAlertsCount?: number;
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
  acStatus?: boolean;
  doorStatus?: boolean;
  immobilizer?: boolean;
  driverId?: string;
}

interface TeltonikaAlert {
  alertId: number;
  imei: string;
  vehicleNo: string;
  alertType: string;
  severity: "Critical" | "Warning" | "Info" | string;
  message: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  isAcknowledged: boolean;
  createdAt: string;
}

interface TeltonikaGeofence {
  geofenceId: number;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  speedLimit: number;
  alertOnEnter: boolean;
  alertOnExit: boolean;
  isActive: boolean;
  createdAt: string;
}

interface TeltonikaCommand {
  commandId: number;
  imei: string;
  commandText: string;
  codecType: string;
  status: string;
  sentPayloadHex?: string;
  responseText?: string;
  sentAt?: string;
  createdAt: string;
}

interface TripReportSummary {
  imei: string;
  tripStartTime?: string;
  tripEndTime?: string;
  durationMinutes: number;
  maxSpeed: number;
  avgSpeed: number;
  totalDataPoints: number;
  distanceTravelledKm: number;
  estFuelConsumedLiters: number;
  idlePointsCount: number;
  stopPointsCount: number;
}

interface FleetUtilizationSummary {
  imei: string;
  deviceName: string;
  vehicleNo: string;
  deviceModel: string;
  currentSpeed: number;
  currentIgnition: boolean;
  currentAc: boolean;
  currentDoor: boolean;
  currentImmobilizer: boolean;
  totalOdometerKm: number;
  fuelVolumeLiters: number;
  engineOperatingHours: number;
  todayAlertsCount: number;
  todayOverspeedCount: number;
  deviceStatus: string;
  lastCommunicationTime?: string;
}

interface ConsoleLogEntry {
  id: string;
  time: string;
  category: "TELEMETRY" | "ENGINE" | "OBD" | "FLESPI" | "SIGNALR" | "COMMAND" | "ALERT";
  level: "info" | "success" | "warn" | "error";
  message: string;
  payload?: any;
}

const TeltonikaTracking: React.FC = () => {
  // Core Devices State
  const [devices, setDevices] = useState<TeltonikaDevice[]>([]);
  const [selectedImei, setSelectedImei] = useState<string>("860848081728983");
  const [activeTab, setActiveTab] = useState<"live" | "history" | "alerts" | "reports" | "geofences" | "commands" | "setup">("live");
  const [mapStyle, setMapStyle] = useState<"streets" | "voyager" | "satellite" | "grid">(
    () => (localStorage.getItem("teltonika_map_style") as any) || "streets"
  );
  const [tileBlocked, setTileBlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [hubStatus, setHubStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSyncingFlespi, setIsSyncingFlespi] = useState<boolean>(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);
  const [autoLiveSync, setAutoLiveSync] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());
  const [syncCount, setSyncCount] = useState<number>(0);
  const [followVehicle, setFollowVehicle] = useState<boolean>(true);

  // Alerts State
  const [alerts, setAlerts] = useState<TeltonikaAlert[]>([]);
  const [alertsFilter, setAlertsFilter] = useState<string>("ALL");
  const [alertsLoading, setAlertsLoading] = useState<boolean>(false);

  // Geofences State
  const [geofences, setGeofences] = useState<TeltonikaGeofence[]>([]);
  const [showAddGeofenceModal, setShowAddGeofenceModal] = useState<boolean>(false);
  const [newGeofenceName, setNewGeofenceName] = useState<string>("");
  const [newGeofenceRadius, setNewGeofenceRadius] = useState<number>(300);
  const [newGeofenceSpeedLimit, setNewGeofenceSpeedLimit] = useState<number>(40);
  const [newGeofenceLat, setNewGeofenceLat] = useState<number>(16.5062);
  const [newGeofenceLng, setNewGeofenceLng] = useState<number>(80.6480);

  // Commands / Relay Control State
  const [commandHistory, setCommandHistory] = useState<TeltonikaCommand[]>([]);
  const [customCommandText, setCustomCommandText] = useState<string>("");
  const [commandSending, setCommandSending] = useState<boolean>(false);
  const [showImmobilizerConfirmModal, setShowImmobilizerConfirmModal] = useState<boolean>(false);
  const [pendingImmobilizerState, setPendingImmobilizerState] = useState<boolean>(false);
  const [latestCommandResult, setLatestCommandResult] = useState<any>(null);

  // Reports State
  const [tripReport, setTripReport] = useState<TripReportSummary | null>(null);
  const [fleetUtilization, setFleetUtilization] = useState<FleetUtilizationSummary[]>([]);
  const [reportLoading, setReportLoading] = useState<boolean>(false);

  // Diagnostic Console State
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([
    {
      id: "init-1",
      time: new Date().toLocaleTimeString(),
      category: "TELEMETRY",
      level: "info",
      message: "Teltonika Universal Fleet Telematics Engine initialized.",
    },
    {
      id: "init-2",
      time: new Date().toLocaleTimeString(),
      category: "ENGINE",
      level: "info",
      message: "Multi-Source Engine Evaluator active (Alternator Voltage >= 13.00V, RPM > 300, Speed > 3 km/h).",
    },
  ]);
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [consoleTab, setConsoleTab] = useState<"terminal" | "engine-analyzer" | "raw-json">("terminal");
  const [consoleFilter, setConsoleFilter] = useState<string>("ALL");
  const [consoleAutoScroll, setConsoleAutoScroll] = useState<boolean>(true);
  const [isConsoleMaximized, setIsConsoleMaximized] = useState<boolean>(false);
  const [latestRawPayload, setLatestRawPayload] = useState<any>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // History / Replay State
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
  const [replaySpeed, setReplaySpeed] = useState<number>(1);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<{ [imei: string]: L.Marker }>({});
  const geofenceCirclesRef = useRef<L.Circle[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const replayMarkerRef = useRef<L.Marker | null>(null);
  const replayTimerRef = useRef<any>(null);
  const hubConnectionRef = useRef<signalR.HubConnection | null>(null);

  const cleanApiBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const currentDevice = devices.find((d) => d.imei === selectedImei) || devices[0];

  // Helper logger
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

  // Effective speed calculation (falls back to CAN speed only if engine is on/charging and not resting)
  const effectiveSpeed = (currentDevice?.speed && currentDevice.speed > 0)
    ? currentDevice.speed
    : (currentDevice?.canSpeed && currentDevice.canSpeed > 0 && (currentDevice?.ignition || (currentDevice?.externalVoltage && currentDevice.externalVoltage >= 13.0)))
    ? currentDevice.canSpeed
    : 0;

  // Smart Multi-Source Engine State Evaluation
  const isImmobilized = Boolean(currentDevice?.immobilizer);
  const isAlternatorCharging = Boolean(!isImmobilized && currentDevice?.externalVoltage && currentDevice.externalVoltage >= 13.0);
  const isRpmActive = Boolean(!isImmobilized && currentDevice?.engineRpm && currentDevice.engineRpm > 300);
  const isMoving = Boolean(!isImmobilized && effectiveSpeed > 3);
  const isRawIgnActive = Boolean(!isImmobilized && currentDevice?.ignition);
  const isEngineRunning = !isImmobilized && (isRawIgnActive || isAlternatorCharging || isRpmActive || isMoving);

  const engineStateReason = isImmobilized
    ? "IMMOBILIZED: Starter Cut-Off Relay (DOUT1) Engaged • Engine Disabled"
    : isAlternatorCharging
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

  // Smart Air Conditioner (AC) State Evaluation
  // AC mechanically requires the engine running and not immobilized
  const effectiveAcStatus = Boolean(!isImmobilized && isEngineRunning && currentDevice?.acStatus);

  const acStateReason = isImmobilized
    ? "Engine Cut (Compressor Disabled)"
    : !isEngineRunning
    ? "Engine Off (Compressor Inactive)"
    : effectiveAcStatus
    ? "AC Active (Compressor Engaged • Cooling ON)"
    : "AC Inactive (Compressor Disengaged • Vent/Off)";

  // Detailed Telemetry Evaluation Console Logger
  const lastLoggedTelemetryRef = useRef<string>("");
  useEffect(() => {
    if (!currentDevice) return;

    const signature = `${currentDevice.imei}_${isEngineRunning}_${isImmobilized}_${effectiveAcStatus}_${currentDevice.engineRpm}_${currentDevice.speed}_${currentDevice.externalVoltage}_${currentDevice.engineLoad}`;
    if (lastLoggedTelemetryRef.current === signature) return;
    lastLoggedTelemetryRef.current = signature;

    console.groupCollapsed(
      `%c🚗 [Teltonika Telemetry Evaluation] ${currentDevice.vehicleNo || currentDevice.imei} | Engine: ${isImmobilized ? "🛑 IMMOBILIZED (CUT)" : isEngineRunning ? "🟢 ENGINE ON" : "⚪ ENGINE OFF"} | AC: ${effectiveAcStatus ? "❄️ ON" : "💨 OFF"}`,
      `color: ${isImmobilized ? "#ef4444" : isEngineRunning ? "#10b981" : "#64748b"}; font-weight: bold; font-size: 11px; padding: 2px 4px;`
    );
    console.table({
      "Vehicle": currentDevice.vehicleNo || "N/A",
      "IMEI": currentDevice.imei,
      "Immobilizer (DOUT1 Relay)": isImmobilized ? "ENGAGED (Relay 1 - Engine Cut)" : "DISENGAGED (Relay 0 - Normal)",
      "Smart Engine State": isImmobilized ? "IMMOBILIZED / CUT OFF" : isEngineRunning ? "RUNNING" : "STOPPED / OFF",
      "Engine State Reason": engineStateReason,
      "Raw Ignition (DIN1)": currentDevice.ignition ? "ON (True)" : "OFF (False)",
      "Alternator Voltage": `${currentDevice.externalVoltage?.toFixed(2) ?? "N/A"} V (${isAlternatorCharging ? "Charging" : "Resting"})`,
      "Engine Combustion RPM": `${currentDevice.engineRpm ?? 0} RPM`,
      "Engine Load": `${currentDevice.engineLoad ?? 0} %`,
      "Speed": `${effectiveSpeed} km/h`,
      "Air Conditioner (AC)": effectiveAcStatus ? "AC: ON" : "AC: OFF",
      "AC Evaluation Reason": acStateReason,
      "Door State": currentDevice.doorStatus ? "OPEN" : "CLOSED",
      "Last Telemetry Recv": currentDevice.lastCommunicationTime ? new Date(currentDevice.lastCommunicationTime).toLocaleTimeString() : "N/A",
      "Device Status": currentDevice.deviceStatus
    });
    console.log("%cTelemetry Raw Payload Object:", "color: #94a3b8; font-style: italic;", currentDevice);
    console.groupEnd();
  }, [currentDevice, isEngineRunning, isImmobilized, effectiveAcStatus, effectiveSpeed, engineStateReason, acStateReason, isAlternatorCharging]);

  // Overspeed evaluation
  const speedLimit = currentDevice?.speedLimit ?? 80;
  const isOverspeeding = effectiveSpeed > speedLimit;

  // Tile sources
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
          ctx.fillStyle = isDark ? "#0b111e" : "#f1f5f9";
          ctx.fillRect(0, 0, size.x, size.y);

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

          ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.35)" : "rgba(14, 165, 233, 0.45)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, size.y * 0.45);
          ctx.lineTo(size.x, size.y * 0.55);
          ctx.stroke();

          ctx.fillStyle = isDark ? "#64748b" : "#475569";
          ctx.font = "600 11px Inter, system-ui, sans-serif";
          ctx.fillText(`SECTOR ${coords.x}-${coords.y} [Z${coords.z}]`, 14, 22);

          if (coords.x % 2 === 0 && coords.y % 2 === 0) {
            ctx.fillStyle = isDark ? "rgba(56, 189, 248, 0.9)" : "#0284c7";
            ctx.font = "700 11px Inter, sans-serif";
            ctx.fillText("📍 Logistics Base", 18, size.y - 20);
          }
        }
        return tile;
      },
    }))();
  }, []);

  // Helper to format custom rotatable car marker with heading direction arrow
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

  // Initialize Map
  const initMap = useCallback(() => {
    const element = mapContainerRef.current;
    if (!element) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      return;
    }

    delete (element as any)._leaflet_id;
    element.innerHTML = "";

    const map = L.map(element, {
      center: [16.5062, 80.648],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
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

      initialTile.on("tileerror", () => {
        errCount++;
        if (errCount >= 2) {
          switchToLocalGrid();
        }
      });

      initialTile.addTo(map);
      tileLayerRef.current = initialTile;
    }

    mapInstanceRef.current = map;

    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 150);
  }, [mapStyle, tileUrls, createLocalGridLayer]);

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

    newTile.addTo(map);
    tileLayerRef.current = newTile;
  };

  // Draw geofences on map
  const renderGeofencesOnMap = useCallback((fenceList: TeltonikaGeofence[]) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old geofence circles
    geofenceCirclesRef.current.forEach((c) => map.removeLayer(c));
    geofenceCirclesRef.current = [];

    fenceList.forEach((fence) => {
      if (!fence.latitude || !fence.longitude || !fence.isActive) return;

      const circle = L.circle([fence.latitude, fence.longitude], {
        radius: fence.radiusMeters || 300,
        color: "#0284c7",
        fillColor: "#38bdf8",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);

      circle.bindTooltip(`🛡️ <b>${fence.name}</b><br/>Speed Limit: ${fence.speedLimit} km/h`, {
        permanent: false,
        direction: "top",
      });

      geofenceCirclesRef.current.push(circle);
    });
  }, []);

  // Fetch Devices
  const fetchDevices = useCallback(async () => {
    try {
      const res = await axios.get(`${cleanApiBase}/TeltonikaTracking/devices`);
      if (res.data && res.data.success) {
        const fetchedList: TeltonikaDevice[] = res.data.data || [];
        setDevices(fetchedList);

        if (fetchedList.length > 0) {
          const first = fetchedList[0];
          addLog(
            "TELEMETRY",
            "info",
            `Fleet Polled: ${fetchedList.length} device(s). Selected: ${first.deviceName || first.imei}. Speed: ${first.speed} km/h, AC: ${first.acStatus ? "ON" : "OFF"}`
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

  // Fetch Alerts
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await axios.get(`${cleanApiBase}/TeltonikaTracking/alerts`, {
        params: {
          severity: alertsFilter === "ALL" ? null : alertsFilter,
          limit: 100,
        },
      });
      if (res.data && res.data.success) {
        setAlerts(res.data.data || []);
      }
    } catch (e: any) {
      console.error("[TeltonikaTracking] Fetch alerts error:", e);
    } finally {
      setAlertsLoading(false);
    }
  }, [cleanApiBase, alertsFilter]);

  // Acknowledge Alert
  const acknowledgeAlert = async (alertId: number) => {
    try {
      await axios.post(`${cleanApiBase}/TeltonikaTracking/alerts/acknowledge`, null, {
        params: { alertId, acknowledgedBy: "Admin" },
      });
      setAlerts((prev) =>
        prev.map((a) => (a.alertId === alertId ? { ...a, isAcknowledged: true } : a))
      );
      setToastMsg("Alert marked as acknowledged.");
    } catch (e: any) {
      setToastMsg(`Error: ${e.message}`);
    }
  };

  // Fetch Geofences
  const fetchGeofences = useCallback(async () => {
    try {
      const res = await axios.get(`${cleanApiBase}/TeltonikaTracking/geofences`);
      if (res.data && res.data.success) {
        const list: TeltonikaGeofence[] = res.data.data || [];
        setGeofences(list);
        renderGeofencesOnMap(list);
      }
    } catch (e: any) {
      console.error("[TeltonikaTracking] Fetch geofences error:", e);
    }
  }, [cleanApiBase, renderGeofencesOnMap]);

  // Save New Geofence
  const saveGeofence = async () => {
    if (!newGeofenceName.trim()) {
      setToastMsg("Please enter a geofence name");
      return;
    }
    try {
      await axios.post(`${cleanApiBase}/TeltonikaTracking/geofences`, {
        name: newGeofenceName.trim(),
        type: "Circle",
        latitude: newGeofenceLat,
        longitude: newGeofenceLng,
        radiusMeters: newGeofenceRadius,
        speedLimit: newGeofenceSpeedLimit,
        alertOnEnter: true,
        alertOnExit: true,
        isActive: true,
      });
      setToastMsg("Geofence created successfully!");
      setShowAddGeofenceModal(false);
      setNewGeofenceName("");
      await fetchGeofences();
    } catch (e: any) {
      setToastMsg(`Failed to save geofence: ${e.message}`);
    }
  };

  // Delete Geofence
  const deleteGeofence = async (id: number) => {
    try {
      await axios.delete(`${cleanApiBase}/TeltonikaTracking/geofences/${id}`);
      setToastMsg("Geofence deleted");
      await fetchGeofences();
    } catch (e: any) {
      setToastMsg(`Delete error: ${e.message}`);
    }
  };

  // Fetch Commands History
  const fetchCommandsHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${cleanApiBase}/TeltonikaTracking/commands`, {
        params: { imei: selectedImei, limit: 50 },
      });
      if (res.data && res.data.success) {
        setCommandHistory(res.data.data || []);
      }
    } catch (e: any) {
      console.error("[TeltonikaTracking] Fetch commands error:", e);
    }
  }, [cleanApiBase, selectedImei]);

  // Send GPRS / Codec 12 Command
  const sendCommand = async (cmdText: string) => {
    if (!cmdText.trim()) return;
    setCommandSending(true);
    addLog("COMMAND", "info", `Dispatching GPRS Codec 12 Command: ${cmdText} to IMEI ${selectedImei}...`);

    try {
      const res = await axios.post(`${cleanApiBase}/TeltonikaTracking/command`, {
        imei: selectedImei,
        commandText: cmdText.trim(),
        codecType: "Codec12",
        createdBy: "Admin",
      });

      if (res.data && res.data.success) {
        setLatestCommandResult(res.data);
        setToastMsg(`Command executed: ${res.data.status}`);
        addLog(
          "COMMAND",
          "success",
          `Response for '${cmdText}': ${res.data.response || "ACK Received"} [HEX: ${res.data.codec12HexPacket}]`,
          res.data
        );
        await fetchCommandsHistory();
        await fetchDevices();
      }
    } catch (e: any) {
      setToastMsg(`Command failed: ${e.message}`);
      addLog("COMMAND", "error", `Command failed: ${e.message}`);
    } finally {
      setCommandSending(false);
      setCustomCommandText("");
    }
  };

  // Toggle Immobilizer Relay
  const handleToggleImmobilizer = (lock: boolean) => {
    setPendingImmobilizerState(lock);
    setShowImmobilizerConfirmModal(true);
  };

  const confirmToggleImmobilizer = async () => {
    setShowImmobilizerConfirmModal(false);
    const cmd = pendingImmobilizerState ? "setdigout 1" : "setdigout 0";

    console.warn(
      `%c🛑 [Teltonika Remote Engine Immobilizer] Executing '${cmd}' for vehicle: ${currentDevice?.vehicleNo || currentDevice?.imei}`,
      "color: #ef4444; font-weight: bold; font-size: 13px;"
    );
    console.table({
      "Action": pendingImmobilizerState ? "ENGAGE IMMOBILIZER (CUT ENGINE)" : "DISENGAGE IMMOBILIZER (RESTORE POWER)",
      "Target Relay": "DOUT1 (Starter / Fuel Cut-Off Relay)",
      "Command Sent": cmd,
      "Vehicle": currentDevice?.vehicleNo || currentDevice?.imei,
      "IMEI": currentDevice?.imei,
      "Expected Outcome": pendingImmobilizerState ? "Engine Switches OFF, Speed -> 0, RPM -> 0, AC -> OFF" : "Engine Starter Relay Restored"
    });

    // Optimistic device state update: immediately force engine cut if locking
    if (currentDevice?.imei) {
      setDevices((prev) =>
        prev.map((d) =>
          d.imei === currentDevice.imei
            ? {
                ...d,
                immobilizer: pendingImmobilizerState,
                ignition: pendingImmobilizerState ? false : d.ignition,
                engineRpm: pendingImmobilizerState ? 0 : d.engineRpm,
                speed: pendingImmobilizerState ? 0 : d.speed,
                acStatus: pendingImmobilizerState ? false : d.acStatus,
                deviceStatus: pendingImmobilizerState ? "Stopped" : d.deviceStatus,
              }
            : d
        )
      );
    }

    await sendCommand(cmd);
  };

  // Fetch Fleet Reports
  const fetchReports = useCallback(async () => {
    setReportLoading(true);
    try {
      const [tripRes, utilRes] = await Promise.all([
        axios.get(`${cleanApiBase}/TeltonikaTracking/reports/trips`, {
          params: { imei: selectedImei, fromDate: historyFromDate, toDate: historyToDate },
        }),
        axios.get(`${cleanApiBase}/TeltonikaTracking/reports/utilization`),
      ]);

      if (tripRes.data && tripRes.data.success) {
        setTripReport(tripRes.data.data);
      }
      if (utilRes.data && utilRes.data.success) {
        setFleetUtilization(utilRes.data.data || []);
      }
    } catch (e: any) {
      console.error("[TeltonikaTracking] Fetch reports error:", e);
    } finally {
      setReportLoading(false);
    }
  }, [cleanApiBase, selectedImei, historyFromDate, historyToDate]);

  // Load History Route for Trip Replay
  const loadHistoryRoute = async () => {
    setHistoryLoading(true);
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
        setIsReplaying(false);

        const map = mapInstanceRef.current;
        if (map && points.length > 0) {
          const latLngs: [number, number][] = points.map((p) => [Number(p.latitude), Number(p.longitude)]);

          if (polylineRef.current) {
            map.removeLayer(polylineRef.current);
          }
          if (replayMarkerRef.current) {
            map.removeLayer(replayMarkerRef.current);
          }

          const polyline = L.polyline(latLngs, {
            color: "#0284c7",
            weight: 5,
            opacity: 0.85,
            smoothFactor: 1,
          }).addTo(map);

          polylineRef.current = polyline;
          map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

          // Start & End Pins
          const startIcon = L.divIcon({
            className: "trip-pin start",
            html: '<div style="background:#10b981;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">A</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
          const endIcon = L.divIcon({
            className: "trip-pin end",
            html: '<div style="background:#ef4444;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">B</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          L.marker(latLngs[0], { icon: startIcon }).addTo(map).bindPopup("<b>Trip Start Position</b>");
          L.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(map).bindPopup("<b>Trip End Position</b>");

          // Moving Replay Marker
          const replayMarker = L.marker(latLngs[0], {
            icon: createCarIcon("moving", points[0].heading || 0),
          }).addTo(map);
          replayMarkerRef.current = replayMarker;
        }

        setToastMsg(`Loaded ${points.length} GPS trip breadcrumb records.`);
      }
    } catch (e: any) {
      setToastMsg(`Failed to load history: ${e.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Replay animation loop
  useEffect(() => {
    if (!isReplaying || historyPoints.length === 0) {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
      return;
    }

    const interval = Math.max(80, 1000 / replaySpeed);
    replayTimerRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= historyPoints.length - 1) {
          setIsReplaying(false);
          return prev;
        }
        const next = prev + 1;
        const pt = historyPoints[next];
        if (pt && replayMarkerRef.current && mapInstanceRef.current) {
          const latLng: [number, number] = [Number(pt.latitude), Number(pt.longitude)];
          replayMarkerRef.current.setLatLng(latLng);
          replayMarkerRef.current.setIcon(createCarIcon("moving", pt.heading || 0));
        }
        return next;
      });
    }, interval);

    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [isReplaying, historyPoints, replaySpeed]);

  // Flespi Telemetry Sync (Silent Auto-Fetch & Manual Click)
  const syncFlespiLive = useCallback(async (isSilent: boolean = false) => {
    if (!isSilent) {
      setIsSyncingFlespi(true);
      addLog("FLESPI", "info", "Sending telemetry sync request to Flespi Gateway (Device 9096406)...");
    } else {
      setIsAutoSyncing(true);
    }

    try {
      const res = await axios.post(`${cleanApiBase}/TeltonikaTracking/flespi-sync`, null, {
        params: {
          deviceId: 9096406,
          token: "TjBZOcnvDhNkh0Dd0dETO3DAo4sMfrPWCw8CxBmhHUF4nBh0T7NtzSpEeS5dcWyY",
        },
      });

      if (res.data && res.data.success) {
        setLastSyncTime(new Date().toLocaleTimeString());
        setSyncCount((c) => c + 1);

        if (!isSilent) {
          setToastMsg("✅ Realtime Telematics synced from Flespi Gateway!");
          addLog(
            "FLESPI",
            "success",
            `Flespi Gateway sync completed! Processed: ${res.data.processed ?? 1} record(s). Telemetry pipeline updated.`,
            res.data
          );
        }
        if (!isSilent || hubStatus !== "connected") {
          await fetchDevices();
        }
      } else if (!isSilent) {
        setToastMsg(res.data?.message || "Sync completed with no new records.");
      }
    } catch (err: any) {
      if (!isSilent) {
        setToastMsg(`Flespi sync failed: ${err.message}`);
        addLog("FLESPI", "error", `Flespi sync failed: ${err.message}`);
      }
    } finally {
      if (!isSilent) {
        setIsSyncingFlespi(false);
      } else {
        setIsAutoSyncing(false);
      }
    }
  }, [cleanApiBase, addLog, fetchDevices, hubStatus]);

  // Automatic Realtime Gateway Poller (Runs every 1.5 seconds)
  useEffect(() => {
    if (!autoLiveSync) return;

    // Run first sync immediately on component mount
    syncFlespiLive(true);

    const timer = setInterval(() => {
      syncFlespiLive(true);
    }, 1500);

    return () => clearInterval(timer);
  }, [autoLiveSync, syncFlespiLive]);

  // Quick Manual AC Toggle / Test Override
  const handleToggleAc = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentDevice?.imei) return;

    if (isImmobilized) {
      setToastMsg("Cannot operate AC while vehicle engine is remotely immobilized.");
      console.warn("[Teltonika AC Control] Blocked: Vehicle engine is remotely immobilized.");
      return;
    }

    const nextState = !effectiveAcStatus;

    console.info(
      `%c❄️ [Teltonika AC Control] Toggling AC for vehicle ${currentDevice?.vehicleNo || currentDevice?.imei}: ${effectiveAcStatus ? 'ON' : 'OFF'} -> ${nextState ? 'ON' : 'OFF'}`,
      "color: #06b6d4; font-weight: bold; font-size: 13px;"
    );
    console.table({
      "Vehicle": currentDevice?.vehicleNo || currentDevice?.imei,
      "IMEI": currentDevice.imei,
      "Previous AC State": effectiveAcStatus ? "ON" : "OFF",
      "Requested State": nextState ? "ON" : "OFF",
      "Engine Running": isEngineRunning ? "YES" : "NO",
      "Engine RPM": currentDevice?.engineRpm ?? 0,
      "Immobilizer": isImmobilized ? "ACTIVE (CUT)" : "OFF",
      "Endpoint": `${cleanApiBase}/TeltonikaTracking/toggle-ac?imei=${currentDevice.imei}&acStatus=${nextState}`
    });

    // Optimistic update
    setDevices((prev) =>
      prev.map((d) => (d.imei === currentDevice.imei ? { ...d, acStatus: nextState } : d))
    );

    try {
      const res = await axios.post(`${cleanApiBase}/TeltonikaTracking/toggle-ac`, null, {
        params: { imei: currentDevice.imei, acStatus: nextState },
      });
      if (res.data && res.data.success) {
        setToastMsg(`AC status switched to ${nextState ? "ON" : "OFF"}`);
        addLog("COMMAND", "info", `AC override dispatched: ${nextState ? "ON" : "OFF"}`);
      }
    } catch (err: any) {
      setToastMsg(`Failed to toggle AC: ${err.message}`);
      console.error("[Teltonika AC Control] Toggle AC error:", err);
      await fetchDevices();
    }
  };

  // SignalR Hub Connection
  useEffect(() => {
    const hubUrl = (API_BASE.startsWith("http")
      ? API_BASE.replace(/\/api\/$/, "")
      : window.location.origin) + "/teltonikaHub";
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    connection
      .start()
      .then(() => {
        setHubStatus("connected");
        addLog("SIGNALR", "success", `SignalR Realtime Telemetry Hub Connected (/teltonikaHub).`);
        connection.invoke("JoinDeviceGroup", selectedImei).catch(() => {});
      })
      .catch((err) => {
        setHubStatus("disconnected");
        addLog("SIGNALR", "warn", `SignalR WebSockets connection failed, using HTTP polling fallback: ${err.message}`);
      });

    connection.on("ReceiveTeltonikaLiveUpdate", (incomingDevice: TeltonikaDevice) => {
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.imei === incomingDevice.imei);
        if (idx >= 0) {
          const existing = prev[idx];
          const updated = [...prev];
          updated[idx] = {
            ...existing,
            ...incomingDevice,
            vehicleNo: incomingDevice.vehicleNo || existing.vehicleNo,
            deviceName: incomingDevice.deviceName || existing.deviceName,
            vin: incomingDevice.vin || existing.vin,
            speedLimit: incomingDevice.speedLimit || existing.speedLimit,
          };
          return updated;
        }
        return [incomingDevice, ...prev];
      });

      addLog(
        "TELEMETRY",
        "info",
        `Live Telemetry Broadcast [${incomingDevice.imei}]: Speed: ${incomingDevice.speed} km/h, Satellites: ${incomingDevice.satellites}, AC: ${incomingDevice.acStatus ? "ON" : "OFF"}, Door: ${incomingDevice.doorStatus ? "OPEN" : "CLOSED"}`
      );
    });

    hubConnectionRef.current = connection;
    return () => {
      connection.stop();
    };
  }, [selectedImei, addLog]);

  // Initial Data Loading
  useEffect(() => {
    fetchDevices();
    fetchAlerts();
    fetchGeofences();
    fetchCommandsHistory();
  }, [fetchDevices, fetchAlerts, fetchGeofences, fetchCommandsHistory]);

  // Refresh tab data when changing tabs
  useEffect(() => {
    if (activeTab === "alerts") fetchAlerts();
    if (activeTab === "reports") fetchReports();
    if (activeTab === "geofences") fetchGeofences();
    if (activeTab === "commands") fetchCommandsHistory();
  }, [activeTab, fetchAlerts, fetchReports, fetchGeofences, fetchCommandsHistory]);

  // Lifecycle
  useIonViewDidEnter(() => {
    initMap();
    if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
  });
  useIonViewWillLeave(() => {
    if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
  });

  useEffect(() => {
    initMap();
  }, [initMap]);

  // Update map marker when devices change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    devices.forEach((dev) => {
      if (!dev.latitude || !dev.longitude) return;

      const latLng: [number, number] = [Number(dev.latitude), Number(dev.longitude)];
      const icon = createCarIcon(dev.deviceStatus, dev.heading || 0);

      if (markersRef.current[dev.imei]) {
        const marker = markersRef.current[dev.imei];
        marker.setLatLng(latLng);
        marker.setIcon(icon);
      } else {
        const marker = L.marker(latLng, { icon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px; line-height: 1.5; color: #1e293b;">
            <strong style="color: var(--ion-color-primary, #0284c7); font-size: 14px;">${dev.deviceName || "Teltonika Vehicle"}</strong><br/>
            <b>Vehicle No:</b> ${dev.vehicleNo || "N/A"}<br/>
            <b>IMEI:</b> ${dev.imei}<br/>
            <b>Status:</b> ${dev.deviceStatus} (${dev.speed} km/h)<br/>
            <b>Ignition:</b> ${dev.ignition ? "ENGINE ON" : "ENGINE OFF"}<br/>
            <b>AC:</b> ${dev.acStatus ? "ON" : "OFF"}<br/>
            <b>Door:</b> ${dev.doorStatus ? "OPEN" : "CLOSED"}<br/>
            <b>Immobilizer:</b> ${dev.immobilizer ? "LOCKED" : "UNLOCKED"}
          </div>
        `);
        markersRef.current[dev.imei] = marker;
      }
    });

    if (activeTab === "live" && followVehicle && currentDevice?.latitude && currentDevice?.longitude) {
      map.panTo([Number(currentDevice.latitude), Number(currentDevice.longitude)], { animate: true });
    }
  }, [devices, activeTab, followVehicle, currentDevice]);

  // Helper to parse DTC codes
  const parseDtcCodes = (dtcRaw?: string) => {
    if (!dtcRaw) return [];
    try {
      const parsed = JSON.parse(dtcRaw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === "string" ? { code: item, standard: "OBDII" } : item));
      }
      if (typeof parsed === "object" && parsed.code) return [parsed];
    } catch {
      return dtcRaw.split(",").map((s) => ({ code: s.trim(), standard: "OBDII" })).filter((x) => x.code.length > 0);
    }
    return [];
  };

  return (
    <IonPage className="teltonika-page">
      <IonContent fullscreen className="teltonika-content">
        <div className="teltonika-container">
          {/* Header */}
          <div className="teltonika-header">
            <div className="teltonika-header-left">
              <div className="teltonika-title-group">
                <h1>
                  <Car size={22} /> Teltonika Fleet Management System
                </h1>
                <p>Enterprise GPS Tracking, CAN/OBD-II Telematics & Remote Command Center</p>
              </div>

              <div className={`live-status-pill ${hubStatus}`}>
                <span className="pulse-dot"></span>
                <span>{hubStatus === "connected" ? "Live Stream Active" : "Polling Active"}</span>
              </div>
            </div>

            <div className="teltonika-header-right">
              {/* Navigation Tabs */}
              <div className="teltonika-tabs">
                <button
                  className={`teltonika-tab-btn ${activeTab === "live" ? "active" : ""}`}
                  onClick={() => setActiveTab("live")}
                  title="Live Telematics & GPS Map"
                >
                  <Navigation size={14} /> Live
                </button>
                <button
                  className={`teltonika-tab-btn ${activeTab === "history" ? "active" : ""}`}
                  onClick={() => setActiveTab("history")}
                  title="Trip & Route History Playback"
                >
                  <RotateCcw size={14} /> History
                </button>
                <button
                  className={`teltonika-tab-btn ${activeTab === "alerts" ? "active" : ""}`}
                  onClick={() => setActiveTab("alerts")}
                  title="Fleet Alerts & Diagnostics"
                >
                  <Bell size={14} /> Alerts
                  {alerts.filter((a) => !a.isAcknowledged).length > 0 && (
                    <span className="console-count" style={{ background: "#ef4444", marginLeft: "4px" }}>
                      {alerts.filter((a) => !a.isAcknowledged).length}
                    </span>
                  )}
                </button>
                <button
                  className={`teltonika-tab-btn ${activeTab === "reports" ? "active" : ""}`}
                  onClick={() => setActiveTab("reports")}
                  title="Fleet Utilization & Trip Reports"
                >
                  <TrendingUp size={14} /> Reports
                </button>
                <button
                  className={`teltonika-tab-btn ${activeTab === "geofences" ? "active" : ""}`}
                  onClick={() => setActiveTab("geofences")}
                  title="Geofences & Safety Perimeters"
                >
                  <MapPin size={14} /> Geofences
                </button>
                <button
                  className={`teltonika-tab-btn ${activeTab === "commands" ? "active" : ""}`}
                  onClick={() => setActiveTab("commands")}
                  title="Remote GPRS Commands & Engine Immobilizer"
                >
                  <Send size={14} /> Commands
                </button>
                <button
                  className={`teltonika-tab-btn ${activeTab === "setup" ? "active" : ""}`}
                  onClick={() => setActiveTab("setup")}
                  title="Teltonika Device & Server Setup Guide"
                >
                  <Server size={14} /> Setup
                </button>
                <button
                  className={`teltonika-tab-btn ${showConsole ? "active" : ""}`}
                  onClick={() => setShowConsole((prev) => !prev)}
                  title="Toggle Diagnostic Terminal Console"
                >
                  <Terminal size={14} /> Console
                </button>
              </div>

              {/* Realtime Auto-Fetch & Gateway Sync Controls */}
              <div className="teltonika-autofetch-cluster">
                {/* Auto-Fetch Status & Pause/Resume Pill */}
                <button
                  type="button"
                  className={`teltonika-autofetch-pill ${autoLiveSync ? "active" : "paused"}`}
                  onClick={() => {
                    const next = !autoLiveSync;
                    setAutoLiveSync(next);
                    setToastMsg(next ? "🟢 Auto-Fetch resumed (polling every 1.5s)" : "⏸️ Auto-Fetch paused");
                  }}
                  title={autoLiveSync ? "Auto-fetch is ACTIVE (Every 1.5s). Click to pause." : "Auto-fetch is PAUSED. Click to resume."}
                >
                  <span className={`autofetch-pulse-dot ${autoLiveSync ? "pulsing" : ""}`} />
                  <span className="autofetch-text">
                    {autoLiveSync ? "Auto-Fetch: 1.5s" : "Auto-Fetch: Paused"}
                  </span>
                  {autoLiveSync ? <Pause size={12} /> : <Play size={12} />}
                </button>

                {/* Force Manual Sync Button */}
                <button
                  type="button"
                  className={`teltonika-sync-flespi-btn ${isSyncingFlespi ? "syncing" : ""}`}
                  onClick={() => syncFlespiLive(false)}
                  disabled={isSyncingFlespi}
                  title={`Force Instant Gateway Sync • Last synced: ${lastSyncTime}`}
                >
                  <CloudDownload size={14} className={isAutoSyncing || isSyncingFlespi ? "spin-sync-icon" : ""} />
                  <span>{isSyncingFlespi ? "Syncing..." : "Sync Now"}</span>
                </button>

                {/* Silent Refresh Button */}
                <button
                  type="button"
                  className="teltonika-btn-icon"
                  onClick={fetchDevices}
                  title={`Manual Refresh • Last updated: ${lastSyncTime} (${syncCount} syncs)`}
                >
                  <RefreshCw size={14} className={isAutoSyncing ? "spin-sync-icon" : ""} />
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1 & 2: LIVE MAP WORKSPACE */}
          {(activeTab === "live" || activeTab === "history") && (
            <div className="teltonika-main-layout">
              {/* Sidebar */}
              <div className="teltonika-sidebar">
                {/* Active Vehicle Card */}
                <div className="device-select-section">
                  <div className="device-card-active">
                    <div className="device-card-header">
                      <div className="device-name-wrap">
                        <div className="device-avatar">
                          <Car size={20} />
                        </div>
                        <div>
                          <div className="device-title">
                            {currentDevice?.vehicleNo || currentDevice?.deviceName || "Teltonika Vehicle"}
                          </div>
                          <div className="device-imei">
                            IMEI: {currentDevice?.imei || selectedImei} • {currentDevice?.deviceModel || "FMC003"}
                          </div>
                        </div>
                      </div>

                      <div className={`status-badge ${isImmobilized ? "danger" : (currentDevice?.deviceStatus || "offline").toLowerCase()}`} style={isImmobilized ? { background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)", fontWeight: 700 } : undefined}>
                        {isImmobilized ? "IMMOBILIZED (CUT)" : currentDevice?.deviceStatus || "Offline"}
                      </div>
                    </div>

                    {/* VIN Badge */}
                    <div className="device-vin-card">
                      <div className="vin-label">
                        <span>VEHICLE IDENTIFICATION (VIN)</span>
                        <span className="vin-verified-badge">
                          <CheckCircle2 size={12} /> OBD-II VERIFIED
                        </span>
                      </div>
                      <div className="vin-code-row">
                        <Cpu size={15} className="vin-icon" />
                        <span className="vin-code">{currentDevice?.vin || "MALPC816VRM875293"}</span>
                      </div>
                    </div>

                    {devices.length > 1 && (
                      <div className="vehicle-selector-wrapper">
                        <label className="vehicle-selector-label">
                          <Car size={12} /> Switch Fleet Unit ({devices.length} Available)
                        </label>
                        <div className="vehicle-select-control">
                          <select
                            className="vehicle-dropdown-select"
                            value={selectedImei}
                            onChange={(e) => setSelectedImei(e.target.value)}
                          >
                            {devices.map((d) => (
                              <option key={d.imei} value={d.imei}>
                                {d.vehicleNo || d.deviceName} • {d.deviceModel || "FMC003"} ({d.imei.slice(-6)})
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="vehicle-select-arrow" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* LIVE TAB TELEMETRY */}
                {activeTab === "live" && (
                  <div className="telemetry-section">
                    {/* OBD-II Fault Codes Banner */}
                    {(() => {
                      const dtcs = parseDtcCodes(currentDevice?.dtcFaultCodes);
                      const hasActiveDtc = dtcs.length > 0;
                      if (hasActiveDtc) {
                        return (
                          <div className="dtc-alert-box active">
                            <div className="dtc-alert-header">
                              <div className="dtc-title-group">
                                <AlertTriangle size={18} className="dtc-icon" />
                                <span className="dtc-title">Active OBD-II Fault Code</span>
                              </div>
                              <span className="dtc-count-pill">{dtcs.length} MIL Code{dtcs.length > 1 ? "s" : ""}</span>
                            </div>
                            <div className="dtc-list">
                              {dtcs.map((dtc: any, idx: number) => {
                                const codeStr = String(dtc.code || dtc || "").toUpperCase();
                                const systemName = codeStr.startsWith("P")
                                  ? "Powertrain System (Engine & Transmission)"
                                  : codeStr.startsWith("C")
                                  ? "Chassis System (Brakes & Steering)"
                                  : codeStr.startsWith("B")
                                  ? "Body Electronics (Lighting & Climate)"
                                  : codeStr.startsWith("U")
                                  ? "Network & Bus Communication"
                                  : "Diagnostic Trouble Code";
                                return (
                                  <div key={idx} className="dtc-item">
                                    <div className="dtc-code-badge">{codeStr}</div>
                                    <div className="dtc-item-details">
                                      <div className="dtc-code-name">
                                        {dtc.description || (codeStr === "U04B1" ? "Invalid Data From Headlamp Module" : "CAN Telematics DTC")}
                                      </div>
                                      <div className="dtc-code-system">Standard: {dtc.standard || "OBDII"} • {systemName}</div>
                                    </div>
                                  </div>
                                );
                              })}
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

                    {/* Sensor & Accessories Quick Indicators Grid */}
                    <div className="quick-indicators-grid">
                      {/* AC Status */}
                      <button
                        type="button"
                        className={`quick-indicator-item ac-item ${effectiveAcStatus ? "on" : "off"}`}
                        onClick={handleToggleAc}
                        title={`Air Conditioner: ${effectiveAcStatus ? "ON" : "OFF"} (${acStateReason}) • Click to test/toggle`}
                      >
                        <div className="quick-indicator-icon">
                          <Wind size={14} className={effectiveAcStatus ? "ac-fan-spin" : ""} />
                        </div>
                        <div className="quick-indicator-content">
                          <span className="quick-indicator-label">Air Conditioner</span>
                          <span className="quick-indicator-val" style={{ color: effectiveAcStatus ? "#06b6d4" : undefined }}>
                            {effectiveAcStatus ? "ACTIVE (ON)" : "INACTIVE (OFF)"}
                          </span>
                        </div>
                      </button>

                      {/* Door Status */}
                      <div className={`quick-indicator-item door-item ${currentDevice?.doorStatus ? "open" : "closed"}`}>
                        <div className="quick-indicator-icon">
                          <ShieldAlert size={14} />
                        </div>
                        <div className="quick-indicator-content">
                          <span className="quick-indicator-label">Vehicle Doors</span>
                          <span className="quick-indicator-val" style={{ color: currentDevice?.doorStatus ? "#d97706" : "#059669" }}>
                            {currentDevice?.doorStatus ? "DOOR OPEN" : "ALL CLOSED"}
                          </span>
                        </div>
                      </div>

                      {/* Immobilizer Relay */}
                      <div className={`quick-indicator-item relay-item ${isImmobilized ? "locked" : "active"}`}>
                        <div className="quick-indicator-icon">
                          {isImmobilized ? <Lock size={14} /> : <Unlock size={14} />}
                        </div>
                        <div className="quick-indicator-content">
                          <span className="quick-indicator-label">Starter Relay</span>
                          <span className="quick-indicator-val" style={{ color: isImmobilized ? "#dc2626" : "#059669" }}>
                            {isImmobilized ? "ENGINE CUT" : "RELAY NORMAL"}
                          </span>
                        </div>
                      </div>

                      {/* Driver ID */}
                      <div className="quick-indicator-item driver-item">
                        <div className="quick-indicator-icon">
                          <UserCheck size={14} />
                        </div>
                        <div className="quick-indicator-content">
                          <span className="quick-indicator-label">Assigned Driver</span>
                          <span className="quick-indicator-val">{currentDevice?.driverId || "Unassigned"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="section-label">Realtime Telematics & Health</div>

                    <div className="telemetry-grid">
                      {/* 1. Speed */}
                      <div className={`telemetry-card ${effectiveSpeed > 0 ? "highlight" : ""} ${isOverspeeding ? "engine-on-active" : ""}`}>
                        <div className="telemetry-card-top">
                          <span>Speed</span>
                          <Gauge size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">{effectiveSpeed}</span>
                          <span className="telemetry-unit">km/h</span>
                        </div>
                        <div className="telemetry-subtext" style={{ color: isOverspeeding ? "#ef4444" : undefined }}>
                          {isOverspeeding ? `⚠️ OVERSPEED (Limit ${speedLimit} km/h)` : `Speed Limit: ${speedLimit} km/h`}
                        </div>
                      </div>

                      {/* 2. Smart Engine */}
                      <div className={`telemetry-card ${isImmobilized ? "engine-cut-active" : isEngineRunning ? "engine-on-active" : ""}`}>
                        <div className="telemetry-card-top">
                          <span>Smart Engine</span>
                          {isImmobilized ? (
                            <Lock size={16} className="text-rose-500" />
                          ) : (
                            <Zap size={16} className={isEngineRunning ? "text-emerald-400 glow-spark" : "text-slate-400"} />
                          )}
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className={`ignition-pill ${isImmobilized ? "cut" : isEngineRunning ? "on" : "off"}`}>
                            {isImmobilized ? "ENGINE CUT" : isEngineRunning ? "ENGINE ON" : "ENGINE OFF"}
                          </span>
                        </div>
                        <div className="telemetry-subtext" style={{ color: isImmobilized ? "#ef4444" : isEngineRunning ? "#059669" : undefined }} title={engineStateReason}>
                          {engineStateReason}
                        </div>
                      </div>

                      {/* 3. Engine RPM */}
                      <div className="telemetry-card">
                        <div className="telemetry-card-top">
                          <span>Engine RPM</span>
                          <Activity size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">{currentDevice?.engineRpm ?? 0}</span>
                          <span className="telemetry-unit">rpm</span>
                        </div>
                        <div className="telemetry-subtext">
                          {isEngineRunning ? (currentDevice?.engineRpm ? `${currentDevice.engineRpm} RPM Combustion` : "Idle Baseline") : "Combustion Inactive"}
                        </div>
                      </div>

                      {/* 4. Engine Load */}
                      <div className="telemetry-card highlight-cyan">
                        <div className="telemetry-card-top">
                          <span>Engine Load</span>
                          <Cpu size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">{currentDevice?.engineLoad ?? 18}</span>
                          <span className="telemetry-unit">%</span>
                        </div>
                        <div>
                          <div className="engine-load-bar-wrap">
                            <div
                              className="engine-load-bar-fill"
                              style={{ width: `${Math.min(100, Math.max(0, currentDevice?.engineLoad ?? 18))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 5. Air Conditioner (AC) */}
                      <div
                        className={`telemetry-card ${effectiveAcStatus ? "highlight-cyan ac-card-active" : ""}`}
                        onClick={handleToggleAc}
                        style={{ cursor: "pointer" }}
                        title={`Click to test/toggle AC status • ${acStateReason}`}
                      >
                        <div className="telemetry-card-top">
                          <span>Air Conditioner</span>
                          <Wind size={16} className={effectiveAcStatus ? "ac-fan-spin text-cyan-400" : "text-slate-400"} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value" style={{ fontSize: "1.05rem", color: effectiveAcStatus ? "#0891b2" : "#64748b" }}>
                            {effectiveAcStatus ? "COOLING ACTIVE" : "OFF / VENT"}
                          </span>
                        </div>
                        <div className="telemetry-subtext" style={{ color: effectiveAcStatus ? "#06b6d4" : undefined }} title={acStateReason}>
                          {acStateReason}
                        </div>
                      </div>

                      {/* 6. Fuel Volume */}
                      <div className="telemetry-card">
                        <div className="telemetry-card-top">
                          <span>Fuel Volume</span>
                          <Fuel size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">{currentDevice?.fuelVolume ?? 22}</span>
                          <span className="telemetry-unit">L</span>
                        </div>
                        <div className="telemetry-subtext">
                          Tank Capacity: ~48% Full
                        </div>
                      </div>

                      {/* 7. Cluster Mileage */}
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
                        <div className="telemetry-subtext">
                          Digital CAN Odometer
                        </div>
                      </div>

                      {/* 8. Battery Voltage */}
                      <div className="telemetry-card">
                        <div className="telemetry-card-top">
                          <span>Battery Voltage</span>
                          <Battery size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">
                            {currentDevice?.externalVoltage
                              ? currentDevice.externalVoltage.toFixed(2)
                              : currentDevice?.batteryVoltage
                              ? currentDevice.batteryVoltage.toFixed(2)
                              : "12.60"}
                          </span>
                          <span className="telemetry-unit">V</span>
                        </div>
                        <div className="telemetry-subtext">
                          Backup: {currentDevice?.batteryVoltage ? `${currentDevice.batteryVoltage.toFixed(2)}V` : "4.10V"}
                        </div>
                      </div>

                      {/* 9. Coolant Temp */}
                      <div className="telemetry-card">
                        <div className="telemetry-card-top">
                          <span>Coolant Temp</span>
                          <Thermometer size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">{currentDevice?.coolantTemp ?? 88}</span>
                          <span className="telemetry-unit">°C</span>
                        </div>
                        <div className="telemetry-subtext">
                          Optimal Range (80–95°C)
                        </div>
                      </div>

                      {/* 10. GPS Satellites */}
                      <div className="telemetry-card">
                        <div className="telemetry-card-top">
                          <span>GPS Satellites</span>
                          <Compass size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">{currentDevice?.satellites ?? 14}</span>
                          <span className="telemetry-unit">locked</span>
                        </div>
                        <div className="telemetry-subtext">
                          3D GNSS Fix • HDOP 1.0
                        </div>
                      </div>

                      {/* 11. GSM Signal */}
                      <div className="telemetry-card">
                        <div className="telemetry-card-top">
                          <span>GSM Signal</span>
                          <Signal size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">{currentDevice?.gsmSignal ?? 100}</span>
                          <span className="telemetry-unit">%</span>
                        </div>
                        <div className="telemetry-subtext">
                          4G LTE Network Connected
                        </div>
                      </div>

                      {/* 12. Altitude & Fix */}
                      <div className="telemetry-card">
                        <div className="telemetry-card-top">
                          <span>Altitude & Fix</span>
                          <Navigation size={16} />
                        </div>
                        <div className="telemetry-value-wrap">
                          <span className="telemetry-value">{currentDevice?.altitude ? Math.round(currentDevice.altitude) : 34}</span>
                          <span className="telemetry-unit">m</span>
                        </div>
                        <div className="telemetry-subtext">
                          Heading: {Math.round(currentDevice?.heading ?? 0)}° • MSL Elevation
                        </div>
                      </div>
                    </div>

                    {/* Last Communication Time */}
                    <div className="teltonika-last-ping-box">
                      <div className="ping-title">Last Report:</div>
                      <div className="ping-time">
                        {currentDevice?.lastCommunicationTime
                          ? new Date(currentDevice.lastCommunicationTime).toLocaleString()
                          : "Awaiting first transmission"}
                      </div>
                    </div>
                  </div>
                )}

                {/* HISTORY TAB REPLAY CONTROLS */}
                {activeTab === "history" && (
                  <div className="history-section">
                    <div className="section-label">Trip Route Replay & Playback</div>

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
                          <button className="replay-btn" onClick={() => setIsReplaying(!isReplaying)}>
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

                          <div style={{ display: "flex", gap: "4px", marginLeft: "6px" }}>
                            {[1, 2, 5, 10].map((s) => (
                              <button
                                key={s}
                                className={`filter-chip ${replaySpeed === s ? "active" : ""}`}
                                onClick={() => setReplaySpeed(s)}
                                style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                              >
                                {s}x
                              </button>
                            ))}
                          </div>
                        </div>

                        {historyPoints[replayIndex] && (
                          <div className="history-point-details">
                            <div>
                              <b>Time:</b> {new Date(historyPoints[replayIndex].recordTimestamp).toLocaleTimeString()}
                            </div>
                            <div>
                              <b>Speed:</b> {historyPoints[replayIndex].speed ?? 0} km/h
                            </div>
                            <div>
                              <b>RPM:</b> {historyPoints[replayIndex].engineRpm ?? 0}
                            </div>
                            {historyPoints[replayIndex].fuelVolume && (
                              <div>
                                <b>Fuel:</b> {historyPoints[replayIndex].fuelVolume} L
                              </div>
                            )}
                            {historyPoints[replayIndex].canMileage && (
                              <div>
                                <b>Mileage:</b> {historyPoints[replayIndex].canMileage?.toLocaleString()} km
                              </div>
                            )}
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

                {/* Floating Metric HUD Overlay - Pinned to Top-Right */}
                <div className="map-overlay-card">
                  <div className="overlay-metric">
                    <span className="overlay-label">Device</span>
                    <span className="overlay-val overlay-badge-chip">
                      {currentDevice?.deviceModel || "FMC003"}
                    </span>
                  </div>
                  <div className="overlay-divider" />
                  <div className="overlay-metric">
                    <span className="overlay-label">Vehicle</span>
                    <span className="overlay-val overlay-val-vehicle">
                      {currentDevice?.vehicleNo || "AP-16-TEST"}
                    </span>
                  </div>
                  <div className="overlay-divider" />
                  <div
                    className="overlay-metric"
                    onClick={() => {
                      if (currentDevice?.latitude && currentDevice?.longitude) {
                        navigator.clipboard?.writeText(
                          `${currentDevice.latitude.toFixed(5)}, ${currentDevice.longitude.toFixed(5)}`
                        );
                        setToastMsg("📋 Coordinates copied to clipboard");
                      }
                    }}
                    style={{ cursor: "pointer" }}
                    title="Click to copy coordinates"
                  >
                    <span className="overlay-label">Coordinates</span>
                    <span className="overlay-val overlay-val-mono">
                      {currentDevice?.latitude
                        ? `${currentDevice.latitude.toFixed(5)}, ${currentDevice.longitude?.toFixed(5)}`
                        : "No GPS Fix"}
                    </span>
                  </div>
                  <div className="overlay-divider" />
                  <div className="overlay-metric">
                    <span className="overlay-label">Protocol</span>
                    <span className="overlay-val overlay-val-protocol">
                      Codec 8 Ext / 12
                    </span>
                  </div>
                  <div className="overlay-divider" />
                  <div className="overlay-metric">
                    <span className="overlay-label">Motion State</span>
                    <span
                      className={`overlay-status-pill ${
                        isImmobilized
                          ? "cut"
                          : isEngineRunning
                          ? effectiveSpeed > 0
                            ? "moving"
                            : "idle"
                          : "stopped"
                      }`}
                    >
                      {isImmobilized
                        ? "IMMOBILIZED"
                        : isEngineRunning
                        ? effectiveSpeed > 0
                          ? `MOVING ${effectiveSpeed} km/h`
                          : "ENGINE IDLE"
                        : "STOPPED"}
                    </span>
                  </div>
                </div>

                {/* Tactical Offline Grid Notice */}
                {tileBlocked && (
                  <div className="proxy-notice-pill">
                    <span>🔒 Intranet Proxy Active • Tactical Offline Grid Running</span>
                    <button
                      type="button"
                      className="proxy-dismiss-btn"
                      onClick={() => setTileBlocked(false)}
                      title="Dismiss notice"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Map Style & Follower Control Dock - Pinned to Bottom-Left */}
                <div className="map-style-toggle-bar">
                  <div className="map-style-group">
                    <button
                      className={`map-style-btn ${mapStyle === "grid" ? "active" : ""}`}
                      onClick={() => changeMapStyle("grid")}
                      title="Tactical Offline Grid"
                    >
                      <Grid size={13} /> Grid
                    </button>
                    <button
                      className={`map-style-btn ${mapStyle === "streets" ? "active" : ""}`}
                      onClick={() => changeMapStyle("streets")}
                      title="OpenStreetMap Standard"
                    >
                      <MapIcon size={13} /> Streets
                    </button>
                    <button
                      className={`map-style-btn ${mapStyle === "voyager" ? "active" : ""}`}
                      onClick={() => changeMapStyle("voyager")}
                      title="CARTO Voyager"
                    >
                      <Compass size={13} /> Voyager
                    </button>
                    <button
                      className={`map-style-btn ${mapStyle === "satellite" ? "active" : ""}`}
                      onClick={() => changeMapStyle("satellite")}
                      title="ArcGIS Satellite Imagery"
                    >
                      <Globe size={13} /> Satellite
                    </button>
                  </div>

                  <div className="map-control-divider" />

                  {/* Follow Center Toggle */}
                  <button
                    className={`map-style-btn follow-btn ${followVehicle ? "active" : ""}`}
                    onClick={() => setFollowVehicle(!followVehicle)}
                    title={
                      followVehicle
                        ? "Vehicle auto-centering is ACTIVE. Click to disable."
                        : "Click to automatically center vehicle"
                    }
                  >
                    <Crosshair size={13} /> Follow: {followVehicle ? "ON" : "OFF"}
                  </button>

                  {/* Recenter Button */}
                  <button
                    className="map-style-btn recenter-btn"
                    onClick={() => {
                      if (mapInstanceRef.current && currentDevice?.latitude && currentDevice?.longitude) {
                        mapInstanceRef.current.setView(
                          [Number(currentDevice.latitude), Number(currentDevice.longitude)],
                          15,
                          { animate: true }
                        );
                        setFollowVehicle(true);
                      }
                    }}
                    title="Center view on vehicle"
                  >
                    <Target size={13} /> Center
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ALERTS & SAFETY CENTER */}
          {activeTab === "alerts" && (
            <div className="teltonika-tab-content-full">
              {/* Header KPI Summary */}
              <div className="fleet-kpi-grid">
                <div className="fleet-kpi-card">
                  <div className="fleet-kpi-icon rose">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="fleet-kpi-info">
                    <span className="fleet-kpi-val">{alerts.filter((a) => a.severity === "Critical").length}</span>
                    <span className="fleet-kpi-lbl">Critical Alerts</span>
                  </div>
                </div>
                <div className="fleet-kpi-card">
                  <div className="fleet-kpi-icon amber">
                    <ShieldAlert size={20} />
                  </div>
                  <div className="fleet-kpi-info">
                    <span className="fleet-kpi-val">{alerts.filter((a) => a.severity === "Warning").length}</span>
                    <span className="fleet-kpi-lbl">Warnings</span>
                  </div>
                </div>
                <div className="fleet-kpi-card">
                  <div className="fleet-kpi-icon blue">
                    <Bell size={20} />
                  </div>
                  <div className="fleet-kpi-info">
                    <span className="fleet-kpi-val">{alerts.filter((a) => a.severity === "Info").length}</span>
                    <span className="fleet-kpi-lbl">Info Events</span>
                  </div>
                </div>
                <div className="fleet-kpi-card">
                  <div className="fleet-kpi-icon emerald">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="fleet-kpi-info">
                    <span className="fleet-kpi-val">{alerts.filter((a) => a.isAcknowledged).length}</span>
                    <span className="fleet-kpi-lbl">Acknowledged</span>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              <div className="alerts-toolbar">
                <div className="alerts-filter-group">
                  <span>FILTER:</span>
                  {["ALL", "Critical", "Warning", "Info"].map((sev) => (
                    <button
                      key={sev}
                      className={`filter-chip ${alertsFilter === sev ? "active" : ""}`}
                      onClick={() => setAlertsFilter(sev)}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <button className="teltonika-btn-icon" onClick={fetchAlerts} title="Refresh Alerts">
                  <RefreshCw size={15} />
                </button>
              </div>

              {/* Alerts Feed */}
              {alertsLoading ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <IonSpinner name="dots" />
                </div>
              ) : alerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>
                  <CheckCircle2 size={40} style={{ margin: "0 auto 10px", color: "#10b981" }} />
                  <h3>All clear! No alerts reported for this criteria.</h3>
                </div>
              ) : (
                <div className="alerts-list">
                  {alerts.map((alert) => (
                    <div
                      key={alert.alertId}
                      className={`alert-card ${alert.severity.toLowerCase()} ${alert.isAcknowledged ? "acknowledged" : ""}`}
                    >
                      <div className="alert-card-left">
                        <div className="alert-icon-box">
                          {alert.severity === "Critical" ? (
                            <AlertTriangle size={18} />
                          ) : alert.severity === "Warning" ? (
                            <ShieldAlert size={18} />
                          ) : (
                            <Bell size={18} />
                          )}
                        </div>
                        <div>
                          <div className="alert-message">{alert.message}</div>
                          <div className="alert-meta">
                            <span>Vehicle: {alert.vehicleNo || alert.imei}</span>
                            <span>•</span>
                            <span>Type: {alert.alertType}</span>
                            <span>•</span>
                            <span>Time: {new Date(alert.createdAt).toLocaleString()}</span>
                            {alert.speed && <span>• Speed: {alert.speed} km/h</span>}
                          </div>
                        </div>
                      </div>

                      <div>
                        {alert.isAcknowledged ? (
                          <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600 }}>
                            ✓ Acknowledged
                          </span>
                        ) : (
                          <button className="alert-ack-btn" onClick={() => acknowledgeAlert(alert.alertId)}>
                            <CheckCircle2 size={13} /> Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FLEET REPORTS & ANALYTICS */}
          {activeTab === "reports" && (
            <div className="teltonika-tab-content-full">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Fleet Utilization & Trip Reports</h2>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                    Comprehensive distance, engine hours, idle times, and event summaries
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="teltonika-tab-btn active"
                    onClick={() => {
                      const csvContent =
                        "data:text/csv;charset=utf-8," +
                        ["VehicleNo,IMEI,Model,Speed,Status,Odometer,EngineHours,AlertsToday"].join(",") +
                        "\n" +
                        fleetUtilization
                          .map((u) => `${u.vehicleNo},${u.imei},${u.deviceModel},${u.currentSpeed},${u.deviceStatus},${u.totalOdometerKm},${u.engineOperatingHours},${u.todayAlertsCount}`)
                          .join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `fleet_report_${new Date().toISOString().slice(0, 10)}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Trip Summary Card for Selected Vehicle */}
              {tripReport && (
                <div className="command-card" style={{ background: "linear-gradient(135deg, rgba(2,132,199,0.06) 0%, rgba(16,185,129,0.06) 100%)" }}>
                  <div className="command-card-title">
                    <FileText size={16} /> Trip Breakdown Summary for Selected Period
                  </div>
                  <div className="fleet-kpi-grid">
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>TOTAL DISTANCE</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{tripReport.distanceTravelledKm?.toFixed(1) ?? 0} km</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>MAX SPEED</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{tripReport.maxSpeed ?? 0} km/h</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>AVERAGE SPEED</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{tripReport.avgSpeed ?? 0} km/h</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>EST. FUEL CONSUMPTION</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{tripReport.estFuelConsumedLiters?.toFixed(1) ?? 0} L</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>DURATION</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{Math.floor(tripReport.durationMinutes / 60)}h {tripReport.durationMinutes % 60}m</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fleet Utilization Table */}
              <div className="fleet-table-container">
                <table className="fleet-table">
                  <thead>
                    <tr>
                      <th>Vehicle No</th>
                      <th>Device Name</th>
                      <th>Model</th>
                      <th>Status</th>
                      <th>Speed</th>
                      <th>Ignition</th>
                      <th>AC</th>
                      <th>Odometer</th>
                      <th>Fuel</th>
                      <th>Engine Hours</th>
                      <th>Alerts Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleetUtilization.map((u) => (
                      <tr key={u.imei}>
                        <td style={{ fontWeight: 700 }}>{u.vehicleNo || "N/A"}</td>
                        <td>{u.deviceName}</td>
                        <td>{u.deviceModel}</td>
                        <td>
                          <span className={`status-badge ${u.deviceStatus.toLowerCase()}`}>{u.deviceStatus}</span>
                        </td>
                        <td>{u.currentSpeed} km/h</td>
                        <td>
                          <span className={`ignition-pill ${u.currentIgnition ? "on" : "off"}`} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                            {u.currentIgnition ? "ON" : "OFF"}
                          </span>
                        </td>
                        <td>
                          <span className={`ac-pill ${u.currentAc ? "on" : "off"}`}>{u.currentAc ? "ON" : "OFF"}</span>
                        </td>
                        <td>{u.totalOdometerKm?.toLocaleString()} km</td>
                        <td>{u.fuelVolumeLiters} L</td>
                        <td>{u.engineOperatingHours} hrs</td>
                        <td>{u.todayAlertsCount > 0 ? <span style={{ color: "#ef4444", fontWeight: 700 }}>{u.todayAlertsCount}</span> : "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: GEOFENCES */}
          {activeTab === "geofences" && (
            <div className="teltonika-tab-content-full">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Geofences & Safety Zones</h2>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                    Configure automated enter/exit notifications and speed limits
                  </p>
                </div>

                <button className="teltonika-tab-btn active" onClick={() => setShowAddGeofenceModal(true)}>
                  <MapPin size={14} /> Add New Geofence
                </button>
              </div>

              <div className="geofence-grid">
                {geofences.map((gf) => (
                  <div key={gf.geofenceId} className="geofence-card">
                    <div className="geofence-header">
                      <span className="geofence-title">{gf.name}</span>
                      <span className="filter-chip active">{gf.type}</span>
                    </div>

                    <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Radius: <b>{gf.radiusMeters} meters</b> • Speed Limit: <b>{gf.speedLimit} km/h</b>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                      Center: {gf.latitude.toFixed(4)}, {gf.longitude.toFixed(4)}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <span style={{ fontSize: "0.72rem", color: gf.isActive ? "#10b981" : "#94a3b8" }}>
                        {gf.isActive ? "● Active Protection" : "Disabled"}
                      </span>
                      <button
                        className="teltonika-btn-icon"
                        style={{ color: "#ef4444" }}
                        onClick={() => deleteGeofence(gf.geofenceId)}
                        title="Delete Geofence"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: COMMANDS & ENGINE IMMOBILIZER (Codec 12 / GPRS / SMS) */}
          {activeTab === "commands" && (
            <div className="teltonika-tab-content-full">
              <div className="command-panel-grid">
                {/* DOUT1 Immobilizer Card */}
                <div className="command-card">
                  <div className="command-card-title">
                    <Lock size={18} /> Remote Engine Immobilizer (DOUT1 Relay Control)
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0 0 10px 0" }}>
                    Enable or disable vehicle starter relay over Codec 12 GPRS / SMS.
                  </p>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: "8px" }}>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                        Current Status:{" "}
                        <span style={{ color: currentDevice?.immobilizer ? "#ef4444" : "#10b981" }}>
                          {currentDevice?.immobilizer ? "IMMOBILIZED (LOCKED)" : "NORMAL (MOBILIZED)"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                        Relay Port: DOUT1 (Teltonika AVL ID 179)
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="gprs-cmd-btn danger"
                        onClick={() => handleToggleImmobilizer(true)}
                        disabled={commandSending || currentDevice?.immobilizer}
                      >
                        <Lock size={14} /> Cut Engine
                      </button>
                      <button
                        className="gprs-cmd-btn success"
                        onClick={() => handleToggleImmobilizer(false)}
                        disabled={commandSending || !currentDevice?.immobilizer}
                      >
                        <Unlock size={14} /> Restore Engine
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pre-configured Teltonika GPRS Commands */}
                <div className="command-card">
                  <div className="command-card-title">
                    <Send size={18} /> Quick Teltonika GPRS Commands (Codec 12)
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "0 0 10px 0" }}>
                    Query device diagnostics, I/O pin states, and firmware over GPRS:
                  </p>

                  <div className="command-btn-grid">
                    <button className="gprs-cmd-btn" onClick={() => sendCommand("getinfo")} disabled={commandSending}>
                      getinfo (Status)
                    </button>
                    <button className="gprs-cmd-btn" onClick={() => sendCommand("getio")} disabled={commandSending}>
                      getio (I/O Pins)
                    </button>
                    <button className="gprs-cmd-btn" onClick={() => sendCommand("getver")} disabled={commandSending}>
                      getver (Version)
                    </button>
                    <button className="gprs-cmd-btn" onClick={() => sendCommand("getstatus")} disabled={commandSending}>
                      getstatus
                    </button>
                  </div>

                  {/* Custom Command Input */}
                  <div className="command-input-row" style={{ marginTop: "10px" }}>
                    <input
                      type="text"
                      placeholder="Custom command (e.g. readparam 2001)"
                      className="command-text-input"
                      value={customCommandText}
                      onChange={(e) => setCustomCommandText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendCommand(customCommandText)}
                    />
                    <button
                      className="teltonika-tab-btn active"
                      onClick={() => sendCommand(customCommandText)}
                      disabled={commandSending || !customCommandText.trim()}
                    >
                      <Send size={14} /> Send
                    </button>
                  </div>
                </div>
              </div>

              {/* Latest Codec 12 Packet Inspector */}
              {latestCommandResult && (
                <div className="command-card" style={{ background: "#0b111e", color: "#f8fafc", borderColor: "#334155" }}>
                  <div className="command-card-title" style={{ color: "#38bdf8" }}>
                    <Terminal size={16} /> Codec 12 Binary Packet Inspector
                  </div>
                  <div style={{ fontSize: "0.75rem", fontFamily: "monospace", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div>
                      <span style={{ color: "#94a3b8" }}>Command Text: </span>
                      <span style={{ color: "#34d399", fontWeight: 700 }}>{latestCommandResult.command}</span>
                    </div>
                    <div>
                      <span style={{ color: "#94a3b8" }}>Binary HEX Stream: </span>
                      <span style={{ color: "#cbd5e1", wordBreak: "break-all" }}>{latestCommandResult.codec12HexPacket}</span>
                    </div>
                    <div>
                      <span style={{ color: "#94a3b8" }}>SMS Fallback Syntax: </span>
                      <span style={{ color: "#fbbf24" }}>{latestCommandResult.smsFormat}</span>
                    </div>
                    <div>
                      <span style={{ color: "#94a3b8" }}>Device ACK / Response: </span>
                      <span style={{ color: "#38bdf8" }}>{latestCommandResult.response}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Commands History Table */}
              <div className="fleet-table-container">
                <table className="fleet-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>IMEI</th>
                      <th>Command</th>
                      <th>Protocol</th>
                      <th>Status</th>
                      <th>Response / Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandHistory.map((cmd) => (
                      <tr key={cmd.commandId}>
                        <td>{new Date(cmd.createdAt).toLocaleTimeString()}</td>
                        <td>{cmd.imei}</td>
                        <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{cmd.commandText}</td>
                        <td>{cmd.codecType}</td>
                        <td>
                          <span className={`status-badge ${cmd.status === "Acknowledged" ? "moving" : "idle"}`} style={{ fontSize: "0.7rem" }}>
                            {cmd.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: "monospace", color: "#64748b" }}>{cmd.responseText || "Dispatched"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SETUP GUIDE & HARDWARE CONFIG */}
          {activeTab === "setup" && (
            <div className="teltonika-tab-content-full">
              <div className="teltonika-modal-box" style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
                <h2 style={{ margin: "0 0 16px 0", fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>
                  Teltonika FMC003 / FMB120 Tracker Setup Guide
                </h2>

                <div className="teltonika-modal-content">
                  <h3 className="modal-section-title primary">1. Native Office Dashboard Direct TCP Server</h3>
                  <p>Configure in Teltonika Configurator under <em>GPRS &gt; Server Settings</em>:</p>
                  <div className="code-snippet">Domain: (Your Public IP / DNS) | Port: 5027 | Protocol: TCP</div>

                  <h3 className="modal-section-title emerald">2. Current Flespi Testing Gateway</h3>
                  <p>Live gateway bridge configured in Flespi (#9096406):</p>
                  <div className="code-snippet">Domain: ch1453363.flespi.gw | Port: 28633 | Protocol: TCP</div>

                  <h3 className="modal-section-title amber">3. Quick SMS Setup Command</h3>
                  <p>Send from your mobile to the tracker's SIM card (note the 2 leading spaces):</p>
                  <div className="code-snippet">&nbsp;&nbsp;setparam 2001:www;2002:;2003:;2004:ch1453363.flespi.gw;2005:28633;2006:0</div>

                  <h3 className="modal-section-title violet">4. Supported Protocols</h3>
                  <p>
                    • <b>Codec 8 (0x08):</b> Standard AVL telemetry packet<br/>
                    • <b>Codec 8 Extended (0x8E):</b> High-capacity 16-bit AVL IDs (VIN, DTC, CAN)<br/>
                    • <b>Codec 16 (0x10):</b> Generation type AVL records<br/>
                    • <b>Codec 12 (0x0C):</b> Bidirectional GPRS commands (Relay immobilization, status queries)<br/>
                    • <b>Codec 14 (0x0E):</b> IMEI-authenticated GPRS commands
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* DIAGNOSTIC CONSOLE DRAWER */}
          {showConsole && (
            <div className={`teltonika-console-drawer ${isConsoleMaximized ? "maximized" : ""}`}>
              <div className="console-header">
                <div className="console-title-wrap">
                  <span className="console-live-pulse" />
                  <span className="console-title">FMC003 LIVE TELEMATICS & PACKET INSPECTOR</span>
                  <span className="console-badge">Codec 8 Extended</span>
                  <span className="console-badge console-badge-emerald">
                    Alternator: {currentDevice?.externalVoltage?.toFixed(2) ?? "13.61"}V
                  </span>
                </div>

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

                <div className="console-actions">
                  <button
                    className={`console-tool-btn ${consoleAutoScroll ? "active" : ""}`}
                    onClick={() => setConsoleAutoScroll(!consoleAutoScroll)}
                  >
                    Auto-scroll: {consoleAutoScroll ? "ON" : "OFF"}
                  </button>
                  <button className="console-tool-btn" onClick={() => setConsoleLogs([])}>
                    <Trash2 size={13} /> Clear
                  </button>
                  <button className="console-tool-btn" onClick={() => setIsConsoleMaximized(!isConsoleMaximized)}>
                    {isConsoleMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>
                  <button className="console-tool-btn close-btn" onClick={() => setShowConsole(false)}>
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              <div className="console-body">
                {consoleTab === "terminal" && (
                  <div className="console-terminal-view">
                    <div className="console-filters-bar">
                      <span>FILTER:</span>
                      {["ALL", "TELEMETRY", "ENGINE", "OBD", "COMMAND", "ALERT", "FLESPI", "SIGNALR"].map((cat) => (
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
                        .map((log) => (
                          <div key={log.id} className={`terminal-line ${log.level}`}>
                            <span className="log-time">[{log.time}]</span>
                            <span className={`log-cat cat-${log.category.toLowerCase()}`}>[{log.category}]</span>
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
                        ))}
                      <div ref={terminalEndRef} />
                    </div>
                  </div>
                )}

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
                      <div className={`matrix-status-pill ${isEngineRunning ? "pass" : "idle"}`}>
                        {isEngineRunning ? "ACTIVE CHARGING" : "STANDBY"}
                      </div>
                    </div>

                    <div className="matrix-grid">
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
                          Threshold: ≥ 13.00 V. In 12V automotive systems, alternator generates 13.2V–14.8V when the engine is rotating.
                        </div>
                      </div>

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
                          Threshold: &gt; 3 km/h. Confirms physical vehicular transit through GNSS & OBD sensors.
                        </div>
                      </div>

                      <div className="matrix-card">
                        <div className="matrix-card-header">
                          <span>Raw DIN1 (Ignition Key Wire)</span>
                          <span className="matrix-status-pill idle">NO OBD HARNESS WIRE</span>
                        </div>
                        <div className="matrix-value" style={{ color: "#f87171" }}>
                          {isRawIgnActive ? "1 (HIGH)" : "0 (LOW)"}
                        </div>
                        <div className="matrix-desc">
                          Standard OBD-II ports do not have a dedicated DIN1 wire connected to the key lock.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                          setToastMsg("Raw JSON copied to clipboard!");
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

          {/* Add Geofence Modal */}
          {showAddGeofenceModal && (
            <div className="teltonika-modal-backdrop" onClick={() => setShowAddGeofenceModal(false)}>
              <div className="teltonika-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header-row">
                  <h2>Create New Safety Geofence</h2>
                  <button className="teltonika-btn-icon" onClick={() => setShowAddGeofenceModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="teltonika-modal-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>GEOFENCE NAME</label>
                    <input
                      type="text"
                      className="history-date-input"
                      style={{ width: "100%", marginTop: "4px" }}
                      placeholder="e.g. Warehouse Zone B"
                      value={newGeofenceName}
                      onChange={(e) => setNewGeofenceName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>LATITUDE</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="history-date-input"
                        style={{ width: "100%", marginTop: "4px" }}
                        value={newGeofenceLat}
                        onChange={(e) => setNewGeofenceLat(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>LONGITUDE</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="history-date-input"
                        style={{ width: "100%", marginTop: "4px" }}
                        value={newGeofenceLng}
                        onChange={(e) => setNewGeofenceLng(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                      RADIUS: {newGeofenceRadius} METERS
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="2000"
                      step="50"
                      className="replay-slider"
                      style={{ width: "100%", marginTop: "6px" }}
                      value={newGeofenceRadius}
                      onChange={(e) => setNewGeofenceRadius(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                      ZONE SPEED LIMIT: {newGeofenceSpeedLimit} KM/H
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="120"
                      step="5"
                      className="replay-slider"
                      style={{ width: "100%", marginTop: "6px" }}
                      value={newGeofenceSpeedLimit}
                      onChange={(e) => setNewGeofenceSpeedLimit(Number(e.target.value))}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
                    <button className="gprs-cmd-btn" onClick={() => setShowAddGeofenceModal(false)}>
                      Cancel
                    </button>
                    <button className="teltonika-tab-btn active" onClick={saveGeofence}>
                      Save Geofence
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Engine Immobilization Modal */}
          {showImmobilizerConfirmModal && (
            <div className="teltonika-modal-backdrop" onClick={() => setShowImmobilizerConfirmModal(false)}>
              <div className="teltonika-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header-row">
                  <h2 style={{ color: pendingImmobilizerState ? "#ef4444" : "#10b981", display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertTriangle size={20} />
                    {pendingImmobilizerState ? "Confirm Remote Engine Immobilization" : "Confirm Engine Mobilization"}
                  </h2>
                  <button className="teltonika-btn-icon" onClick={() => setShowImmobilizerConfirmModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="teltonika-modal-content">
                  {pendingImmobilizerState ? (
                    <div style={{ color: "#ef4444", fontSize: "0.85rem", lineHeight: 1.5 }}>
                      ⚠️ <b>CRITICAL SAFETY WARNING:</b> You are about to engage the starter cut-off relay (DOUT1) for vehicle{" "}
                      <b>{currentDevice?.vehicleNo ? `${currentDevice.vehicleNo} (${currentDevice.imei})` : (currentDevice?.imei || selectedImei)}</b> via Teltonika GPRS Codec 12 command <code>setdigout 1</code>.
                      <br />
                      Ensure the vehicle is stationary or safe to disable to prevent traffic accidents.
                    </div>
                  ) : (
                    <div style={{ color: "#10b981", fontSize: "0.85rem", lineHeight: 1.5 }}>
                      Disengage cut-off relay (DOUT1) and restore starter power for vehicle{" "}
                      <b>{currentDevice?.vehicleNo ? `${currentDevice.vehicleNo} (${currentDevice.imei})` : (currentDevice?.imei || selectedImei)}</b> via Codec 12 command <code>setdigout 0</code>.
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                    <button className="gprs-cmd-btn" onClick={() => setShowImmobilizerConfirmModal(false)}>
                      Cancel
                    </button>
                    <button
                      className={`gprs-cmd-btn ${pendingImmobilizerState ? "danger" : "success"}`}
                      onClick={confirmToggleImmobilizer}
                    >
                      {pendingImmobilizerState ? "Yes, Cut Engine Relay" : "Yes, Restore Engine Power"}
                    </button>
                  </div>
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
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TeltonikaTracking;
