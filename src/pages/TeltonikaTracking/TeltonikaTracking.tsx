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
  Battery,
  Car,
  ChevronRight,
  Compass,
  Gauge,
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
  TrendingUp,
  X,
  Zap,
  Globe,
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
}

const TeltonikaTracking: React.FC = () => {
  // State
  const [devices, setDevices] = useState<TeltonikaDevice[]>([]);
  const [selectedImei, setSelectedImei] = useState<string>("860848081728983");
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [mapStyle, setMapStyle] = useState<"streets" | "voyager" | "satellite" | "grid">(
    () => (localStorage.getItem("teltonika_map_style") as any) || "grid"
  );
  const [tileBlocked, setTileBlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [hubStatus, setHubStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
          // Deep tactical cyber dark background
          ctx.fillStyle = "#0b111e";
          ctx.fillRect(0, 0, size.x, size.y);

          // Precision minor grid lines
          ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
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
          ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
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
          ctx.strokeStyle = "rgba(71, 85, 105, 0.65)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, size.y * 0.45);
          ctx.lineTo(size.x, size.y * 0.55);
          ctx.stroke();

          // Express Highway Vein (Cyan Cyber Curve)
          ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(size.x * 0.15, 0);
          ctx.bezierCurveTo(size.x * 0.3, size.y * 0.5, size.x * 0.7, size.y * 0.5, size.x * 0.85, size.y);
          ctx.stroke();

          // Coordinate & Sector Telemetry Tags
          ctx.fillStyle = "#64748b";
          ctx.font = "600 11px Inter, system-ui, sans-serif";
          ctx.fillText(`SECTOR ${coords.x}-${coords.y} [Z${coords.z}]`, 14, 22);

          if (coords.x % 2 === 0 && coords.y % 2 === 0) {
            ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
            ctx.font = "700 11px Inter, sans-serif";
            ctx.fillText("📍 Vijayawada Transit Hub", 18, size.y - 20);
            ctx.fillStyle = "rgba(52, 211, 153, 0.9)";
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
      // NOTE: cleanApiBase already ends with /api, so we use /TeltonikaTracking/devices
      const res = await axios.get(`${cleanApiBase}/TeltonikaTracking/devices`);
      if (res.data && res.data.success) {
        setDevices(res.data.data || []);
      }
    } catch (e) {
      console.error("[TeltonikaTracking] Fetch devices error:", e);
    } finally {
      setLoading(false);
    }
  }, [cleanApiBase]);

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

  // SignalR Hub Connection Setup
  useEffect(() => {
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

    connection.onreconnecting(() => setHubStatus("connecting"));
    connection.onreconnected(() => setHubStatus("connected"));
    connection.onclose(() => setHubStatus("disconnected"));

    connection
      .start()
      .then(() => {
        setHubStatus("connected");
      })
      .catch((err) => {
        console.warn("[TeltonikaHub] Connection failed:", err);
        setHubStatus("disconnected");
      });

    hubConnectionRef.current = connection;

    // Periodic poll every 10s if disconnected
    const pollInterval = setInterval(() => {
      fetchDevices();
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      connection.stop();
    };
  }, [hubBase, fetchDevices]);

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
              </div>

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
                  <div className="section-label">Realtime OBD-II & GPS Metrics</div>

                  <div className="telemetry-grid">
                    {/* Speed Gauge */}
                    <div className="telemetry-card highlight">
                      <div className="telemetry-card-top">
                        <span>Speed</span>
                        <Gauge size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">{currentDevice?.speed ?? 0}</span>
                        <span className="telemetry-unit">km/h</span>
                      </div>
                    </div>

                    {/* Ignition */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>Ignition</span>
                        <Zap size={16} className={currentDevice?.ignition ? "text-emerald-400" : "text-slate-400"} />
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        <span className={`ignition-pill ${currentDevice?.ignition ? "on" : "off"}`}>
                          {currentDevice?.ignition ? "ENGINE ON" : "ENGINE OFF"}
                        </span>
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

                    {/* Battery Voltage */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>OBD Battery</span>
                        <Battery size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">
                          {currentDevice?.externalVoltage
                            ? currentDevice.externalVoltage.toFixed(1)
                            : currentDevice?.batteryVoltage
                              ? currentDevice.batteryVoltage.toFixed(1)
                              : "12.6"}
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
                        <span className="telemetry-value">{currentDevice?.satellites ?? 0}</span>
                        <span className="telemetry-unit">locked</span>
                      </div>
                    </div>

                    {/* Odometer */}
                    <div className="telemetry-card">
                      <div className="telemetry-card-top">
                        <span>Odometer</span>
                        <TrendingUp size={16} />
                      </div>
                      <div className="telemetry-value-wrap">
                        <span className="telemetry-value">
                          {currentDevice?.odometer ? (currentDevice.odometer / 1000).toFixed(1) : 0}
                        </span>
                        <span className="telemetry-unit">km</span>
                      </div>
                    </div>
                  </div>

                  {/* Last ping info */}
                  <div style={{ padding: "10px 14px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Last Communication:</div>
                    <div style={{ fontSize: "0.85rem", color: "#f8fafc", fontWeight: 600, marginTop: "2px" }}>
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
                        <div style={{ marginTop: "12px", padding: "10px", background: "rgba(30, 41, 59, 0.7)", borderRadius: "8px", fontSize: "0.78rem" }}>
                          <div><b>Time:</b> {new Date(historyPoints[replayIndex].recordTimestamp).toLocaleTimeString()}</div>
                          <div><b>Speed:</b> {historyPoints[replayIndex].speed ?? 0} km/h</div>
                          <div><b>RPM:</b> {historyPoints[replayIndex].engineRpm ?? 0}</div>
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
                  <span className="overlay-label">Coordinates</span>
                  <span className="overlay-val" style={{ fontSize: "0.85rem", fontFamily: "monospace" }}>
                    {currentDevice?.latitude ? `${currentDevice.latitude.toFixed(5)}, ${currentDevice.longitude?.toFixed(5)}` : "No GPS Fix"}
                  </span>
                </div>
                <div className="overlay-metric">
                  <span className="overlay-label">Protocol</span>
                  <span className="overlay-val" style={{ color: "var(--ion-color-primary, #38bdf8)", fontSize: "0.85rem" }}>
                    Codec 8 Extended
                  </span>
                </div>
              </div>
            </div>
          </div>
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

              <div style={{ fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.6 }}>
                <h3 style={{ color: "var(--ion-color-primary, #38bdf8)", fontSize: "1rem", marginTop: 0 }}>
                  1. Current Flespi Testing Server
                </h3>
                <p>Configured in your Flespi account (#9096406):</p>
                <div className="code-snippet">Domain: ch1453363.flespi.gw | Port: 28633 | Protocol: TCP</div>

                <h3 style={{ color: "#34d399", fontSize: "1rem", marginTop: "16px" }}>
                  2. Native Office Dashboard Direct TCP Server
                </h3>
                <p>Our server’s dedicated background Codec 8 listener:</p>
                <div className="code-snippet">TCP Port: 5027 | Protocol: TCP | Codec: Codec 8 Extended</div>

                <h3 style={{ color: "#fbbf24", fontSize: "1rem", marginTop: "16px" }}>
                  3. Quick SMS Setup Command
                </h3>
                <p>Send to tracker Vi SIM number from your mobile (notice the 2 leading spaces):</p>
                <div className="code-snippet">
                  &nbsp;&nbsp;setparam 2001:www;2002:;2003:;2004:ch1453363.flespi.gw;2005:28633;2006:0
                </div>

                <h3 style={{ color: "#a855f7", fontSize: "1rem", marginTop: "16px" }}>
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
