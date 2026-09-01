import { IonContent, IonPage, IonIcon, IonSpinner } from "@ionic/react";
import {
  arrowBackOutline,
  cameraReverseOutline,
  pinOutline,
  bluetoothOutline,
  calendarOutline,
  informationCircleOutline,
  timeOutline,
  checkmarkCircleOutline,
  closeOutline,
  fingerPrintOutline,
  alertCircleOutline,
  playOutline,
  pauseOutline,
  helpCircleOutline
} from "ionicons/icons";
import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useHistory } from "react-router";
import { API_BASE } from "../../config";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { BleClient, ScanResult } from "@capacitor-community/bluetooth-le";
import axios from "axios";
import "./AIAttendanceScanner.css";

const playSuccessChime = () => {
  if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(880.00, now + 0.12); // A5
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28); // D6
      gain2.gain.setValueAtTime(0.14, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch { }
  }
};

const playAlertChime = () => {
  if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(392.00, now); // G4
      osc.frequency.setValueAtTime(329.63, now + 0.15); // E4
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch { }
  }
};

const speakText = (text: string) => {
  if (typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
    try {
      const SpeechUtterance = (window as any).SpeechSynthesisUtterance;
      const utterance = new SpeechUtterance(text);
      utterance.rate = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn("SpeechSynthesis error:", error);
    }
  }
};

const getAutoStatus = (): string => {
  const now = new Date();
  const hrs = now.getHours();
  const mins = now.getMinutes();
  const timeVal = hrs * 60 + mins; // minutes since midnight

  if (timeVal >= 7 * 60 && timeVal < 12 * 60 + 30) {
    return "Morning In";
  } else if (timeVal >= 12 * 60 + 30 && timeVal < 14 * 60 + 15) {
    return "Lunch Out";
  } else if (timeVal >= 14 * 60 + 15 && timeVal < 16 * 60) {
    return "Lunch In";
  } else {
    return "Evening Out";
  }
};

const formatTime12H = (val?: any): string => {
  if (!val || val === '-' || val === '--:--') return '--:--';
  if (typeof val === 'string') {
    const clean = val.trim();
    if (clean.includes('1900-01-01')) {
      const p = clean.split(/[ T]/);
      if (p.length > 1) return formatTime12H(p[1]);
    }
    const ampmMatch = clean.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (ampmMatch) {
      const h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2];
      const ap = ampmMatch[3].toUpperCase();
      const normH = h === 0 ? 12 : (h > 12 ? h % 12 || 12 : h);
      return `${normH.toString().padStart(2, '0')}:${m} ${ap}`;
    }
    const match = clean.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = match[2];
      const ap = h >= 12 ? 'PM' : 'AM';
      const normH = h % 12 || 12;
      return `${normH.toString().padStart(2, '0')}:${m} ${ap}`;
    }
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const h = val.getHours();
    const m = val.getMinutes().toString().padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    const normH = (h % 12 || 12).toString().padStart(2, '0');
    return `${normH}:${m} ${ap}`;
  }
  return String(val);
};

const getSlotColorConfig = (slot?: string) => {
  switch (slot) {
    case 'Morning In':
      return { label: '🌅 Morning In', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' };
    case 'Lunch Out':
      return { label: '🍱 Lunch Out', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    case 'Lunch In':
      return { label: '🥗 Lunch In', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    case 'Evening Out':
      return { label: '🌇 Evening Out', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
    case 'Permission Out':
      return { label: '🚪 Perm Out', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' };
    case 'Permission In':
      return { label: '🏁 Perm In', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
    default:
      return { label: slot || 'Attendance', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' };
  }
};

const AIAttendanceScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const history = useHistory();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [cameraMode, setCameraMode] = useState<"user" | "environment">("user");
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [locationReady, setLocationReady] = useState(false);
  const [resultMessage, setResultMessage] = useState("Initializing camera...");
  const [statusColor, setStatusColor] = useState("#6366f1");
  const [userData, setUserData] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bleVerified, setBleVerified] = useState(false);
  const [bleDeviceId, setBleDeviceId] = useState("");
  const [bleDeviceName, setBleDeviceName] = useState("");
  const [isBleScanning, setIsBleScanning] = useState(false);
  const [bleSignalStrength, setBleSignalStrength] = useState<number | null>(null);
  const [allowedBeacons, setAllowedBeacons] = useState<{ name: string, mac: string }[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [capturedImg, setCapturedImg] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string>("");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Status Selector
  const [selectedStatus, setSelectedStatus] = useState<string>(getAutoStatus());
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [isSlotSelected, setIsSlotSelected] = useState<boolean>(false);
  const [showSlotModal, setShowSlotModal] = useState<boolean>(true);

  // Grace & Rules Telemetry
  const [graceSummary, setGraceSummary] = useState<{
    freeGracesUsed: number;
    freeGracesMax?: number;
    gracesLeft: number;
    permissionGraceUsed: number;
    permissionSessionsMax?: number;
    permissionSessionsLeft?: number;
    totalLateOccasionsUsed?: number;
    totalLateOccasionsMax?: number;
    totalLateOccasionsLeft?: number;
    permissionBalance: number;
    pTime?: number;
    approvedOvertime?: number;
    totalPermission?: number;
    usedPermission?: number;
    history: any[];
  } | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showPermissionCalcModal, setShowPermissionCalcModal] = useState(false);
  const [showGraceTrackerDetails, setShowGraceTrackerDetails] = useState<boolean>(false);
  const [graceHistoryFilter, setGraceHistoryFilter] = useState<'ALL' | 'LOP' | 'GRACE' | 'PERMISSION'>('ALL');
  const [isScannerPaused, setIsScannerPaused] = useState<boolean>(false);
  const isScannerPausedRef = useRef<boolean>(false);
  const [activeRule, setActiveRule] = useState<{
    btRequired: boolean;
    gpsRequired: boolean;
    ruleSource: string;
    branch?: string;
    branchDept?: string;
  } | null>(null);

  const [policyMap, setPolicyMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API_BASE}Checkin/GetAttendancePolicyMaster`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          const map: Record<string, string> = {};
          data.data.forEach((p: any) => { map[p.policyKey] = p.policyValue; });
          setPolicyMap(map);
        }
      })
      .catch(() => {});
  }, []);

  const getPolVal = (key: string, fallback: string = '') => policyMap[key] || fallback;

  const logDebug = (msg: string) => {
    console.log(`[DEBUG] ${msg}`);
    setDebugLogs(prev => [msg, ...prev.slice(0, 4)]);
  };

  const [attendanceDetails, setAttendanceDetails] = useState<{
    empName?: string; empId?: string; status?: string; time?: string; officeName?: string;
    isDuplicate?: boolean; customMessage?: string;
    presenceMethod?: string; graceType?: string;
    lateMinutes?: number; date?: string; attendanceStatus?: string; confidence?: number;
    gpsDetails?: {
      actualOfficeName?: string;
      actualGps?: string;
      presentGps?: string;
      distance?: string;
      allowedRadius?: string;
      bluetoothMatched?: boolean;
      bluetoothRequired?: boolean;
      gpsMatched?: boolean;
      gpsRequired?: boolean;
    };
  } | null>(null);

  const buildGpsTelemetry = (empData?: any, rootData?: any) => {
    const actLat = empData?.actualLatitude ?? rootData?.actualLatitude;
    const actLng = empData?.actualLongitude ?? rootData?.actualLongitude;
    const presLat = empData?.presentLatitude ?? rootData?.presentLatitude ?? (latitudeRef.current !== 0 ? latitudeRef.current : undefined);
    const presLng = empData?.presentLongitude ?? rootData?.presentLongitude ?? (longitudeRef.current !== 0 ? longitudeRef.current : undefined);
    const offName = empData?.actualOfficeName ?? rootData?.actualOfficeName ?? empData?.officeName ?? rootData?.officeName ?? "Assigned Office";
    const distM = empData?.distanceMeters ?? rootData?.distanceMeters;
    const radM = empData?.allowedRadiusMeters ?? rootData?.allowedRadiusMeters ?? 100;
    const btMatched = empData?.bluetoothMatched ?? rootData?.bluetoothMatched ?? bleVerifiedRef.current;
    const btRequired = empData?.btRequired ?? rootData?.btRequired ?? true;
    const gpsMatched = empData?.locationMatched ?? rootData?.locationMatched ?? (distM !== undefined && distM !== null ? distM <= radM : true);
    const gpsRequired = empData?.gpsRequired ?? rootData?.gpsRequired ?? true;

    if (actLat || actLng || presLat || presLng || offName) {
      return {
        actualOfficeName: offName,
        actualGps: actLat && actLng ? `${Number(actLat).toFixed(6)}, ${Number(actLng).toFixed(6)}` : undefined,
        presentGps: presLat && presLng ? `${Number(presLat).toFixed(6)}, ${Number(presLng).toFixed(6)}` : undefined,
        distance: distM !== undefined && distM !== null ? `${Math.round(distM)}m away` : undefined,
        allowedRadius: radM ? `${radM}m radius` : '100m radius',
        bluetoothMatched: Boolean(btMatched),
        bluetoothRequired: Boolean(btRequired),
        gpsMatched: Boolean(gpsMatched),
        gpsRequired: Boolean(gpsRequired)
      };
    }
    return undefined;
  };

  // Dynamic Live Biometric Guidance States & Voice Prompts
  const [guidanceState, setGuidanceState] = useState<'idle' | 'too-far' | 'too-close' | 'off-center' | 'aligned'>('idle');
  const [guidanceText, setGuidanceText] = useState<string>('🎯 Align your face in the circle');
  const lastVoicePromptRef = useRef<string>('');
  const lastVoiceTimeRef = useRef<number>(0);

  const triggerVoiceGuidance = (promptKey: string, spokenText: string) => {
    const now = Date.now();
    if (now - lastVoiceTimeRef.current < 2800) return;
    if (lastVoicePromptRef.current === promptKey && now - lastVoiceTimeRef.current < 5000) return;
    lastVoicePromptRef.current = promptKey;
    lastVoiceTimeRef.current = now;
    speakText(spokenText);
  };

  // Auto-dismiss countdown & progress bar state
  const [countdownTimer, setCountdownTimer] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const countdownIntervalRef = useRef<any>(null);
  const recentlyMarkedMapRef = useRef<Map<string, number>>(new Map());

  const latitudeRef = useRef(0);
  const longitudeRef = useRef(0);
  const locationReadyRef = useRef(false);
  const bleVerifiedRef = useRef(false);
  const bleDeviceNameRef = useRef("");
  const bleDeviceIdRef = useRef("");
  const allowedBeaconsRef = useRef<{ name: string, mac: string }[]>([]);
  const userDataRef = useRef<any>(null);
  const userProfileRef = useRef<any>(null);
  const isCameraReadyRef = useRef(false);
  const scanSuccessRef = useRef(false);
  const isProcessingRef = useRef(false);
  const loopTimeoutRef = useRef<any>(null);
  const bleTimeoutRef = useRef<any>(null);

  const selectedStatusRef = useRef(getAutoStatus());

  useEffect(() => { latitudeRef.current = latitude; }, [latitude]);
  useEffect(() => { longitudeRef.current = longitude; }, [longitude]);
  useEffect(() => { locationReadyRef.current = locationReady; }, [locationReady]);
  useEffect(() => { bleVerifiedRef.current = bleVerified; }, [bleVerified]);
  useEffect(() => { bleDeviceNameRef.current = bleDeviceName; }, [bleDeviceName]);
  useEffect(() => { bleDeviceIdRef.current = bleDeviceId; }, [bleDeviceId]);
  useEffect(() => { allowedBeaconsRef.current = allowedBeacons; }, [allowedBeacons]);
  useEffect(() => { userDataRef.current = userData; }, [userData]);
  useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);
  useEffect(() => { isCameraReadyRef.current = isCameraReady; }, [isCameraReady]);
  useEffect(() => { scanSuccessRef.current = scanSuccess; }, [scanSuccess]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  const cityNameRef = useRef("");
  useEffect(() => { cityNameRef.current = cityName; }, [cityName]);

  const isSlotSelectedRef = useRef(false);
  const showSlotModalRef = useRef(true);

  useEffect(() => { isSlotSelectedRef.current = isSlotSelected; }, [isSlotSelected]);
  useEffect(() => { showSlotModalRef.current = showSlotModal; }, [showSlotModal]);

  useEffect(() => { isScannerPausedRef.current = isScannerPaused; }, [isScannerPaused]);

  const toggleScannerPause = () => {
    const nextState = !isScannerPaused;
    setIsScannerPaused(nextState);
    isScannerPausedRef.current = nextState;
    if (nextState) {
      setResultMessage("⏸️ Scanner Paused");
      setStatusColor("#f59e0b");
      logDebug("Scanner paused manually");
    } else {
      setResultMessage("Align your face in the frame");
      setStatusColor("#6366f1");
      logDebug("Scanner resumed manually");
      scheduleNextScan(100);
    }
  };

  useEffect(() => {
    selectedStatusRef.current = selectedStatus;
  }, [selectedStatus]);

  // Fetch monthly grace counts & logs
  const fetchGraceSummary = async (empId: string) => {
    try {
      const response = await fetch(`${API_BASE}Checkin/GetEmployeeGraceSummary?empId=${empId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGraceSummary(data);
          logDebug(`Loaded grace summary: ${data.gracesLeft} left`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch grace summary", err);
    }
  };

  // Load Beacons on Mount
  useEffect(() => {
    const fetchBeacons = async () => {
      try {
        const response = await fetch(`${API_BASE}Checkin/GetActiveBluetoothDevices`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.devices)) {
            setAllowedBeacons(data.devices);
            logDebug(`Loaded ${data.devices.length} beacons from DB`);
          }
        }
      } catch (err) {
        logDebug("Failed to load beacons from DB");
      }
    };
    fetchBeacons();
  }, []);

  // ── BLE ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const initBLE = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        await BleClient.initialize();
        const enabled = await BleClient.isEnabled();
        logDebug("Bluetooth enabled: " + enabled);
        try { await BleClient.requestLEScan({ allowDuplicates: false }, () => { }); await BleClient.stopLEScan(); } catch (err: any) { logDebug("BLE Perm Request Err: " + err.message); }
        await verifyEasyReach();
      } catch (e: any) {
        logDebug("BLE Init Error: " + e.message);
      }
    };
    initBLE();
    return () => { if (bleTimeoutRef.current) clearTimeout(bleTimeoutRef.current); };
  }, []);

  // ── User load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserData(parsed);
        setUserProfile(parsed);
        setResultMessage("Align your face in the frame");
        setStatusColor("#6366f1");

        const currentEmpId = parsed?.empCode || parsed?.EmpCode || "";
        if (currentEmpId) {
          fetchGraceSummary(currentEmpId);
          fetch(`${API_BASE}Checkin/GetMyAttendanceRule?empId=${currentEmpId}`, {
            headers: { 'x-api-key': 'dbase-ai-master-key-2026' }
          })
            .then(res => res.json())
            .then(data => {
              if (data?.success) {
                setActiveRule({
                  btRequired: data.btRequired,
                  gpsRequired: data.gpsRequired,
                  ruleSource: data.ruleSource,
                  branch: data.branch,
                  branchDept: data.branchDept
                });
                logDebug(`Rule: BT=${data.btRequired}, GPS=${data.gpsRequired} (${data.ruleSource})`);
              }
            })
            .catch(() => {});

          fetch(`${API_BASE}Checkin/GetActivePermissionForToday?empId=${currentEmpId}`)
            .then(res => res.json())
            .then(data => {
              if (data?.hasApprovedPermission && data?.suggestedSlot) {
                setSelectedStatus(data.suggestedSlot);
                setIsManualOverride(true);
                logDebug(`Auto-selected permission slot: ${data.suggestedSlot}`);
              }
            })
            .catch(() => {});
        }
        logDebug("User loaded: " + currentEmpId);
      }
      catch { setResultMessage("Error loading user profile"); setStatusColor("#ef4444"); }
    } else { setResultMessage("No user profile found. Please login."); setStatusColor("#ef4444"); }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync timing slot automatically if not overridden by the employee
  useEffect(() => {
    if (!isManualOverride) {
      const interval = setInterval(() => {
        if (!isManualOverride) {
          setSelectedStatus(getAutoStatus());
        }
      }, 30000); // Check every 30s
      return () => clearInterval(interval);
    }
  }, [isManualOverride]);

  // ── GPS ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let watchId: any = null;
    let isMounted = true;
    const startLocationWatch = async () => {
      const isSecure = window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const isNative = Capacitor.isNativePlatform();

      if (!isNative && !isSecure) {
        console.warn("Geolocation requires HTTPS secure context on mobile browsers.");
        setResultMessage("⚠️ HTTPS Required for GPS");
        setStatusColor("#ef4444");
      }

      if (isNative) {
        try {
          const perm = await Geolocation.requestPermissions();
          if (perm.location !== "granted") return;
        } catch { }
      }

      if ("geolocation" in navigator) {
        // Fast, low-accuracy cached resolve
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isMounted) return;
            latitudeRef.current = pos.coords.latitude;
            longitudeRef.current = pos.coords.longitude;
            locationReadyRef.current = true;
            setLatitude(pos.coords.latitude);
            setLongitude(pos.coords.longitude);
            setLocationReady(true);
          },
          () => { },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: Infinity }
        );

        // Precise active watch
        watchId = navigator.geolocation.watchPosition(
          (p) => {
            if (!isMounted) return;
            latitudeRef.current = p.coords.latitude;
            longitudeRef.current = p.coords.longitude;
            locationReadyRef.current = true;
            setLatitude(p.coords.latitude);
            setLongitude(p.coords.longitude);
            setLocationReady(true);
          },
          () => { },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
    };
    startLocationWatch();
    return () => {
      isMounted = false;
      if (watchId !== null && "geolocation" in navigator) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Reverse Geocoding for City Name
  useEffect(() => {
    const fetchCityName = async () => {
      if (latitude !== 0 && longitude !== 0 && !cityName) {
        try {
          // 1. Try BigDataCloud free reverse geocode API (Fast & Reliable)
          const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
          const bdcRes = await axios.get(bdcUrl, { timeout: 3000 });
          if (bdcRes.data) {
            const city = bdcRes.data.city || bdcRes.data.locality || bdcRes.data.principalSubdivision || "";
            if (city) {
              setCityName(city);
              logDebug(`City geocoded (BigDataCloud): ${city}`);
              return;
            }
          }
        } catch { }

        try {
          // 2. Fallback to OpenStreetMap Nominatim
          const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          const isNative = Capacitor.isNativePlatform();
          const url = (isLocal && !isNative)
            ? `/nominatim/reverse?format=json&lat=${latitude}&lon=${longitude}`
            : `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;

          const response = await axios.get(url, { timeout: 3000 });
          if (response.data && response.data.address) {
            const addr = response.data.address;
            const cityOrTown = addr.city || addr.town || addr.village || addr.suburb || addr.city_district || addr.municipality || addr.county || addr.state || "";
            if (cityOrTown) {
              setCityName(cityOrTown);
              logDebug(`City geocoded (Nominatim): ${cityOrTown}`);
            }
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
        }
      }
    };
    fetchCityName();
  }, [latitude, longitude, cityName]);

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSlotSelected) {
      setIsCameraReady(false);
      return;
    }
    let stream: MediaStream | null = null;
    const startVideo = async () => {
      try {
        setIsCameraReady(false);
        logDebug("Starting camera...");
        if (Capacitor.isNativePlatform()) {
          try {
            const perm = await Camera.requestPermissions({ permissions: ["camera"] });
            logDebug("Camera perm: " + perm.camera);
            if (perm.camera !== "granted") {
              setResultMessage("Camera permission denied");
              setStatusColor("#ef4444");
              return;
            }
          } catch (err: any) {
            logDebug("Native perm err: " + err.message);
          }
        }
        if (!navigator.mediaDevices?.getUserMedia) { setResultMessage("Camera not supported"); setStatusColor("#ef4444"); return; }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraMode, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
              setIsCameraReady(true);
              const w = videoRef.current?.videoWidth || 0;
              const h = videoRef.current?.videoHeight || 0;
              logDebug(`Camera active: ${w}x${h}`);
            }
            catch { setResultMessage("Failed to stream video feed"); setStatusColor("#ef4444"); }
          };
        }
      } catch { setResultMessage("Unable to access camera"); setStatusColor("#ef4444"); }
    };
    startVideo();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [cameraMode, isSlotSelected]);

  // Real-time Face Alignment Geometry Analysis & Guidance Loop (every 45ms)
  useEffect(() => {
    let detector: any = null;
    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch { }
    }

    let isMounted = true;
    const analyzeFacePosition = async () => {
      if (!isMounted || !isCameraReady || !videoRef.current || isProcessing || scanSuccess || showSlotModalRef.current || !isSlotSelectedRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2) return;

      const vW = video.videoWidth || video.clientWidth || 640;
      const vH = video.videoHeight || video.clientHeight || 480;
      const targetCenterX = vW / 2;
      const targetCenterY = vH / 2;

      if (detector) {
        try {
          const detections = await detector.detect(video);
          if (Array.isArray(detections) && detections.length > 0) {
            const b = detections[0].boundingBox;
            const rawW = b.width ?? 120;
            const rawH = b.height ?? 120;
            const rawLeft = b.x ?? b.left ?? 0;
            const rawTop = b.y ?? b.top ?? 0;
            const faceCenterX = rawLeft + rawW / 2;
            const faceCenterY = rawTop + rawH / 2;

            const sizeRatio = Math.max(rawW, rawH) / vH;
            const distFromCenter = Math.hypot(faceCenterX - targetCenterX, faceCenterY - targetCenterY);

            if (rawW < 95 || sizeRatio < 0.22) {
              setGuidanceState("too-far");
              setGuidanceText("📏 Come closer to the camera");
              triggerVoiceGuidance("too-far", "Please come closer to the camera");
              return;
            } else if (rawW > 260 || sizeRatio > 0.65) {
              setGuidanceState("too-close");
              setGuidanceText("📏 Move back a little");
              triggerVoiceGuidance("too-close", "Please move back a little");
              return;
            } else if (distFromCenter > 65) {
              setGuidanceState("off-center");
              setGuidanceText("🎯 Center your face in the circle");
              triggerVoiceGuidance("off-center", "Please center your face inside the circle");
              return;
            } else {
              setGuidanceState("aligned");
              setGuidanceText("⚡ Hold still, analyzing face...");
              triggerVoiceGuidance("aligned", "Hold still");
              return;
            }
          } else {
            setGuidanceState("idle");
            setGuidanceText("🎯 Align your face in the circle");
            return;
          }
        } catch { }
      }

      // Fast canvas skin pixel centroid fallback
      try {
        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = 80;
        sampleCanvas.height = 60;
        const sCtx = sampleCanvas.getContext("2d");
        if (sCtx && video) {
          sCtx.drawImage(video, 0, 0, 80, 60);
          const imgData = sCtx.getImageData(0, 0, 80, 60);
          const data = imgData.data;

          let totalSkin = 0;
          let sumX = 0;
          let sumY = 0;
          let minX = 80, maxX = 0, minY = 60, maxY = 0;

          for (let y = 0; y < 60; y += 2) {
            for (let x = 0; x < 80; x += 2) {
              const idx = (y * 80 + x) * 4;
              const r = data[idx], g = data[idx + 1], b = data[idx + 2];
              const isSkin = (r > 60 && g > 40 && b > 20 && (r - Math.min(g, b) > 15) && (Math.abs(r - g) > 15) && r > g && r > b);
              if (isSkin) {
                totalSkin++;
                sumX += x;
                sumY += y;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (totalSkin > 35) {
            const cX = (sumX / totalSkin) * (vW / 80);
            const cY = (sumY / totalSkin) * (vH / 60);
            const fW = (maxX - minX) * (vW / 80);
            const distFromCenter = Math.hypot(cX - targetCenterX, cY - targetCenterY);

            if (fW < 90 || totalSkin < 70) {
              setGuidanceState("too-far");
              setGuidanceText("📏 Come closer to the camera");
              triggerVoiceGuidance("too-far", "Please come closer to the camera");
            } else if (fW > 270 || totalSkin > 500) {
              setGuidanceState("too-close");
              setGuidanceText("📏 Move back a little");
              triggerVoiceGuidance("too-close", "Please move back a little");
            } else if (distFromCenter > 75) {
              setGuidanceState("off-center");
              setGuidanceText("🎯 Center your face in the circle");
              triggerVoiceGuidance("off-center", "Please center your face inside the circle");
            } else {
              setGuidanceState("aligned");
              setGuidanceText("⚡ Hold still, analyzing face...");
              triggerVoiceGuidance("aligned", "Hold still");
            }
          } else {
            setGuidanceState("idle");
            setGuidanceText("🎯 Align your face in the circle");
          }
        }
      } catch { }
    };

    const intervalId = setInterval(analyzeFacePosition, 45);
    return () => { isMounted = false; clearInterval(intervalId); };
  }, [isCameraReady, isProcessing, scanSuccess]);

  // ── Scan loop ─────────────────────────────────────────────────────────────
  const scheduleNextScan = (delay: number, resetSuccessState = false) => {
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    loopTimeoutRef.current = setTimeout(() => {
      if (resetSuccessState) {
        setScanSuccess(false); scanSuccessRef.current = false;
        setAttendanceDetails(null); setResultMessage("Align your face in the frame"); setStatusColor("#6366f1");
        setCapturedImg(null);
        setBleSignalStrength(null);
      }
      captureAndScan();
    }, delay);
  };

  const startAutoDismissCountdown = (totalSeconds = 3) => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdownTimer(totalSeconds);
    setProgressPercent(100);
    const startTime = Date.now();
    const totalDuration = totalSeconds * 1000;

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalDuration - elapsed);
      const remainingSec = Math.ceil(remaining / 1000);
      const percent = Math.max(0, (remaining / totalDuration) * 100);

      setCountdownTimer(remainingSec);
      setProgressPercent(percent);

      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        resetScannerAndResume();
      }
    }, 50);
  };

  const resetScannerAndResume = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownTimer(0);
    setProgressPercent(100);
    setScanSuccess(false);
    scanSuccessRef.current = false;
    setCapturedImg(null);
    setAttendanceDetails(null);
    setResultMessage("Align your face in the frame");
    setStatusColor("#6366f1");
    setCooldownCountdown(0);
    setShowSlotModal(true);
    scheduleNextScan(150);
  };

  const handleSlotSelect = async (slot: string) => {
    setSelectedStatus(slot);
    selectedStatusRef.current = slot;
    setIsManualOverride(true);
    setIsSlotSelected(true);
    setShowSlotModal(false);
    logDebug(`Selected manually: ${slot}`);

    if (slot === "Permission Out" || slot === "Permission In") {
      const empId = userDataRef.current?.empCode || userDataRef.current?.EmpCode || "";
      if (empId) {
        try {
          setResultMessage(`Checking Permission Approval for ${empId}...`);
          setStatusColor("#3b82f6");
          const res = await fetch(`${API_BASE}Checkin/GetActivePermissionForToday?empId=${empId}`);
          if (res.ok) {
            const permData = await res.json();
            if (!permData.hasApprovedPermission) {
              setResultMessage("⚠️ No Approved Permission Found for Today");
              setStatusColor("#f59e0b");
              speakText("No approved permission request found for today. Please request permission first.");
            } else {
              setResultMessage(`✅ Approved Permission: ${permData.approvedMinutes}m (Return window calculated from OUT scan)`);
              setStatusColor("#10b981");
              speakText(`Permission approved for ${permData.approvedMinutes} minutes.`);
            }
          }
        } catch {}
      }
    }
  };

  const captureAndScan = async () => {
    if (showSlotModalRef.current || !isSlotSelectedRef.current) {
      scheduleNextScan(400);
      return;
    }
    if (isScannerPausedRef.current) { scheduleNextScan(1000); return; }
    if (isProcessingRef.current || scanSuccessRef.current || cooldownCountdownRef.current > 0) return;
    if (!isCameraReadyRef.current || !videoRef.current) { scheduleNextScan(500); return; }
    if (latitudeRef.current === 0 && longitudeRef.current === 0) {
      setResultMessage("Getting GPS fix…"); setStatusColor("#f59e0b");
      scheduleNextScan(1500); return;
    }

    // Clean expired cooldowns (older than 15 seconds)
    const nowTs = Date.now();
    recentlyMarkedMapRef.current.forEach((ts, id) => {
      if (nowTs - ts > 15000) recentlyMarkedMapRef.current.delete(id);
    });

    setIsProcessing(true); isProcessingRef.current = true;
    setResultMessage("Scanning face..."); setStatusColor("#3b82f6");
    try {
      const canvas = document.createElement("canvas");
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;

      // Crisp 640x480 resolution for distant face detection (1.5m - 2.5m)
      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const context = canvas.getContext("2d");
      if (context && videoRef.current) {
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        context.restore();

        const imageData = canvas.toDataURL("image/jpeg", 0.80);
        setCapturedImg(imageData);

        const finalEmpId = userDataRef.current?.empCode || userDataRef.current?.EmpCode || "";
        logDebug(`API POST: ${finalEmpId} Slot: ${selectedStatusRef.current}`);

        const response = await fetch(`${API_BASE}Checkin/AILogAttendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": "dbase-ai-master-key-2026" },
          body: JSON.stringify({
            image: imageData,
            empId: finalEmpId,
            empName: userProfileRef.current?.EmpName || userDataRef.current?.empName || "",
            status: selectedStatusRef.current,
            latitude: latitudeRef.current,
            longitude: longitudeRef.current,
            bluetoothConnected: bleVerifiedRef.current,
            bluetoothDeviceName: bleDeviceNameRef.current,
            bluetoothDeviceId: bleDeviceIdRef.current,
            cityName: cityNameRef.current
          })
        });
        if (!response.ok) {
          let errMsg = `HTTP ${response.status}`;
          try { const eb = await response.json(); errMsg = eb.message || errMsg; } catch { }
          throw new Error(errMsg);
        }
        const data = await response.json();
        logDebug(`API Res: success=${data.success}, msg=${data.message || ""}`);
        if (data.invalidLocation) {
          const isGpsNotReady = latitudeRef.current === 0 && longitudeRef.current === 0;
          if (isGpsNotReady) {
            setResultMessage("Getting GPS fix…");
            setStatusColor("#f59e0b");
            scheduleNextScan(1500);
          } else {
            const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
            const empId = data.empId || userDataRef.current?.empCode || "";
            const alertMsg = data.message || "Outside allowed Office Location / Geofence";
            playAlertChime();
            setScanSuccess(true);
            scanSuccessRef.current = true;
            setStatusColor("#ef4444");

            setAttendanceDetails({
              empName,
              empId,
              status: "Location Restricted",
              isDuplicate: true,
              customMessage: alertMsg,
              confidence: data.confidence || 95,
              time: formatTime12H(data.time12 || data.time || new Date()),
              gpsDetails: buildGpsTelemetry(data, data)
            });
            setResultMessage(`⛔ Outside Office Location: ${empName}`);
            speakText(data.message || "You are not in office location");
            startAutoDismissCountdown(4);
          }
          return;
        }

        if (data.invalidTime) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId = data.empId || userDataRef.current?.empCode || "";
          const alertMsg = data.message || "Attendance slot timing is invalid or closed.";
          playAlertChime();
          setScanSuccess(true);
          scanSuccessRef.current = true;
          setStatusColor("#ef4444");

          setAttendanceDetails({
            empName,
            empId,
            status: "Time Window Closed",
            isDuplicate: true,
            customMessage: alertMsg,
            confidence: data.confidence || 95,
            time: formatTime12H(data.time12 || data.time || new Date()),
            gpsDetails: buildGpsTelemetry(data, data)
          });
          setResultMessage(`⛔ ${data.message}`);
          speakText(data.message);
          startAutoDismissCountdown(4);
          return;
        }

        if (data.hasPermission === false || (data.success === false && data.message && (data.message.includes("Permission") || data.message.includes("Lunch Out is permitted") || data.message.includes("Evening Out is permitted")))) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId = data.empId || userDataRef.current?.empCode || "";
          const alertMsg = data.message || "Approved permission required for this exit.";
          playAlertChime();
          setScanSuccess(true);
          scanSuccessRef.current = true;
          setStatusColor("#ef4444");

          setAttendanceDetails({
            empName,
            empId,
            status: "Permission Required",
            isDuplicate: true,
            customMessage: alertMsg,
            confidence: data.confidence || 90,
            time: formatTime12H(data.time12 || data.time || new Date()),
            gpsDetails: buildGpsTelemetry(data, data)
          });
          setResultMessage(`⛔ Permission Required: ${empName}`);
          speakText(alertMsg);

          startAutoDismissCountdown(4);
          return;
        }

        if (data.alreadyMarked) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId = data.empId || userDataRef.current?.empCode || "";
          const displayTime = formatTime12H(data.time12 || data.time || new Date());
          const slotName = data.status || selectedStatusRef.current || "Morning In";
          const alertMsg = data.message || `${slotName} was already marked at ${displayTime}`;

          playAlertChime();
          setScanSuccess(true);
          scanSuccessRef.current = true;
          setStatusColor("#f59e0b");

          setAttendanceDetails({
            empName,
            empId,
            status: slotName,
            isDuplicate: true,
            customMessage: `⚠️ ${slotName} was already recorded at ${displayTime}. You cannot punch again for this session.`,
            confidence: data.confidence || 98,
            time: displayTime,
            officeName: data.officeName || "",
            presenceMethod: data.presenceMethod || "Face Only",
            gpsDetails: buildGpsTelemetry(data, data)
          });
          setResultMessage(`⚠️ ${slotName} Already Marked: ${empName}`);
          speakText(`${slotName} already marked for ${empName}`);

          if (empId) recentlyMarkedMapRef.current.set(empId, nowTs);
          startAutoDismissCountdown(3);
          return;
        }

        if (data.success) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId = data.empId || userDataRef.current?.empCode || "";
          const displayTime = formatTime12H(data.time12 || data.time || new Date());
          const slotName = data.status || selectedStatusRef.current || "Morning In";

          playSuccessChime();
          setScanSuccess(true);
          scanSuccessRef.current = true;
          setStatusColor("#10b981");

          setAttendanceDetails({
            empName,
            empId,
            status: slotName,
            isDuplicate: false,
            customMessage: `✅ ${slotName} recorded successfully at ${displayTime}.`,
            time: displayTime,
            officeName: data.officeName || "",
            presenceMethod: data.presenceMethod || "Face Only",
            graceType: data.graceType || "",
            lateMinutes: data.lateMinutes ?? 0,
            date: data.date || new Date().toLocaleDateString('en-GB'),
            attendanceStatus: data.attendanceStatus || "",
            confidence: data.confidence || 98,
            gpsDetails: buildGpsTelemetry(data, data)
          });
          setResultMessage(`✅ Welcome, ${empName}`);
          speakText(`${empName} attendance marked successfully`);

          // Re-fetch monthly grace totals to update counters instantly
          if (empId) {
            recentlyMarkedMapRef.current.set(empId, nowTs);
            fetchGraceSummary(empId);
          }

          // Full 3-second visual confirmation popup with animated progress bar
          startAutoDismissCountdown(3);
        } else {
          setAttendanceDetails(null);
          setResultMessage("Align face to scan");
          setStatusColor("#8b5cf6");
          scheduleNextScan(150);
        }
      } else { scheduleNextScan(200); }
    } catch (err: any) {
      logDebug("Err: " + err.message);
      let userFriendlyMsg = "Connection Error";
      const raw = (err?.message || "").toLowerCase();
      if (raw.includes("500") || raw.includes("conversion") || raw.includes("sql") || raw.includes("reference")) {
        userFriendlyMsg = "Service temporarily unavailable. Please try again.";
      } else if (raw.includes("timeout") || raw.includes("network") || raw.includes("fetch") || raw.includes("connection")) {
        userFriendlyMsg = "Connection Timeout. Please check network.";
      } else {
        userFriendlyMsg = err?.message || "Connection Error";
      }
      setResultMessage(`❌ ${userFriendlyMsg}`); setStatusColor("#ef4444"); scheduleNextScan(1500);
    }
    finally { setIsProcessing(false); isProcessingRef.current = false; }
  };

  useEffect(() => {
    if (isCameraReady) scheduleNextScan(400);
    return () => { if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current); };
  }, [isCameraReady]);

  // ── BLE scan ──────────────────────────────────────────────────────────────
  const verifyEasyReach = async () => {
    if (!Capacitor.isNativePlatform() || isBleScanning || bleVerifiedRef.current) return;
    setIsBleScanning(true);
    logDebug("BLE Scan started...");
    try {
      let found = false;
      await BleClient.requestLEScan({}, async (result: ScanResult) => {
        try {
          const name = (result.device.name || "").trim().toUpperCase();
          const mac = (result.device.deviceId || "").replace(/[:-]/g, "").trim().toUpperCase();
          const isUuid = mac.length > 12;
          const rssi = result.rssi ?? -100;

          logDebug(`Scanned: ${name} (${rssi} dBm)`);

          let matchedBeacon: { name: string, mac: string } | null = null;

          if (allowedBeaconsRef.current.length > 0) {
            for (const b of allowedBeaconsRef.current) {
              const dbName = b.name.trim().toUpperCase();
              const dbMac = b.mac.replace(/[:-]/g, "").trim().toUpperCase();
              const macMatch = dbMac.length > 0 && mac === dbMac;
              const nameMatch = dbName.length > 0 && name === dbName;
              if (macMatch || (isUuid && nameMatch) || (nameMatch && !dbMac)) {
                matchedBeacon = b;
                break;
              }
            }
          } else {
            if (name === "ER2650001F" || mac === "EA2658F0001F" || mac === "DD8800003DAB" || name.startsWith("BCPRO")) {
              matchedBeacon = { name: name || "BCPro_22733", mac: mac || "DD8800003DAB" };
            }
          }

          if (matchedBeacon) {
            setBleSignalStrength(rssi);
            const isCloseEnough = rssi >= -140;

            if (isCloseEnough) {
              found = true; setBleVerified(true); bleVerifiedRef.current = true;
              const finalName = name || matchedBeacon.name || "Bluetooth Beacon";
              setBleDeviceName(finalName);
              setBleDeviceId(result.device.deviceId);
              logDebug(`Beacon verified: ${finalName} (${mac || result.device.deviceId}) at ${rssi} dBm`);
              await BleClient.stopLEScan();
            } else {
              logDebug(`Beacon found but too far: ${name || matchedBeacon.name} (${rssi} dBm)`);
            }
          }
        } catch { }
      });
      if (bleTimeoutRef.current) clearTimeout(bleTimeoutRef.current);
      bleTimeoutRef.current = setTimeout(async () => {
        try { await BleClient.stopLEScan(); } catch { }
        setIsBleScanning(false);
        logDebug(`BLE cycle done. Found=${found}`);
        if (!found && !bleVerifiedRef.current) bleTimeoutRef.current = setTimeout(verifyEasyReach, 5000);
      }, 7000);
    } catch (e: any) {
      logDebug("BLE Scan err: " + e.message);
      setIsBleScanning(false); setBleVerified(false);
      if (!bleVerifiedRef.current) bleTimeoutRef.current = setTimeout(verifyEasyReach, 5000);
    }
  };

  const toggleCameraMode = () => { setIsCameraReady(false); setCameraMode(p => p === "user" ? "environment" : "user"); };

  // Cooldown countdown state
  const [cooldownCountdown, setCooldownCountdown] = useState<number>(0);
  const cooldownCountdownRef = useRef(0);

  useEffect(() => {
    cooldownCountdownRef.current = cooldownCountdown;
  }, [cooldownCountdown]);

  useEffect(() => {
    if (cooldownCountdown > 0) {
      const timer = setTimeout(() => {
        setCooldownCountdown(prev => {
          if (prev <= 1) {
            scheduleNextScan(200);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownCountdown]);

  // Drag Sheet Gesture values
  const COLLAPSED_Y = 340;
  const [sheetY, setSheetY] = useState(COLLAPSED_Y);
  const [isDragging, setIsDragging] = useState(false);
  const [sheetState, setSheetState] = useState<"collapsed" | "expanded">("collapsed");
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    if (isMobile) {
      if (scanSuccess) {
        setSheetState("expanded");
        setSheetY(0);
      } else {
        setSheetState("collapsed");
        setSheetY(COLLAPSED_Y);
      }
    } else {
      setSheetY(0);
    }
  }, [scanSuccess, isMobile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY.current;
    let newY = sheetState === "collapsed" ? COLLAPSED_Y + deltaY : deltaY;
    if (newY < 0) newY = 0;
    if (newY > COLLAPSED_Y) newY = COLLAPSED_Y;
    setSheetY(newY);
    currentY.current = newY;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentY.current > COLLAPSED_Y / 2) {
      setSheetState("collapsed"); setSheetY(COLLAPSED_Y);
    } else {
      setSheetState("expanded"); setSheetY(0);
    }
  };

  const toggleSheet = () => {
    if (sheetState === "collapsed") {
      setSheetState("expanded"); setSheetY(0);
    } else {
      setSheetState("collapsed"); setSheetY(COLLAPSED_Y);
    }
  };

  const renderSlotSelector = () => (
    <div className="status-override-container" style={{ marginBottom: isMobile ? '12px' : '18px', paddingBottom: isMobile ? '0' : '16px', borderBottom: isMobile ? 'none' : '1px solid #f1f5f9' }}>
      <div className="status-title-row">
        <span className="checklist-header" style={{ margin: 0 }}>Target Attendance Slot</span>
        <button
          onClick={() => setShowRulesModal(true)}
          style={{ background: 'transparent', border: 'none', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
        >
          <IonIcon icon={informationCircleOutline} style={{ fontSize: '14px' }} />
          View Rules
        </button>
      </div>

      <div className="status-btn-group">
        {["Morning In", "Lunch Out", "Lunch In", "Evening Out", "Permission Out", "Permission In"].map(slot => {
          const isAuto = slot === getAutoStatus();
          const isActive = selectedStatus === slot;
          const shortLabel =
            slot === "Morning In" ? "Morning" :
            slot === "Lunch Out" ? "Lunch Out" :
            slot === "Lunch In" ? "Lunch In" :
            slot === "Evening Out" ? "Evening" :
            slot === "Permission Out" ? "Perm Out" : "Perm In";
          const slotClass =
            slot === "Morning In" ? "slot-morning" :
            slot === "Lunch Out" ? "slot-lunch-out" :
            slot === "Lunch In" ? "slot-lunch-in" :
            slot === "Evening Out" ? "slot-evening" :
            slot === "Permission Out" ? "slot-perm-out" : "slot-perm-in";
          return (
            <button
              key={slot}
              className={`status-btn ${slotClass} ${isActive ? 'active' : ''}`}
              onClick={() => handleSlotSelect(slot)}
            >
              <span>{shortLabel}</span>
              {isAuto && <span className="auto-tag">Auto</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <IonPage>
      <IonContent fullscreen scrollY={true} className="scanner-pg">

        {/* Style block overrides for clean white dashboard and widgets */}
        <style>{`
          .scanner-pg {
            --background: #ffffff !important;
          }
          .sc-shell {
            background: #ffffff !important;
            background-image: 
              radial-gradient(circle at 80% 5%, rgba(99, 102, 241, 0.03) 0%, transparent 35%),
              radial-gradient(circle at 10% 85%, rgba(16, 185, 129, 0.025) 0%, transparent 40%) !important;
            background-size: cover;
          }
          
          /* Status override buttons widget styling */
          .status-override-container {
            margin-bottom: 0;
            flex: 1 1 auto;
            min-width: 0;
          }
          .status-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .status-btn-group {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
            background: #f8fafc;
            padding: 3px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
          }
          @media (max-width: 640px) {
            .sc-header {
              flex-wrap: wrap !important;
              gap: 6px 10px !important;
              padding: calc(env(safe-area-inset-top) + 8px) 12px 8px !important;
            }
            .sc-title-wrap {
              flex: 1 !important;
            }
            .status-override-container {
              width: 100% !important;
              flex: 0 0 100% !important;
              order: 3 !important;
              margin-top: 2px !important;
            }
            .status-btn-group {
              grid-template-columns: repeat(4, 1fr) !important;
              gap: 3px !important;
              padding: 2px !important;
              border-radius: 8px !important;
            }
            .status-btn {
              padding: 2px 2px !important;
              height: 23px !important;
              font-size: 0.60rem !important;
              border-radius: 6px !important;
            }
          }
          .status-btn {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 3px 4px;
            height: 25px;
            border-radius: 8px;
            font-size: 0.65rem;
            font-weight: 750;
            color: #475569;
            cursor: pointer;
            transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          }
          .status-btn.slot-morning.active {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25) !important;
            border-color: #10b981 !important;
          }
          .status-btn.slot-lunch-out.active {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25) !important;
            border-color: #f59e0b !important;
          }
          .status-btn.slot-lunch-in.active {
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25) !important;
            border-color: #0ea5e9 !important;
          }
          .status-btn.slot-evening.active {
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25) !important;
            border-color: #8b5cf6 !important;
          }
          .status-btn.slot-morning:not(.active):hover {
            background: rgba(16, 185, 129, 0.05);
            color: #059669;
            border-color: rgba(16, 185, 129, 0.25);
          }
          .status-btn.slot-lunch-out:not(.active):hover {
            background: rgba(245, 158, 11, 0.05);
            color: #d97706;
            border-color: rgba(245, 158, 11, 0.25);
          }
          .status-btn.slot-lunch-in:not(.active):hover {
            background: rgba(14, 165, 233, 0.05);
            color: #0284c7;
            border-color: rgba(14, 165, 233, 0.25);
          }
          .status-btn.slot-evening:not(.active):hover {
            background: rgba(139, 92, 246, 0.05);
            color: #7c3aed;
            border-color: rgba(139, 92, 246, 0.25);
          }
          .auto-tag {
            position: absolute;
            top: -4px;
            right: -1px;
            background: #e0e7ff;
            color: #4f46e5;
            font-size: 0.44rem;
            padding: 0px 3px;
            border-radius: 4px;
            font-weight: 800;
            line-height: 1.1;
            border: 1px solid rgba(79, 70, 229, 0.15);
          }
          .sc-cam-pause-btn {
            position: absolute;
            bottom: 16px;
            right: 68px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(15, 23, 42, 0.65);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            cursor: pointer;
            z-index: 15;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all 0.2s;
          }
          .sc-cam-pause-btn:hover {
            background: rgba(15, 23, 42, 0.85);
            transform: scale(1.05);
          }
          .sc-cam-pause-btn:active {
            transform: scale(0.92);
          }
          .sc-cam-pause-btn.is-paused {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
            border-color: #f59e0b !important;
            box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4) !important;
            color: #ffffff !important;
          }
          @media (max-width: 768px) {
            .sc-cam-pause-btn {
              bottom: 12px !important;
              right: 48px !important;
              width: 32px !important;
              height: 32px !important;
              font-size: 15px !important;
            }
          }

          /* Monthly grace tracker tracker layout */
          .grace-tracker-title {
            font-size: 0.85rem;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 20px 0 10px 0;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .grace-summary-box {
            display: grid;
            grid-template-columns: 1fr 1.15fr;
            gap: 12px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.01);
            align-items: center;
          }
          .circle-progress-container {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .progress-label-val {
            position: absolute;
            font-size: 1.1rem;
            font-weight: 850;
            color: #1e293b;
            top: 48%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
          .grace-details-panel {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .grace-stat-row {
            display: flex;
            justify-content: space-between;
            font-size: 0.78rem;
            font-weight: 600;
            color: #64748b;
          }
          .grace-stat-row span.val-high {
            color: #1e293b;
            font-weight: 750;
          }

          /* "Where it was cut" history section */
          .grace-history-container {
            margin-top: 14px;
            max-height: 120px;
            overflow-y: auto;
            border: 1px solid #f1f5f9;
            border-radius: 14px;
            background: #f8fafc;
            padding: 8px 12px;
          }
          .grace-history-empty {
            font-size: 0.72rem;
            color: #94a3b8;
            text-align: center;
            padding: 12px 0;
            font-weight: 500;
          }
          .grace-history-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 0.72rem;
            font-weight: 600;
          }
          .grace-history-row:last-child {
            border-bottom: none;
          }
          .history-date {
            color: #475569;
          }
          .history-type {
            font-size: 0.65rem;
            padding: 2px 6px;
            border-radius: 8px;
            font-weight: 800;
          }
          .type-free { background: #dcfce7; color: #15803d; }
          .type-perm { background: #e0e7ff; color: #4f46e5; }
          .type-lop { background: #fee2e2; color: #ef4444; }

          @media (max-width: 480px) {
            .grace-summary-box {
              grid-template-columns: 1fr !important;
              gap: 16px !important;
              justify-items: center !important;
              text-align: center !important;
            }
            .grace-details-panel {
              width: 100% !important;
            }
            .grace-stat-row {
              justify-content: space-between !important;
              width: 100% !important;
              font-size: 0.72rem !important;
            }
          }
        `}</style>

        <div className="sc-kiosk-page-container">

          {/* ── Premium Native Header ── */}
          <div className="sc-top-nav">
            <div className="sc-top-nav-left">
              <button className="sc-top-nav-back-btn" onClick={() => history.goBack()} title="Go Back">
                <IonIcon icon={arrowBackOutline} style={{ color: "white" }} />
              </button>
              <div className="sc-top-nav-title-wrap">
                <h1 className="sc-top-nav-title">AI Attendance</h1>
                <p className="sc-top-nav-subtitle">
                  {userData?.EmpName || userData?.empName ? `👤 ${userData?.EmpName || userData?.empName} (#${userData?.empCode || userData?.EmpCode || ''})` : 'Biometric Face Verification'}
                </p>
              </div>
            </div>
            <div className="sc-top-nav-right">
              <button
                className="sc-top-nav-kiosk-btn"
                onClick={() => history.push('/security-attendance-scanner')}
                title="Switch to Kiosk Mode"
              >
                <IonIcon icon={fingerPrintOutline} />
                <span>Kiosk</span>
              </button>
              <button
                className="sc-top-nav-rules-btn"
                onClick={() => setShowRulesModal(true)}
                title="View Attendance Rules"
              >
                <IonIcon icon={informationCircleOutline} />
                <span>Rules</span>
              </button>
              <button
                className="sc-top-nav-log-btn"
                onClick={() => history.push('/ai-attendance-log/user')}
                title="View Attendance Logs"
              >
                <IonIcon icon={calendarOutline} />
              </button>
            </div>
          </div>

          {/* ── CENTERED KIOSK TERMINAL VIEW ── */}
          <div className="sc-kiosk-wrapper">

            {/* 1. Unified 2-Row Native Kiosk Toolbar */}
            <div className="sc-kiosk-toolbar">
              <div className="sc-kiosk-tb-row1">
                <button
                  className="sc-kiosk-slot-trigger"
                  onClick={() => setShowSlotModal(true)}
                  type="button"
                  title="Click to Switch Attendance Slot"
                >
                  <div className="sc-kiosk-slot-left">
                    <span className="sc-active-slot-dot" />
                    <span className="sc-kiosk-slot-label">
                      Target: <strong>{getSlotColorConfig(selectedStatus).label}</strong>
                    </span>
                  </div>
                  <span className="sc-kiosk-change-badge">🔄 Switch Slot</span>
                </button>
              </div>

              <div className="sc-kiosk-tb-row2">
                <div
                  className="sc-kiosk-status-pill"
                  style={{
                    color: statusColor,
                    background: `${statusColor}14`,
                    borderColor: `${statusColor}40`
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: statusColor,
                      display: 'inline-block'
                    }}
                  />
                  <span>
                    {isScannerPaused
                      ? 'PAUSED'
                      : isProcessing
                        ? 'ANALYZING FACE...'
                        : guidanceState === 'aligned'
                          ? 'FACE ALIGNED & READY'
                          : guidanceState === 'too-far'
                            ? 'COME CLOSER'
                            : guidanceState === 'too-close'
                              ? 'MOVE BACK'
                              : guidanceState === 'off-center'
                                ? 'CENTER FACE'
                                : 'ALIGN FACE'}
                  </span>
                </div>

                <div className="sc-kiosk-telem-group">
                  <div
                    className={`sc-ind ${activeRule?.gpsRequired === false ? 'ind-ok' : locationReady ? 'ind-ok' : 'ind-wait'}`}
                    style={activeRule?.gpsRequired === false ? { background: 'rgba(148, 163, 184, 0.1)', color: '#64748b', borderColor: '#cbd5e1' } : {}}
                  >
                    <IonIcon icon={pinOutline} />
                    <span>{activeRule?.gpsRequired === false ? 'GPS: OFF' : locationReady ? 'GPS OK' : 'GPS Fix…'}</span>
                  </div>
                  <div
                    className={`sc-ind ${activeRule?.btRequired === false ? 'ind-ok' : bleVerified ? 'ind-ok' : 'ind-wait'}`}
                    style={
                      activeRule?.btRequired === false
                        ? { background: 'rgba(148, 163, 184, 0.1)', color: '#64748b', borderColor: '#cbd5e1' }
                        : !bleVerified && bleSignalStrength !== null && bleSignalStrength < -80
                          ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }
                          : {}
                    }
                  >
                    <IonIcon icon={bluetoothOutline} />
                    <span>{activeRule?.btRequired === false ? 'BLE: OFF' : bleVerified ? 'Beacon OK' : bleSignalStrength !== null && bleSignalStrength < -80 ? 'BLE Weak' : 'Beacon…'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Centered Camera Viewport */}
            <div className="sc-kiosk-camera-box">
              <video ref={videoRef} autoPlay playsInline muted className="sc-video" />

              <div className="sc-hud">
                <div className={`sc-fixed-guide-target state-${scanSuccess ? 'success' : isProcessing ? 'aligned is-scanning' : guidanceState === 'aligned' ? 'aligned' : guidanceState === 'idle' ? 'idle' : 'warning'}`}>
                  {/* Outer slow-rotating calibration dial */}
                  <div className="sc-fixed-dial-outer" />

                  {/* Fixed Biometric Frame */}
                  <div className="sc-fixed-frame" />

                  {/* 4 Precision Corner Brackets */}
                  <div className="sc-guide-corner tl" />
                  <div className="sc-guide-corner tr" />
                  <div className="sc-guide-corner bl" />
                  <div className="sc-guide-corner br" />

                  {/* Subtle Face Silhouette Guide */}
                  <svg className="sc-face-silhouette" viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="60" cy="72" rx="42" ry="54" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 4" />
                    <circle cx="45" cy="62" r="3" fill="currentColor" opacity="0.6" />
                    <circle cx="75" cy="62" r="3" fill="currentColor" opacity="0.6" />
                    <path d="M52 82 Q60 88 68 82" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>

                  {/* Active Laser Sweeper */}
                  <div className="sc-guide-laser" />
                </div>

                {/* Live HUD Floating Guidance Pill */}
                {!scanSuccess && (
                  <div className={`sc-hud-guidance-pill pill-${isProcessing ? 'aligned' : guidanceState}`}>
                    <span>{isProcessing ? '⚡ Hold still, analyzing face...' : guidanceText}</span>
                  </div>
                )}
              </div>

              {!isCameraReady && (
                <div className="sc-cam-loader" style={{ background: '#090d16', color: '#ffffff' }}>
                  <div className="tech-loader">
                    <div className="tech-ring-1" />
                    <div className="tech-ring-2" />
                    <div className="tech-ring-3" />
                    <div className="tech-center" />
                  </div>
                  <p style={{ color: '#818cf8', marginTop: '16px', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                    INITIALIZING CAMERA…
                  </p>
                </div>
              )}

              {capturedImg && (
                <div className="sc-last-capture-preview" onClick={() => setCapturedImg(null)} title="Clear Preview">
                  <img src={capturedImg} alt="last scan preview" />
                </div>
              )}

              {/* Floating Camera Control Buttons */}
              {isCameraReady && (
                <div className="sc-kiosk-cam-actions">
                  <button
                    className={`sc-cam-pause-btn ${isScannerPaused ? 'is-paused' : ''}`}
                    onClick={toggleScannerPause}
                    title={isScannerPaused ? "Resume Scanner" : "Pause Scanner"}
                    type="button"
                  >
                    <IonIcon icon={isScannerPaused ? playOutline : pauseOutline} />
                  </button>
                  <button
                    className="sc-cam-flip-btn"
                    onClick={toggleCameraMode}
                    title="Flip Camera"
                    type="button"
                  >
                    <IonIcon icon={cameraReverseOutline} />
                  </button>
                </div>
              )}

              {/* Debug Logs */}
              <div className="sc-debug-logs" style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                zIndex: 20,
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#94a3b8',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: '8px',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                maxWidth: '65%',
                lineHeight: '1.2',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {debugLogs.length === 0 ? "[DEBUG] Scanner Active" : debugLogs.slice(0, 2).map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>

            {/* 3. Kiosk Bottom 3-Card Info Summary */}
            <div className="sc-kiosk-footer-info">
              <div className="sc-kiosk-info-card">
                <div className="sc-kiosk-info-icon" style={{ background: '#eef2ff', borderColor: '#c7d2fe', color: '#4f46e5' }}>
                  👤
                </div>
                <div className="sc-kiosk-info-text">
                  <div className="sc-kiosk-info-title">{userData?.EmpName || userData?.empName || 'Employee'}</div>
                  <div className="sc-kiosk-info-subtitle">ID #{userData?.empCode || userData?.EmpCode || ''} • {userData?.Department || 'Staff'}</div>
                </div>
              </div>

              <div className="sc-kiosk-info-card">
                <div className="sc-kiosk-info-icon" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#059669' }}>
                  📍
                </div>
                <div className="sc-kiosk-info-text">
                  <div className="sc-kiosk-info-title">Office: {userData?.Branch || cityName || 'Geofence Active'}</div>
                  <div className="sc-kiosk-info-subtitle">{locationReady ? 'GPS Geofence Verified' : 'GPS Locating…'}</div>
                </div>
              </div>

              <div className="sc-kiosk-info-card">
                <div className="sc-kiosk-info-icon" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#d97706' }}>
                  ⏱️
                </div>
                <div className="sc-kiosk-info-text">
                  <div className="sc-kiosk-info-title">Graces: {graceSummary?.gracesLeft ?? 4} / {graceSummary?.freeGracesMax ?? 4} Left</div>
                  <div className="sc-kiosk-info-subtitle">Perm Balance: {graceSummary?.permissionBalance ?? 0}m</div>
                </div>
              </div>
            </div>

          </div>

          {/* ── TARGET ATTENDANCE SLOT POPUP MODAL ── */}
          {showSlotModal && (
            <div className="slot-hub-modal-overlay">
              <div className="slot-hub-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="slot-hub-header">
                  <div className="slot-hub-title-group">
                    <div className="slot-hub-icon-wrap">🎯</div>
                    <div>
                      <h2 className="slot-hub-title">Target Attendance Slot</h2>
                      <p className="slot-hub-subtitle">Select session to start camera scan</p>
                    </div>
                  </div>
                  <button
                    className="slot-hub-rules-btn"
                    onClick={() => setShowRulesModal(true)}
                    type="button"
                  >
                    <IonIcon icon={informationCircleOutline} style={{ fontSize: '17px' }} />
                    <span>Rules</span>
                  </button>
                </div>

                <div className="slot-hub-grid">
                  {[
                    { key: "Morning In", label: "Morning", icon: "🌅", desc: "Workday In" },
                    { key: "Lunch Out", label: "Lunch Out", icon: "🍱", desc: "Break Exit" },
                    { key: "Lunch In", label: "Lunch In", icon: "🥗", desc: "Break Return" },
                    { key: "Evening Out", label: "Evening", icon: "🌇", desc: "Workday Exit" },
                    { key: "Permission Out", label: "Perm Out", icon: "🚪", desc: "Short Exit" },
                    { key: "Permission In", label: "Perm In", icon: "🏁", desc: "Office Return" }
                  ].map(item => {
                    const isAuto = item.key === getAutoStatus();
                    const isSelected = selectedStatus === item.key;
                    const slotClass =
                      item.key === "Morning In" ? "slot-item-morning-in" :
                      item.key === "Lunch Out" ? "slot-item-lunch-out" :
                      item.key === "Lunch In" ? "slot-item-lunch-in" :
                      item.key === "Evening Out" ? "slot-item-evening-out" :
                      item.key === "Permission Out" ? "slot-item-permission-out" : "slot-item-permission-in";

                    return (
                      <button
                        key={item.key}
                        className={`slot-hub-item ${slotClass} ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSlotSelect(item.key)}
                        type="button"
                      >
                        <div className="slot-hub-item-icon">{item.icon}</div>
                        <div className="slot-hub-item-info">
                          <span className="slot-hub-item-title">{item.label}</span>
                          <span className="slot-hub-item-desc">{item.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {graceSummary && (
                  <div className="slot-hub-grace-bar" style={{ marginTop: '14px' }}>
                    <span>🎯 Free Graces Left: <strong>{graceSummary.gracesLeft ?? 4} / {graceSummary.freeGracesMax ?? 4}</strong></span>
                    <span>🚪 Permission Balance: <strong>{graceSummary.permissionBalance ?? 0} mins</strong></span>
                    {graceSummary.permissionSessionsLeft !== undefined && (
                      <span>⏱️ Sessions Left: <strong>{graceSummary.permissionSessionsLeft} / {graceSummary.permissionSessionsMax ?? 6}</strong></span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RULES INFO MODAL */}
          {showRulesModal && (
            <div className="rules-modal-overlay">
              <div className="rules-modal-card">
                {/* 1. Header */}
                <div className="rules-modal-header">
                  <div>
                    <span className="rules-modal-badge">
                      ⚡ Global Policy Master
                    </span>
                    <h3 className="rules-modal-title">
                      Face Attendance Policy Master
                    </h3>
                    <p className="rules-modal-subtitle">
                      Configure and dynamically control all Face Attendance, Free Grace, Permission, LOP &amp; Yellow Slip Rules
                    </p>
                  </div>
                  <button
                    className="rules-modal-close-btn"
                    onClick={() => setShowRulesModal(false)}
                    type="button"
                    title="Close"
                  >
                    <IonIcon icon={closeOutline} />
                  </button>
                </div>

                {/* 2. Top Highlights Metrics Ribbon */}
                <div className="rules-modal-ribbon">
                  <div className="rules-ribbon-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                    <span className="rules-ribbon-icon">🛡️</span>
                    <div className="rules-ribbon-text">
                      <div className="rules-ribbon-val" style={{ color: '#1e40af' }}>{getPolVal('FreeGraceMonthlyCount', '4')} Graces</div>
                      <div className="rules-ribbon-sub" style={{ color: '#3b82f6' }}>Max {getPolVal('FreeGraceMaxMinutes', '15')}m / grace</div>
                    </div>
                  </div>
                  <div className="rules-ribbon-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                    <span className="rules-ribbon-icon">⏱️</span>
                    <div className="rules-ribbon-text">
                      <div className="rules-ribbon-val" style={{ color: '#065f46' }}>{getPolVal('MaxPermissionSessionsPerMonth', '6')} Sessions</div>
                      <div className="rules-ribbon-sub" style={{ color: '#10b981' }}>Allotted P_Time</div>
                    </div>
                  </div>
                  <div className="rules-ribbon-card" style={{ background: '#faf5ff', borderColor: '#e9d5ff' }}>
                    <span className="rules-ribbon-icon">⚠️</span>
                    <div className="rules-ribbon-text">
                      <div className="rules-ribbon-val" style={{ color: '#6b21a8' }}>{getPolVal('TotalAllowedLateOccasions', '10')} Occasions</div>
                      <div className="rules-ribbon-sub" style={{ color: '#a855f7' }}>Monthly Late Cap</div>
                    </div>
                  </div>
                  <div className="rules-ribbon-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                    <span className="rules-ribbon-icon">🍱</span>
                    <div className="rules-ribbon-text">
                      <div className="rules-ribbon-val" style={{ color: '#92400e' }}>{getPolVal('LunchBreakDurationMinutes', '60')}m Break</div>
                      <div className="rules-ribbon-sub" style={{ color: '#f59e0b' }}>Auto from Lunch Out</div>
                    </div>
                  </div>
                  <div className="rules-ribbon-card" style={{ background: '#fff1f2', borderColor: '#fecdd3' }}>
                    <span className="rules-ribbon-icon">🟨</span>
                    <div className="rules-ribbon-text">
                      <div className="rules-ribbon-val" style={{ color: '#9f1239' }}>Yellow Slips</div>
                      <div className="rules-ribbon-sub" style={{ color: '#ef4444' }}>&gt; 10 Occ / 3 Excess</div>
                    </div>
                  </div>
                </div>

                {/* 3. Structured Policy Cards Body */}
                <div className="rules-modal-body text-left">
                  {/* Section 1 */}
                  <div className="rule-card">
                    <div className="rule-card-header">
                      <h4 className="rule-card-title">
                        🌅 1. Morning In Window &amp; Monthly Free Grace Rules
                      </h4>
                      <span className="rule-card-badge">Morning Reporting</span>
                    </div>
                    <ul className="rule-list">
                      <li className="rule-item">
                        <span className="rule-tag">Dynamic In-Time</span>
                        <span className="rule-text">Reporting time is strictly read from your employee profile in <code>tbl_employee.InTime</code> (e.g. 09:00, 09:30, 10:00).</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">{getPolVal('FreeGraceMonthlyCount', '4')} Free Graces</span>
                        <span className="rule-text">Allowed <strong>{getPolVal('FreeGraceMonthlyCount', '4')} Free Graces</strong> per calendar month for late arrival up to <strong>{getPolVal('FreeGraceMaxMinutes', '15')} minutes</strong> each.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">{getPolVal('MaxPermissionSessionsPerMonth', '6')} Sessions</span>
                        <span className="rule-text">Subsequent late arrivals auto-deduct from your monthly allotted <code>P_Time</code> balance (up to <strong>{getPolVal('MaxPermissionSessionsPerMonth', '6')} permission sessions</strong>).</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">{getPolVal('TotalAllowedLateOccasions', '10')} Cap</span>
                        <span className="rule-text">Maximum <strong>{getPolVal('TotalAllowedLateOccasions', '10')} late occasions</strong> allowed per month ({getPolVal('FreeGraceMonthlyCount', '4')} free graces + {getPolVal('MaxPermissionSessionsPerMonth', '6')} permissions). After {getPolVal('MaxPermissionSessionsPerMonth', '6')} sessions, permission adjustment is stopped even if P_Time balance remains.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>Occasion Penalty</span>
                        <span className="rule-text">Exceeding {getPolVal('TotalAllowedLateOccasions', '10')} occasions OR having zero permission balance converts the total late time including the 60 min grace to <strong>Loss of Pay (LOP) + 1 Yellow Slip</strong>.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 2 */}
                  <div className="rule-card">
                    <div className="rule-card-header">
                      <h4 className="rule-card-title">
                        🍱 2. Lunch Break &amp; Afternoon Rules
                      </h4>
                      <span className="rule-card-badge">Lunch Hours</span>
                    </div>
                    <ul className="rule-list">
                      <li className="rule-item">
                        <span className="rule-tag">Lunch Window</span>
                        <span className="rule-text">Standard lunch break is from <strong>{getPolVal('StandardLunchStartTime', '13:30:00')} to {getPolVal('StandardLunchEndTime', '14:30:00')}</strong>.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">Auto {getPolVal('LunchBreakDurationMinutes', '60')}m</span>
                        <span className="rule-text">If you punch Lunch Out at 2:00 PM, 3:00 PM, 4:00 PM, etc., the system auto-calculates exactly <strong>{getPolVal('LunchBreakDurationMinutes', '60')} minutes break</strong> from your actual Lunch Out punch.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>No PM Grace</span>
                        <span className="rule-text">Free grace applies ONLY to Morning In. Late arrival beyond {getPolVal('LunchBreakDurationMinutes', '60')} minutes auto-deducts from Permission balance or converts to Loss of Pay (LOP).</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 3 */}
                  <div className="rule-card">
                    <div className="rule-card-header">
                      <h4 className="rule-card-title">
                        🌆 3. Evening Out &amp; Shift Defaults
                      </h4>
                      <span className="rule-card-badge">Evening Shift</span>
                    </div>
                    <ul className="rule-list">
                      <li className="rule-item">
                        <span className="rule-tag">Checkout Threshold</span>
                        <span className="rule-text">Standard checkout time: <strong>{getPolVal('StandardEveningOutTime', '18:33:00')}</strong>. Register your punch before leaving.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 4 */}
                  <div className="rule-card">
                    <div className="rule-card-header">
                      <h4 className="rule-card-title">
                        ⏱️ 4. Monthly Permission Quotas &amp; Role Defaults (P_Time)
                      </h4>
                      <span className="rule-card-badge">Role Quotas</span>
                    </div>
                    <ul className="rule-list">
                      <li className="rule-item">
                        <span className="rule-tag">Technical</span>
                        <span className="rule-text"><strong>{getPolVal('TechnicalDefaultPermissionMinutes', '60')} minutes / month</strong> without LOP.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">Non-Technical</span>
                        <span className="rule-text"><strong>{getPolVal('NonTechnicalDefaultPermissionMinutes', '90')} minutes / month</strong> without LOP.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">Marketing</span>
                        <span className="rule-text"><strong>{getPolVal('MarketingDefaultPermissionMinutes', '240')} minutes / month</strong> without LOP.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">Max Session</span>
                        <span className="rule-text"><strong>{getPolVal('MaxSinglePermissionMinutes', '60')} minutes</strong> maximum per permission request.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 5 */}
                  <div className="rule-card">
                    <div className="rule-card-header">
                      <h4 className="rule-card-title">
                        ⚠️ 5. Excess Permission &amp; Double LOP Penalty Matrix
                      </h4>
                      <span className="rule-card-badge">LOP Deductions</span>
                    </div>
                    <ul className="rule-list">
                      <li className="rule-item">
                        <span className="rule-tag">Approved Excess</span>
                        <span className="rule-text">Allowed up to <strong>{getPolVal('ApprovedExcessPermissionMinutes', getPolVal('ApprovedExcessPermissionLimitMinutes', '180'))} min</strong> beyond allotted P_Time subject to available permission balance (overtime/carryover).</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag" style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}>1x LOP</span>
                        <span className="rule-text">Excess up to <strong>{getPolVal('SingleLopExcessMinutes', getPolVal('SingleLopExcessPermissionLimitMinutes', '120'))} min</strong> without balance attracts <strong>Single Loss of Pay (1x LOP)</strong>.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>2x Double LOP</span>
                        <span className="rule-text">Excess &gt; <strong>{getPolVal('DoubleLopExcessMinutes', getPolVal('DoubleLopThresholdMinutes', '120'))} min</strong> without balance attracts <strong>Double Loss of Pay (Double LOP / 2x LOP)</strong> (allotted permission time is also included in deduction).</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">Carry Forward</span>
                        <span className="rule-text">Surplus permission time carries forward monthly and can be encashed yearly with management approval.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag">Past LOP Finality</span>
                        <span className="rule-text">Permission time procured after LOP calculation or slip issuance cannot reverse past LOPs or cancel issued slips.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Section 6 */}
                  <div className="rule-card">
                    <div className="rule-card-header">
                      <h4 className="rule-card-title">
                        🟨 6. Yellow Slip &amp; Disciplinary Triggers
                      </h4>
                      <span className="rule-card-badge">Disciplinary Slips</span>
                    </div>
                    <ul className="rule-list">
                      <li className="rule-item">
                        <span className="rule-tag" style={{ background: '#fef08a', color: '#854d0e', borderColor: '#fde047' }}>+1 Yellow Slip</span>
                        <span className="rule-text">Issued automatically when exceeding <strong>{getPolVal('TotalAllowedLateOccasions', '10')} total late occasions</strong> in a month (total late time including 60m grace converts to LOP).</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag" style={{ background: '#fef08a', color: '#854d0e', borderColor: '#fde047' }}>+1 Yellow Slip</span>
                        <span className="rule-text">Issued for every <strong>{getPolVal('YellowSlipExcessFrequency', getPolVal('YellowSlipExcessPermissionInterval', '3'))} excess permission sessions</strong> without available balance.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 4. Footer */}
                <div className="rules-modal-footer">
                  <button
                    className="rules-btn-close"
                    onClick={() => setShowRulesModal(false)}
                    type="button"
                  >
                    Close Policy Guide
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BIOMETRIC ATTENDANCE VERIFIED MODAL OVERLAY */}
          {scanSuccess && attendanceDetails && createPortal(
            <div
              className="sc-success-popup-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) resetScannerAndResume();
              }}
            >
              <div className="sc-success-popup-card animate__animated animate__zoomIn">
                {/* 1. Top Status Badge Pill */}
                <div
                  className="sc-modal-header-badge"
                  style={{
                    background: !attendanceDetails.isDuplicate
                      ? '#ecfdf5'
                      : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                        ? '#fee2e2'
                        : '#fef3c7'),
                    color: !attendanceDetails.isDuplicate
                      ? '#047857'
                      : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                        ? '#b91c1c'
                        : '#b45309'),
                    border: `1px solid ${!attendanceDetails.isDuplicate
                      ? '#a7f3d0'
                      : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                        ? '#fecdd3'
                        : '#fde68a')}`
                  }}
                >
                  <IonIcon
                    icon={!attendanceDetails.isDuplicate ? checkmarkCircleOutline : alertCircleOutline}
                    style={{ fontSize: '15px' }}
                  />
                  <span>
                    {!attendanceDetails.isDuplicate
                      ? 'VERIFIED ATTENDANCE'
                      : (attendanceDetails.customMessage?.includes('already recorded')
                        ? 'ALREADY RECORDED TODAY'
                        : 'ATTENDANCE ALERT')}
                  </span>
                </div>

                {/* 2. Photo with Glowing Ring */}
                <div className="sc-modal-photo-wrap">
                  <div
                    className={`sc-modal-photo-ring ${
                      !attendanceDetails.isDuplicate
                        ? 'ring-ok'
                        : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                          ? 'ring-error'
                          : 'ring-warn')
                    }`}
                  >
                    {capturedImg ? (
                      <img src={capturedImg} alt="Face Snapshot" className="sc-modal-photo-img" />
                    ) : (
                      <div className="sc-modal-photo-img sc-modal-photo-fallback">
                        {(attendanceDetails.empName || 'E').charAt(0)}
                      </div>
                    )}
                  </div>
                  <div
                    className="sc-modal-photo-badge"
                    style={{
                      background: !attendanceDetails.isDuplicate
                        ? '#10b981'
                        : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                          ? '#ef4444'
                          : '#f59e0b')
                    }}
                  >
                    <IonIcon icon={!attendanceDetails.isDuplicate ? checkmarkCircleOutline : alertCircleOutline} />
                  </div>
                </div>

                {/* 3. Employee Name & ID (Rendered ONLY ONCE, Bold & Clean) */}
                <h2 className="sc-modal-emp-name">{attendanceDetails.empName}</h2>
                <div className="sc-modal-emp-id-wrap">
                  <span className="sc-modal-emp-id">ID: #{attendanceDetails.empId}</span>
                </div>

                {/* 4. Primary Highlight Status Banner */}
                <div
                  className="sc-modal-status-banner"
                  style={{
                    background: !attendanceDetails.isDuplicate
                      ? '#f0fdf4'
                      : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                        ? '#fef2f2'
                        : '#fffbeb'),
                    color: !attendanceDetails.isDuplicate
                      ? '#166534'
                      : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                        ? '#991b1b'
                        : '#92400e'),
                    border: `1px solid ${!attendanceDetails.isDuplicate
                      ? '#bbf7d0'
                      : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                        ? '#fecdd3'
                        : '#fde68a')}`
                  }}
                >
                  <div className="sc-modal-status-banner-text">
                    {attendanceDetails.customMessage || (
                      !attendanceDetails.isDuplicate
                        ? `✅ ${attendanceDetails.status} marked successfully.`
                        : `⚠️ ${attendanceDetails.status} was already marked.`
                    )}
                  </div>
                </div>

                {/* 5. Metrics Tiles (Slot, Punch Time, Face Match) */}
                <div className="sc-modal-metrics-row">
                  <div className="sc-modal-metric-card">
                    <span className="sc-modal-metric-label">Slot</span>
                    <span className="sc-modal-metric-value" style={{ color: getSlotColorConfig(attendanceDetails.status).color }}>
                      {getSlotColorConfig(attendanceDetails.status).label}
                    </span>
                  </div>

                  <div className="sc-modal-metric-card">
                    <span className="sc-modal-metric-label">Time</span>
                    <span className="sc-modal-metric-value" style={{ color: '#0f172a' }}>
                      {attendanceDetails.time}
                    </span>
                  </div>

                  <div className="sc-modal-metric-card">
                    <span className="sc-modal-metric-label">Face Match</span>
                    <span className="sc-modal-metric-value" style={{ color: '#4f46e5' }}>
                      {attendanceDetails.confidence || 98}%
                    </span>
                  </div>
                </div>

                {/* 5b. GPS & Telemetry Comparison Card (Actual GPS vs Present GPS) */}
                {attendanceDetails.gpsDetails && (
                  <div className="sc-modal-gps-card">
                    <div className="sc-modal-gps-header">
                      <span className="sc-modal-gps-title">📍 Location &amp; Telemetry</span>
                      {attendanceDetails.gpsDetails.distance && (
                        <span className="sc-modal-gps-badge-distance">
                          {attendanceDetails.gpsDetails.distance}
                        </span>
                      )}
                    </div>

                    <div className="sc-modal-gps-grid">
                      {/* Office Target */}
                      <div className="sc-modal-gps-col">
                        <span className="sc-modal-gps-label">🏢 Target Office</span>
                        <span className="sc-modal-gps-value-bold">
                          {attendanceDetails.gpsDetails.actualOfficeName || "Office Geofence"}
                        </span>
                        <span className="sc-modal-gps-coords">
                          {attendanceDetails.gpsDetails.actualGps || "HQ Geofence"}
                        </span>
                        {attendanceDetails.gpsDetails.allowedRadius && (
                          <span className="sc-modal-gps-subtag">
                            {attendanceDetails.gpsDetails.allowedRadius}
                          </span>
                        )}
                      </div>

                      {/* Device Present GPS */}
                      <div className="sc-modal-gps-col">
                        <span className="sc-modal-gps-label">📱 Present GPS</span>
                        <span className="sc-modal-gps-value-bold" style={{ color: attendanceDetails.gpsDetails.gpsMatched ? '#047857' : '#dc2626' }}>
                          Device Location
                        </span>
                        <span className="sc-modal-gps-coords">
                          {attendanceDetails.gpsDetails.presentGps || "Locating..."}
                        </span>
                        <span
                          className="sc-modal-gps-subtag"
                          style={{
                            color: attendanceDetails.gpsDetails.gpsMatched ? '#047857' : '#b91c1c',
                            background: attendanceDetails.gpsDetails.gpsMatched ? '#ecfdf5' : '#fee2e2',
                            borderColor: attendanceDetails.gpsDetails.gpsMatched ? '#a7f3d0' : '#fca5a5'
                          }}
                        >
                          {attendanceDetails.gpsDetails.gpsMatched ? 'Inside Geofence' : 'Outside Geofence'}
                        </span>
                      </div>
                    </div>

                    {/* Telemetry Status: GPS & Bluetooth */}
                    <div className="sc-modal-gps-telemetry-row">
                      <div className="sc-modal-gps-telem-item">
                        <span className="sc-modal-gps-telem-name">GPS Geofence:</span>
                        <span className={`sc-modal-gps-telem-status ${attendanceDetails.gpsDetails.gpsMatched ? 'status-pass' : 'status-fail'}`}>
                          {attendanceDetails.gpsDetails.gpsMatched ? '✅ IN RADIUS' : '❌ OUTSIDE RADIUS'}
                        </span>
                      </div>

                      {attendanceDetails.gpsDetails.bluetoothRequired && (
                        <div className="sc-modal-gps-telem-item">
                          <span className="sc-modal-gps-telem-name">Bluetooth:</span>
                          <span className={`sc-modal-gps-telem-status ${attendanceDetails.gpsDetails.bluetoothMatched ? 'status-pass' : 'status-fail'}`}>
                            {attendanceDetails.gpsDetails.bluetoothMatched ? '✅ DETECTED' : '❌ NOT FOUND'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Google Maps Distance Link */}
                    {attendanceDetails.gpsDetails.actualGps && attendanceDetails.gpsDetails.presentGps && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(attendanceDetails.gpsDetails.presentGps.replace(/\s+/g, ''))}&destination=${encodeURIComponent(attendanceDetails.gpsDetails.actualGps.replace(/\s+/g, ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sc-modal-gps-map-link"
                      >
                        <span>🗺️ View Distance on Google Maps</span>
                        <IonIcon icon={arrowBackOutline} style={{ transform: 'rotate(180deg)', fontSize: '13px' }} />
                      </a>
                    )}
                  </div>
                )}

                {/* Optional Late / Office Tag */}
                {((attendanceDetails.lateMinutes ?? 0) > 0 || attendanceDetails.officeName) && (
                  <div className="sc-modal-sub-details">
                    {(attendanceDetails.lateMinutes ?? 0) > 0 && (
                      <span className="sc-modal-sub-pill pill-late">
                        ⚠️ {attendanceDetails.graceType || 'Late Arrival'} ({attendanceDetails.lateMinutes}m)
                      </span>
                    )}
                    {attendanceDetails.officeName && (
                      <span className="sc-modal-sub-pill pill-office">
                        📍 {attendanceDetails.officeName}
                      </span>
                    )}
                  </div>
                )}

                {/* 6. Auto-Dismiss Progress Bar */}
                <div className="sc-modal-countdown-box">
                  <div className="sc-modal-countdown-label">
                    <span>Next scan starting in</span>
                    <span className="sc-modal-countdown-num">{countdownTimer}s</span>
                  </div>
                  <div className="sc-modal-progress-bar">
                    <div className="sc-modal-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>

                {/* 7. Primary Action Button */}
                <button
                  className="sc-modal-btn-action"
                  style={{
                    background: !attendanceDetails.isDuplicate
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : (attendanceDetails.customMessage?.includes('Location') || attendanceDetails.customMessage?.includes('Approval') || attendanceDetails.customMessage?.includes('Timing')
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)')
                  }}
                  onClick={resetScannerAndResume}
                >
                  <span>Scan Next Employee</span>
                  <IonIcon icon={arrowBackOutline} style={{ transform: 'rotate(180deg)', fontSize: '18px' }} />
                </button>
              </div>
            </div>,
            document.body
          )}

        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceScanner;
