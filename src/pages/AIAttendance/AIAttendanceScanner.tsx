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
  }, [cameraMode]);

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
    scheduleNextScan(150);
  };

  const handleSlotSelect = async (slot: string) => {
    setSelectedStatus(slot);
    selectedStatusRef.current = slot;
    setIsManualOverride(true);
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

            const actLat = data.actualLatitude;
            const actLng = data.actualLongitude;
            const presLat = data.presentLatitude || latitudeRef.current;
            const presLng = data.presentLongitude || longitudeRef.current;
            const offName = data.actualOfficeName || "Assigned Office";
            const distM = data.distanceMeters;
            const radM = data.allowedRadiusMeters || 100;

            const gpsDetails = (actLat && actLng) || (presLat && presLng) ? {
              actualOfficeName: offName,
              actualGps: actLat && actLng ? `${Number(actLat).toFixed(6)}, ${Number(actLng).toFixed(6)}` : undefined,
              presentGps: presLat && presLng ? `${Number(presLat).toFixed(6)}, ${Number(presLng).toFixed(6)}` : undefined,
              distance: distM ? `${Math.round(distM)}m away` : undefined,
              allowedRadius: `${radM}m radius`,
              bluetoothMatched: data.bluetoothMatched,
              bluetoothRequired: data.btRequired,
              gpsMatched: data.locationMatched,
              gpsRequired: data.gpsRequired
            } : undefined;

            setAttendanceDetails({
              empName,
              empId,
              status: "Location Restricted",
              isDuplicate: true,
              customMessage: alertMsg,
              confidence: data.confidence || 95,
              time: formatTime12H(data.time12 || data.time || new Date()),
              gpsDetails
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
            time: formatTime12H(data.time12 || data.time || new Date())
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
            time: formatTime12H(data.time12 || data.time || new Date())
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
            presenceMethod: data.presenceMethod || "Face Only"
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
            confidence: data.confidence || 98
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

          /* Premium Rules info Modal */
          .rules-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            backdrop-filter: blur(5px);
            padding: 16px;
          }
          .rules-modal-card {
            width: 100%;
            max-width: 480px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 28px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: animate__animated animate__zoomIn animate__fast;
          }
          .rules-modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #fafafb;
          }
          .rules-modal-title {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 850;
            color: #0f172a;
          }
          .rules-modal-body {
            padding: 24px;
            overflow-y: auto;
            max-height: 70vh;
            font-size: 0.82rem;
            color: #475569;
            line-height: 1.5;
          }
          .rule-section {
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid #f1f5f9;
          }
          .rule-section:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
          }
          .rule-sec-title {
            font-weight: 800;
            color: #1e293b;
            margin: 0 0 6px 0;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.88rem;
          }
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

        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>

          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <IonIcon icon={arrowBackOutline} style={{ color: "white" }} />
              </button>
              <div>
                <h1 className="page-wr-title">AI Face Attendance</h1>
                <p className="page-wr-subtitle">Biometric Check-In Portal</p>
              </div>
            </div>
            <div className="page-wr-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setShowRulesModal(true)}
                style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.4)', color: '#ffffff', padding: isMobile ? '8px' : '8px 14px', borderRadius: isMobile ? '50%' : '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', width: isMobile ? '36px' : 'auto', height: isMobile ? '36px' : 'auto' }}
              >
                <IonIcon icon={informationCircleOutline} style={{ fontSize: isMobile ? '20px' : '16px', margin: 0 }} />
                {!isMobile && "View Rules"}
              </button>
              {!isMobile && (
                <div className="page-wr-header-icon-box" onClick={() => history.push('/ai-attendance-log/user')} style={{ cursor: 'pointer' }}>
                  <IonIcon icon={calendarOutline} style={{ fontSize: '26px', color: 'var(--ion-color-primary)' }} />
                </div>
              )}
            </div>
          </div>

          {/* BODY */}
          <div className="sc-body" style={{ height: 'calc(100vh - 120px)' }}>

            {/* Target Attendance Slot on Mobile (Above Camera) */}
            {isMobile && !scanSuccess && (
              <div style={{ padding: '0 16px', marginBottom: '8px', zIndex: 10 }}>
                {renderSlotSelector()}
              </div>
            )}

            {/* LEFT: CAMERA WIDGET */}
            <div className="sc-cam-area">
              <div className="sc-cam-card clay">
                <video ref={videoRef} autoPlay playsInline muted className="sc-video" />

                <div className="sc-hud">
                  <div className="sc-cyber-ring-outer" />
                  <div className={`sc-ring ai-ring sc-cyber-ring-middle ${isProcessing ? 'ring-scan is-scanning' : scanSuccess ? 'ring-ok is-success' : ''}`} />
                  <div className="sc-cyber-ring-inner" />
                  <div className="sc-corners">
                    <span className="sc-cor tl" /><span className="sc-cor tr" />
                    <span className="sc-cor bl" /><span className="sc-cor br" />
                  </div>
                  <div className={`sc-laser ai-laser sc-cyber-laser ${isProcessing ? 'laser-on laser-active' : ''}`} />
                </div>

                <div className="sc-ind-row">
                  {/* GPS Indicator */}
                  <div
                    className={`sc-ind ${activeRule?.gpsRequired === false ? 'ind-ok' : locationReady ? 'ind-ok' : 'ind-wait'}`}
                    style={activeRule?.gpsRequired === false ? { background: 'rgba(148, 163, 184, 0.1)', color: '#64748b', borderColor: '#cbd5e1' } : {}}
                    title={activeRule?.gpsRequired === false ? "GPS Geofence is OFF for this profile" : "GPS Geofence Required"}
                  >
                    <IonIcon icon={pinOutline} />
                    <span>
                      {activeRule?.gpsRequired === false
                        ? 'GPS: OFF'
                        : locationReady
                          ? 'GPS Verified'
                          : 'GPS Fix… (Req)'}
                    </span>
                  </div>

                  {/* Bluetooth Beacon Indicator */}
                  <div
                    className={`sc-ind ${activeRule?.btRequired === false ? 'ind-ok' : bleVerified ? 'ind-ok' : 'ind-wait'}`}
                    style={
                      activeRule?.btRequired === false
                        ? { background: 'rgba(148, 163, 184, 0.1)', color: '#64748b', borderColor: '#cbd5e1' }
                        : !bleVerified && bleSignalStrength !== null && bleSignalStrength < -80
                          ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }
                          : {}
                    }
                    title={activeRule?.btRequired === false ? "Bluetooth Beacon is OFF for this profile" : "Bluetooth Beacon Required"}
                  >
                    <IonIcon icon={bluetoothOutline} />
                    <span>
                      {activeRule?.btRequired === false
                        ? 'BLE: OFF'
                        : bleVerified
                          ? 'Beacon OK'
                          : bleSignalStrength !== null && bleSignalStrength < -80
                            ? 'BLE Weak'
                            : 'Beacon… (Req)'}
                    </span>
                  </div>
                </div>

                {!isCameraReady && (
                  <div className="sc-cam-loader" style={{ background: '#f8fafc' }}>
                    <div className="tech-loader">
                      <div className="tech-ring-1" />
                      <div className="tech-ring-2" />
                      <div className="tech-ring-3" />
                      <div className="tech-center" />
                    </div>
                    <p style={{ color: '#6366f1', marginTop: '16px', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                      STARTING BIOMETRIC CAMERA…
                    </p>
                  </div>
                )}

                {capturedImg && (
                  <div className="sc-last-capture-preview" onClick={() => setCapturedImg(null)} title="Clear Preview">
                    <img src={capturedImg} alt="last scan preview" />
                  </div>
                )}

                {isCameraReady && (
                  <>
                    <button
                      className={`sc-cam-pause-btn ${isScannerPaused ? 'is-paused' : ''}`}
                      onClick={toggleScannerPause}
                      title={isScannerPaused ? "Start Scanner" : "Pause Scanner"}
                    >
                      <IonIcon icon={isScannerPaused ? playOutline : pauseOutline} />
                    </button>
                    <button className="sc-cam-flip-btn" onClick={toggleCameraMode} title="Flip Camera">
                      <IonIcon icon={cameraReverseOutline} />
                    </button>
                  </>
                )}

                {/* Debug Logs */}
                <div className="sc-debug-logs" style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  zIndex: 100,
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#475569',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  pointerEvents: 'none',
                  maxWidth: '75%',
                  lineHeight: '1.3',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}>
                  {debugLogs.length === 0 ? "[DEBUG] Idle" : debugLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: CONTROL PANEL */}
            <div
              className="sc-panel-area"
              style={
                isMobile
                  ? { transform: `translateY(${sheetY}px)`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }
                  : { height: '100%', overflowY: 'auto', paddingRight: '8px' }
              }
            >
              <div
                className="sc-drag-zone"
                onClick={toggleSheet}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className="sc-drag-handle" />
              </div>

              {scanSuccess && attendanceDetails ? (

                /* ── SUCCESS RESULT CARD ── */
                <div className="stock-panel animate__animated animate__fadeInUp animate__fast">
                  <div className="sc-res-top">
                    <div className={`sc-res-avatar ${attendanceDetails.isDuplicate ? 'av-warn' : 'av-ok'}`} style={{ overflow: 'hidden', padding: 0 }}>
                      {capturedImg ? (
                        <img src={capturedImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (attendanceDetails.empName || 'E').charAt(0)
                      )}
                    </div>
                    <div className="sc-res-info">
                      <div className="sc-res-name">{attendanceDetails.empName}</div>
                      <div className="sc-res-id">ID #{attendanceDetails.empId}</div>
                    </div>
                    <div className={`sc-res-badge ${attendanceDetails.isDuplicate ? 'badge-warn' : 'badge-ok'}`}>
                      {attendanceDetails.isDuplicate ? 'Already Marked' : 'Verified'}
                    </div>
                  </div>

                  {attendanceDetails.isDuplicate ? (
                    <div style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: '12px', padding: '14px', marginTop: '12px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e11d48', fontWeight: 800, fontSize: '0.88rem', marginBottom: '6px' }}>
                        <span>⚠️ ATTENDANCE ALREADY MARKED</span>
                      </div>
                      <div style={{ color: '#9f1239', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.4 }}>
                        {attendanceDetails.customMessage || `${attendanceDetails.status} is already logged for today at ${attendanceDetails.time}.`}
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#be123c', fontWeight: 700 }}>
                        <span style={{ background: '#ffe4e6', padding: '4px 10px', borderRadius: '6px' }}>Slot: {attendanceDetails.status}</span>
                        <span style={{ background: '#ffe4e6', padding: '4px 10px', borderRadius: '6px' }}>Time: {attendanceDetails.time}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Attendance Verification Details
                      </h3>

                      <div className="sc-res-chips">
                        <div className="sc-chip ok-chip" style={{ background: getSlotColorConfig(attendanceDetails.status).bg, borderColor: getSlotColorConfig(attendanceDetails.status).border }}>
                          <span className="chip-lbl" style={{ color: getSlotColorConfig(attendanceDetails.status).color }}>Shift Status</span>
                          <span className="chip-val" style={{ color: getSlotColorConfig(attendanceDetails.status).color, fontWeight: 800 }}>{getSlotColorConfig(attendanceDetails.status).label}</span>
                        </div>
                        <div className="sc-chip ok-chip">
                          <span className="chip-lbl">Time Registered</span>
                          <span className="chip-val">{attendanceDetails.time}</span>
                        </div>
                        <div className="sc-chip ok-chip">
                          <span className="chip-lbl">Face Match %</span>
                          <span className="chip-val">🎯 {attendanceDetails.confidence || 98}%</span>
                        </div>
                        <div className="sc-chip ok-chip">
                          <span className="chip-lbl">Identity Mode</span>
                          <span className="chip-val">
                            {attendanceDetails.presenceMethod === 'Bluetooth + GPS' ? '📶📍 BT + GPS' :
                              attendanceDetails.presenceMethod === 'Bluetooth' ? '📶 BLE' :
                                attendanceDetails.presenceMethod === 'GPS' ? '📍 GPS' :
                                  '🎭 Face Rec'}
                          </span>
                        </div>

                        {attendanceDetails.officeName && (
                          <div className="sc-chip ok-chip chip-full">
                            <span className="chip-lbl">Assigned Office Location</span>
                            <span className="chip-val">📍 {attendanceDetails.officeName}</span>
                          </div>
                        )}

                        {(attendanceDetails.lateMinutes ?? 0) > 0 && (
                          <div className="sc-chip warn-chip chip-full">
                            <span className="chip-lbl">Late warning status</span>
                            <span className="chip-val">
                              ⚠️ {attendanceDetails.graceType || attendanceDetails.attendanceStatus} — {attendanceDetails.lateMinutes}m late
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    className="stock-button stock-button--primary"
                    onClick={resetScannerAndResume}
                    style={{
                      width: '100%',
                      marginTop: '20px',
                    }}
                  >
                    Clear Result & Scan Again
                  </button>
                </div>

              ) : (

                /* ── IDLE CONTROL PANEL ── */
                <div className="stock-panel">

                  {/* Shift Timing Window Selector Card (Desktop only) */}
                  {!isMobile && renderSlotSelector()}

                  {/* Status indicator */}
                  <div className="sc-status-pill" style={{ background: cooldownCountdown > 0 ? '#f59e0b10' : `${statusColor}10`, color: cooldownCountdown > 0 ? '#f59e0b' : statusColor, borderColor: cooldownCountdown > 0 ? '#f59e0b25' : `${statusColor}25` }}>
                    <span className="sc-dot" style={{ background: cooldownCountdown > 0 ? '#f59e0b' : statusColor }} />
                    {cooldownCountdown > 0
                      ? `RESUMING IN ${cooldownCountdown}S...`
                      : isProcessing
                        ? 'ANALYZING FACE...'
                        : 'AWAITING BIOMETRICS'}
                  </div>
                  <div className="sc-msg" style={{ color: cooldownCountdown > 0 ? '#f59e0b' : statusColor }}>
                    {cooldownCountdown > 0
                      ? 'Please step away from the camera'
                      : resultMessage}
                  </div>

                  {/* 2. Monthly Grace & Rules Tracker Widget */}
                  {graceSummary && (
                    <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '12px' }}>
                      <h3
                        className="grace-tracker-title"
                        onClick={() => setShowGraceTrackerDetails(p => !p)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', margin: '14px 0 8px 0' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IonIcon icon={fingerPrintOutline} style={{ color: '#6366f1' }} />
                          <span>Monthly Grace Tracker</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 700, background: 'rgba(99, 102, 241, 0.08)', padding: '4px 8px', borderRadius: '8px' }}>
                          {showGraceTrackerDetails ? 'Collapse ▲' : 'Expand ▼'}
                        </span>
                      </h3>

                      {showGraceTrackerDetails && (
                        <div className="animate__animated animate__fadeIn animate__fast">
                          <div className="grace-summary-box">
                            <div className="circle-progress-container">
                              {/* SVG circular progress indicator */}
                              <svg width="74" height="74" viewBox="0 0 36 36">
                                <path
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke="#f1f5f9"
                                  strokeWidth="2.5"
                                />
                                <path
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke="#6366f1"
                                  strokeWidth="2.5"
                                  strokeDasharray={`${(graceSummary.gracesLeft / 4) * 100}, 100`}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="progress-label-val">
                                {graceSummary.gracesLeft}
                              </div>
                            </div>

                            <div className="grace-details-panel">
                              <div className="grace-stat-row">
                                <span>🟢 Free Graces</span>
                                <span className="val-high">{graceSummary.gracesLeft} / {graceSummary.freeGracesMax ?? 4} Left</span>
                              </div>
                              <div className="grace-stat-row">
                                <span>🟡 Permission Sessions</span>
                                <span className="val-high" style={{ color: '#d97706' }}>{graceSummary.permissionGraceUsed} / {graceSummary.permissionSessionsMax ?? 6} Used</span>
                              </div>
                              <div className="grace-stat-row">
                                <span>🔴 Total Late Occasions</span>
                                <span className="val-high" style={{ color: (graceSummary.totalLateOccasionsUsed ?? (graceSummary.freeGracesUsed + graceSummary.permissionGraceUsed)) >= 10 ? '#ef4444' : '#1e293b' }}>
                                  {graceSummary.totalLateOccasionsUsed ?? (graceSummary.freeGracesUsed + graceSummary.permissionGraceUsed)} / {graceSummary.totalLateOccasionsMax ?? 10}
                                </span>
                              </div>
                              <div className="grace-stat-row">
                                <span>P_Time Balance</span>
                                <span className="val-high">{graceSummary.permissionBalance} min</span>
                              </div>
                              <div className="grace-stat-row" style={{ alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  Remaining Balance
                                  <button
                                    onClick={() => setShowPermissionCalcModal(true)}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6366f1' }}
                                    title="Click to view calculation breakdown"
                                  >
                                    <IonIcon icon={helpCircleOutline} style={{ fontSize: '1.05rem', color: '#6366f1' }} />
                                  </button>
                                </span>
                                <span className="val-high">{graceSummary.permissionBalance} min</span>
                              </div>
                            </div>
                          </div>

                          {/* "Where it was Cut" history logs */}
                          <div className="grace-history-container">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                Grace Usage History ("Where it was Cut")
                              </span>
                              {graceSummary.history && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                                  Total Cut: {graceSummary.history.reduce((acc: number, r: any) => acc + (r.lateMinutes || 0) + (r.lunchLateMinutes || 0), 0)}m / P_Time: {graceSummary.pTime ?? 0}m
                                </span>
                              )}
                            </div>

                            {graceSummary.history && graceSummary.history.length > 0 && (() => {
                              const categorizeGraceRow = (row: any) => {
                                const gType = (row.graceType || '').toUpperCase();
                                const status = (row.attendanceStatus || '').toUpperCase();

                                if (gType === 'FREE_GRACE' || gType.includes('FREE') || gType.includes('GRACE') || status.includes('GRACE')) {
                                  return {
                                    category: 'GRACE',
                                    classType: 'type-free',
                                    labelType: 'Free Grace',
                                    statusText: row.attendanceStatus || 'Grace'
                                  };
                                }
                                if (gType === 'PERMISSION' || gType.includes('PERM') || status.includes('PERM') || status.includes('PERMISSION')) {
                                  return {
                                    category: 'PERMISSION',
                                    classType: 'type-perm',
                                    labelType: 'Permission Adjusted',
                                    statusText: row.attendanceStatus || 'Permission Adjusted'
                                  };
                                }
                                return {
                                  category: 'LOP',
                                  classType: 'type-lop',
                                  labelType: 'LOP Deducted',
                                  statusText: row.attendanceStatus || 'LOP'
                                };
                              };

                              const allHist = graceSummary.history;
                              const lopCount = allHist.filter((r: any) => categorizeGraceRow(r).category === 'LOP').length;
                              const graceCount = allHist.filter((r: any) => categorizeGraceRow(r).category === 'GRACE').length;
                              const permCount = allHist.filter((r: any) => categorizeGraceRow(r).category === 'PERMISSION').length;

                              const filteredList = allHist.filter((r: any) => {
                                if (graceHistoryFilter === 'ALL') return true;
                                return categorizeGraceRow(r).category === graceHistoryFilter;
                              });

                              return (
                                <>
                                  <div className="grace-filter-btn-group">
                                    <button
                                      className={`grace-filter-btn ${graceHistoryFilter === 'ALL' ? 'active' : ''}`}
                                      onClick={() => setGraceHistoryFilter('ALL')}
                                    >
                                      All ({allHist.length})
                                    </button>
                                    <button
                                      className={`grace-filter-btn lop-btn ${graceHistoryFilter === 'LOP' ? 'active' : ''}`}
                                      onClick={() => setGraceHistoryFilter('LOP')}
                                    >
                                      LOP ({lopCount})
                                    </button>
                                    <button
                                      className={`grace-filter-btn grace-btn ${graceHistoryFilter === 'GRACE' ? 'active' : ''}`}
                                      onClick={() => setGraceHistoryFilter('GRACE')}
                                    >
                                      Grace ({graceCount})
                                    </button>
                                    <button
                                      className={`grace-filter-btn perm-btn ${graceHistoryFilter === 'PERMISSION' ? 'active' : ''}`}
                                      onClick={() => setGraceHistoryFilter('PERMISSION')}
                                    >
                                      Permission Adjusted ({permCount})
                                    </button>
                                  </div>

                                  <div className="grace-history-list">
                                    {filteredList.length > 0 ? (
                                      filteredList.map((row: any, i: number) => {
                                        const catInfo = categorizeGraceRow(row);
                                        const lateParts = [];
                                        if ((row.lateMinutes || 0) > 0) lateParts.push(`${row.lateMinutes}m Morning`);
                                        if ((row.lunchLateMinutes || 0) > 0) lateParts.push(`${row.lunchLateMinutes}m Lunch`);
                                        const rowTotalMins = (row.lateMinutes || 0) + (row.lunchLateMinutes || 0);
                                        const lateTime = lateParts.length > 0
                                          ? `${rowTotalMins}m late (${lateParts.join(', ')})`
                                          : 'On Time';

                                        return (
                                          <div key={i} className="grace-history-row">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                              <span className="history-date" style={{ fontWeight: 800 }}>
                                                {row.date} <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.7rem' }}>({catInfo.statusText})</span>
                                              </span>
                                              <span style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 600 }}>
                                                {lateTime}
                                              </span>
                                            </div>
                                            <span className={`history-type ${catInfo.classType}`}>
                                              {catInfo.labelType}
                                            </span>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="grace-history-empty">No entries found for this category filter.</div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}

                            {(!graceSummary.history || graceSummary.history.length === 0) && (
                              <div className="grace-history-empty">No graces or permissions deducted this month.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Permission Calculation Breakdown Modal */}
                  {showPermissionCalcModal && (
                    <div className="rules-modal-overlay" onClick={() => setShowPermissionCalcModal(false)}>
                      <div className="rules-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', borderRadius: '18px', padding: '20px', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📊</span> Permission Balance Calculation
                          </h3>
                          <button onClick={() => setShowPermissionCalcModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IonIcon icon={closeOutline} style={{ fontSize: '18px', color: '#64748b' }} />
                          </button>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', marginBottom: '14px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: '#475569' }}>Base Monthly Permission (P_Time):</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{graceSummary?.pTime ?? 0} min</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: '#16a34a' }}>Approved Overtime Credits:</span>
                            <span style={{ fontWeight: 700, color: '#16a34a' }}>+ {graceSummary?.approvedOvertime ?? 0} min</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                            <span style={{ fontWeight: 700, color: '#334155' }}>Total Allowed Permission:</span>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{(graceSummary?.pTime ?? 0) + (graceSummary?.approvedOvertime ?? 0)} min</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#dc2626' }}>
                            <span>Total Used Permissions (Deductions):</span>
                            <span style={{ fontWeight: 700 }}>- {graceSummary?.usedPermission ?? 0} min</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #6366f1', paddingTop: '8px', marginTop: '4px' }}>
                            <span style={{ fontWeight: 800, color: '#4f46e5' }}>Remaining Permission Balance:</span>
                            <span style={{ fontWeight: 800, color: '#4f46e5', fontSize: '0.85rem' }}>{graceSummary?.permissionBalance ?? 0} min</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Formula & Equation
                        </div>
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 12px', borderRadius: '10px', fontSize: '0.74rem', color: '#1e40af', marginBottom: '16px', lineHeight: '1.5' }}>
                          <strong>Balance</strong> = (P_Time + Overtime) - Used Deductions<br />
                          <code style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1d4ed8' }}>
                            {graceSummary?.permissionBalance ?? 0}m = ({graceSummary?.pTime ?? 0}m + {graceSummary?.approvedOvertime ?? 0}m) - {graceSummary?.usedPermission ?? 0}m
                          </code>
                        </div>

                        <button onClick={() => setShowPermissionCalcModal(false)} style={{ width: '100%', padding: '10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. System Telemetry Checklist */}
                  {(!isMobile || sheetState === "expanded") && (
                    <div style={{ marginTop: '24px' }}>
                      <h3 className="checklist-header">
                        Telemetry Checklist
                      </h3>

                      <div className="checklist-widget">

                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📷</span>
                            <div style={{ textAlign: 'left' }} className="hide-web">
                              <div style={{ fontWeight: 700 }}>Live Video Stream</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {isCameraReady ? 'Connected (640x480)' : 'Awaiting stream...'}
                              </div>
                            </div>
                          </div>
                          <span className={`check-status-badge ${isCameraReady ? 'badge-verified' : 'badge-pending'}`}>
                            {isCameraReady ? 'OK' : 'OFFLINE'}
                          </span>
                        </div>

                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📍</span>
                            <div style={{ textAlign: 'left' }} className="hide-web">
                              <div style={{ fontWeight: 700 }}>Office Geofence</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {locationReady ? `${cityName || 'Locked'}` : 'Resolving GPS...'}
                              </div>
                            </div>
                          </div>
                          <span className={`check-status-badge ${locationReady ? 'badge-verified' : 'badge-pending'}`}>
                            {locationReady ? 'OK' : 'SYNCING'}
                          </span>
                        </div>

                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📶</span>
                            <div style={{ textAlign: 'left' }} className="hide-web">
                              <div style={{ fontWeight: 700 }}>EasyReach Beacon</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {bleVerified ? `${bleDeviceName}` : 'Scanning BLE...'}
                              </div>
                            </div>
                          </div>
                          <span className={`check-status-badge ${bleVerified ? 'badge-verified' : 'badge-pending'}`}
                            style={
                              !bleVerified && bleSignalStrength !== null && bleSignalStrength < -80
                                ? { backgroundColor: '#ef4444', color: '#ffffff' }
                                : {}
                            }
                          >
                            {bleVerified
                              ? 'OK'
                              : bleSignalStrength !== null && bleSignalStrength < -80
                                ? 'FAR'
                                : 'SCAN'}
                          </span>
                        </div>

                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>👤</span>
                            <div style={{ textAlign: 'left' }} className="hide-web">
                              <div style={{ fontWeight: 700 }}>Biometric Profile</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {userData ? 'Loaded' : 'Resolving login...'}
                              </div>
                            </div>
                          </div>
                          <span className={`check-status-badge ${userData ? 'badge-verified' : 'badge-pending'}`}>
                            {userData ? 'OK' : 'AWAIT'}
                          </span>
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>{/* sc-body */}

          {/* RULES INFO MODAL */}
          {showRulesModal && (
            <div className="rules-modal-overlay">
              <div className="rules-modal-card">
                <div className="rules-modal-header">
                  <h3 className="rules-modal-title">Attendance Policy & Rules</h3>
                  <button
                    onClick={() => setShowRulesModal(false)}
                    style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <IonIcon icon={closeOutline} />
                  </button>
                </div>
                <div className="rules-modal-body" style={{ textAlign: 'left', maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="rule-section">
                    <h4 className="rule-sec-title">🌅 1. Morning In Window &amp; Monthly Free Grace</h4>
                    <ul style={{ margin: '4px 0', paddingLeft: '18px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <li><strong>Dynamic In-Time:</strong> Reporting time is strictly read from your employee profile in <code>tbl_employee.InTime</code> (e.g. 09:00, 09:30, 10:00).</li>
                      <li><strong>{getPolVal('FreeGraceMonthlyCount', '4')} Free Graces:</strong> Allowed <strong>{getPolVal('FreeGraceMonthlyCount', '4')} Free Graces</strong> per calendar month for late arrival up to <strong>{getPolVal('FreeGraceMaxMinutes', '15')} minutes</strong> each.</li>
                      <li><strong>{getPolVal('MaxPermissionSessionsPerMonth', '6')} Permission Sessions:</strong> Subsequent late arrivals auto-deduct from your monthly allotted <code>P_Time</code> balance (up to <strong>{getPolVal('MaxPermissionSessionsPerMonth', '6')} permission sessions</strong>).</li>
                      <li><strong>{getPolVal('TotalAllowedLateOccasions', '10')} Total Occasion Cap:</strong> Maximum <strong>{getPolVal('TotalAllowedLateOccasions', '10')} late occasions</strong> allowed per month ({getPolVal('FreeGraceMonthlyCount', '4')} free graces + {getPolVal('MaxPermissionSessionsPerMonth', '6')} permissions). After {getPolVal('MaxPermissionSessionsPerMonth', '6')} sessions, permission adjustment is stopped even if P_Time balance remains.</li>
                      <li><strong>Beyond {getPolVal('TotalAllowedLateOccasions', '10')} Occasions Penalty:</strong> Exceeding {getPolVal('TotalAllowedLateOccasions', '10')} occasions OR having zero permission balance converts the total late time including the 60 min grace to <strong>Loss of Pay (LOP) + 1 Yellow Slip</strong>.</li>
                    </ul>
                  </div>

                  <div className="rule-section">
                    <h4 className="rule-sec-title">🍱 2. Lunch Break &amp; Afternoon Rules</h4>
                    <ul style={{ margin: '4px 0', paddingLeft: '18px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <li><strong>Official Window:</strong> Standard lunch break is from <strong>{getPolVal('StandardLunchStartTime', '13:30:00')} to {getPolVal('StandardLunchEndTime', '14:30:00')}</strong>.</li>
                      <li><strong>Auto {getPolVal('LunchBreakDurationMinutes', '60')}-Minute Duration:</strong> If you punch Lunch Out at 2:00 PM, 3:00 PM, 4:00 PM, etc., the system auto-calculates exactly <strong>{getPolVal('LunchBreakDurationMinutes', '60')} minutes break</strong> from your actual Lunch Out punch.</li>
                      <li><strong>No Afternoon Grace:</strong> Free grace applies ONLY to Morning In. Late arrival beyond {getPolVal('LunchBreakDurationMinutes', '60')} minutes auto-deducts from Permission balance or converts to Loss of Pay (LOP).</li>
                    </ul>
                  </div>

                  <div className="rule-section">
                    <h4 className="rule-sec-title">🌆 3. Evening Out &amp; Shift Defaults</h4>
                    <ul style={{ margin: '4px 0', paddingLeft: '18px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <li>Standard checkout time: <strong>{getPolVal('StandardEveningOutTime', '18:33:00')}</strong>. Register your punch before leaving.</li>
                    </ul>
                  </div>

                  <div className="rule-section">
                    <h4 className="rule-sec-title">⏱️ 4. Monthly Permission Quotas (P_Time)</h4>
                    <ul style={{ margin: '4px 0', paddingLeft: '18px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <li><strong>Technical Staff:</strong> {getPolVal('TechnicalDefaultPermissionMinutes', '60')} minutes / month.</li>
                      <li><strong>Non-Technical Staff:</strong> {getPolVal('NonTechnicalDefaultPermissionMinutes', '90')} minutes / month.</li>
                      <li><strong>Marketing Executives:</strong> {getPolVal('MarketingDefaultPermissionMinutes', '240')} minutes / month.</li>
                      <li><strong>Max Single Session:</strong> {getPolVal('MaxSinglePermissionMinutes', '60')} minutes per permission.</li>
                    </ul>
                  </div>

                  <div className="rule-section">
                    <h4 className="rule-sec-title">⚠️ 5. Excess Permission &amp; Double LOP Matrix</h4>
                    <ul style={{ margin: '4px 0', paddingLeft: '18px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <li><strong>Approved Excess (Up to {getPolVal('ApprovedExcessPermissionLimitMinutes', '180')} min):</strong> Allowed beyond allotted P_Time subject to available permission balance (procured via overtime or carryover).</li>
                      <li><strong>Excess Up to {getPolVal('SingleLopExcessPermissionLimitMinutes', '120')} min Without Balance:</strong> Attracts <strong>Single Loss of Pay (1x LOP)</strong>.</li>
                      <li><strong>Excess &gt; {getPolVal('DoubleLopThresholdMinutes', '120')} min Without Balance:</strong> Attracts <strong>Double Loss of Pay (Double LOP / 2x LOP)</strong> (allotted permission time is also included in total deduction).</li>
                      <li><strong>Carry Forward:</strong> Surplus permission time carries forward monthly and can be encashed yearly with management approval.</li>
                    </ul>
                  </div>

                  <div className="rule-section">
                    <h4 className="rule-sec-title">🟨 6. Yellow Slip Issuance Triggers</h4>
                    <ul style={{ margin: '4px 0', paddingLeft: '18px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <li><strong>+1 Yellow Slip:</strong> Issued automatically when exceeding {getPolVal('TotalAllowedLateOccasions', '10')} total late occasions in a month.</li>
                      <li><strong>+1 Yellow Slip:</strong> Issued for every <strong>{getPolVal('YellowSlipExcessPermissionInterval', '3')} excess permission sessions</strong> without available balance.</li>
                    </ul>
                  </div>
                </div>
                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafb', textAlign: 'right' }}>
                  <button
                    onClick={() => setShowRulesModal(false)}
                    style={{ padding: '8px 20px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
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
                          {attendanceDetails.gpsDetails.actualGps || "Lat/Lng"}
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
                        <span className="sc-modal-gps-value-bold" style={{ color: '#dc2626' }}>
                          Device Location
                        </span>
                        <span className="sc-modal-gps-coords">
                          {attendanceDetails.gpsDetails.presentGps || "Lat/Lng"}
                        </span>
                        <span className="sc-modal-gps-subtag" style={{ color: '#b91c1c', background: '#fee2e2', borderColor: '#fca5a5' }}>
                          Outside Geofence
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
