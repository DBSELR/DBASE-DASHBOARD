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
import { useHistory } from "react-router";
import { API_BASE } from "../../config";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { BleClient, ScanResult } from "@capacitor-community/bluetooth-le";
import axios from "axios";
import "./AIAttendanceScanner.css";

const speakText = (text: string) => {
  if (typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
    try {
      const SpeechUtterance = (window as any).SpeechSynthesisUtterance;
      const utterance = new SpeechUtterance(text);
      utterance.rate = 1;
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
    gracesLeft: number;
    permissionGraceUsed: number;
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

  const logDebug = (msg: string) => {
    console.log(`[DEBUG] ${msg}`);
    setDebugLogs(prev => [msg, ...prev.slice(0, 4)]);
  };

  const [attendanceDetails, setAttendanceDetails] = useState<{
    empName?: string; empId?: string; status?: string; time?: string; officeName?: string;
    isDuplicate?: boolean; customMessage?: string;
    presenceMethod?: string; graceType?: string;
    lateMinutes?: number; date?: string; attendanceStatus?: string; confidence?: number;
  } | null>(null);

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
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (response.data && response.data.address) {
            const addr = response.data.address;
            const cityOrTown = addr.city || addr.town || addr.village || addr.suburb || addr.city_district || addr.municipality || addr.county || addr.state || "";
            if (cityOrTown) {
              setCityName(cityOrTown);
              logDebug(`City geocoded: ${cityOrTown}`);
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

  const resetScannerAndResume = () => {
    setScanSuccess(false);
    scanSuccessRef.current = false;
    setCapturedImg(null);
    setAttendanceDetails(null);
    setResultMessage("Align your face in the frame");
    setStatusColor("#6366f1");
    setCooldownCountdown(0);
    scheduleNextScan(1000);
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
    if (!isCameraReadyRef.current || !videoRef.current) { scheduleNextScan(1000); return; }
    if (latitudeRef.current === 0 && longitudeRef.current === 0) {
      setResultMessage("Getting GPS fix…"); setStatusColor("#f59e0b");
      scheduleNextScan(2000); return;
    }
    setIsProcessing(true); isProcessingRef.current = true;
    setResultMessage("Scanning face..."); setStatusColor("#3b82f6");
    try {
      const canvas = document.createElement("canvas");
      const maxDim = 360;
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;
      let targetWidth = videoWidth;
      let targetHeight = videoHeight;
      if (videoWidth > maxDim || videoHeight > maxDim) {
        if (videoWidth > videoHeight) {
          targetWidth = maxDim;
          targetHeight = Math.round((videoHeight / videoWidth) * maxDim);
        } else {
          targetHeight = maxDim;
          targetWidth = Math.round((videoWidth / videoHeight) * maxDim);
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (context && videoRef.current) {
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        context.restore();

        const imageData = canvas.toDataURL("image/jpeg", 0.8);
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
          if (isGpsNotReady) { setResultMessage("Getting GPS fix…"); setStatusColor("#f59e0b"); scheduleNextScan(2000); }
          else { setResultMessage(`⛔ ${data.message || "Outside Office Location"}`); setStatusColor("#ef4444"); speakText(data.message || "You are not in office location"); scheduleNextScan(4000); }
          return;
        }
        if (data.invalidTime) { setResultMessage(`⛔ ${data.message}`); setStatusColor("#ef4444"); speakText(data.message); scheduleNextScan(4000); return; }

        if (data.hasPermission === false || (data.success === false && data.message && data.message.includes("No Approved Permission"))) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId = data.empId || userDataRef.current?.empCode || "";
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#f59e0b");

          setAttendanceDetails({
            empName, empId,
            status: "No Approved Permission Found",
            isDuplicate: true,
            customMessage: data.message || "No Approved Permission Found for Today. Please submit a permission request in Leave/Permission Form and obtain manager approval before scanning Perm Out.",
            confidence: data.confidence,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          setResultMessage(`⚠️ ${empName}`); speakText(`No approved permission found for today for ${empName}`);

          setTimeout(() => {
            resetScannerAndResume();
          }, 4000);
          return;
        }

        if (data.alreadyMarked) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId = data.empId || userDataRef.current?.empCode || "";
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#f59e0b");

          let displayTime = data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (data.time && data.time.includes(":")) {
            try {
              const parts = data.time.split(":");
              const hr = parseInt(parts[0], 10);
              const min = parts[1];
              const sec = parts[2] ? `:${parts[2]}` : "";
              const ampm = hr >= 12 ? "PM" : "AM";
              const displayHr = hr % 12 || 12;
              displayTime = `${displayHr.toString().padStart(2, '0')}:${min}${sec} ${ampm}`;
            } catch { }
          }

          const slotName = data.status || "Morning In";
          const alertMsg = data.message || `${slotName} already marked at ${displayTime}`;

          setAttendanceDetails({
            empName, empId,
            status: `${slotName} Already Marked`,
            isDuplicate: true,
            customMessage: alertMsg,
            confidence: data.confidence,
            time: displayTime
          });
          setResultMessage(`⚠️ ${empName}`); speakText(`${empName} ${slotName} already marked`);

          // Auto-resume scanner after 1.5 seconds
          setTimeout(() => {
            resetScannerAndResume();
          }, 1500);
          return;
        }

        if (data.success) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId = data.empId || userDataRef.current?.empCode || "";
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#10b981");
          const slotName = data.status || selectedStatusRef.current || "Morning In";
          setAttendanceDetails({
            empName, empId,
            status: `${slotName} Marked Successfully`,
            time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            officeName: data.officeName || "",
            presenceMethod: data.presenceMethod || "Face Only",
            graceType: data.graceType || "",
            lateMinutes: data.lateMinutes ?? 0,
            date: data.date || new Date().toLocaleDateString('en-GB'),
            attendanceStatus: data.attendanceStatus || "",
            confidence: data.confidence
          });
          setResultMessage(`✅ Welcome, ${empName}`);
          speakText(`${empName} attendance marked successfully`);

          // Re-fetch monthly grace totals to update counters instantly
          if (empId) {
            fetchGraceSummary(empId);
          }

          // Auto-resume scanner after 1.5 seconds
          setTimeout(() => {
            resetScannerAndResume();
          }, 1500);
        } else {
          setAttendanceDetails(null);
          setResultMessage("Align face to scan");
          setStatusColor("#8b5cf6");
          scheduleNextScan(600);
        }
      } else { scheduleNextScan(1000); }
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

          const matched = allowedBeaconsRef.current.length > 0
            ? allowedBeaconsRef.current.some(b => {
              const dbName = b.name.trim().toUpperCase();
              const dbMac = b.mac.replace(/[:-]/g, "").trim().toUpperCase();
              return name === dbName && (mac === dbMac || isUuid);
            })
            : (name === "ER2650001F" && (mac === "EA2658F0001F" || isUuid));

          if (matched) {
            setBleSignalStrength(rssi);
            const isCloseEnough = rssi >= -140;

            if (isCloseEnough) {
              found = true; setBleVerified(true); bleVerifiedRef.current = true;
              setBleDeviceName(name); setBleDeviceId(result.device.deviceId);
              logDebug(`Beacon verified: ${name} (${rssi} dBm)`);
              await BleClient.stopLEScan();
            } else {
              logDebug(`Beacon found but too far: ${name} (${rssi} dBm)`);
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
                style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.4)', color: '#ffffff', padding: '8px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
              >
                <IonIcon icon={informationCircleOutline} style={{ fontSize: '16px' }} />
                View Rules
              </button>
              <div className="page-wr-header-icon-box" onClick={() => history.push('/ai-attendance-log/user')} style={{ cursor: 'pointer' }}>
                <IonIcon icon={calendarOutline} style={{ fontSize: '26px', color: 'var(--ion-color-primary)' }} />
              </div>
            </div>
          </div>

          {/* BODY */}
          <div className="sc-body" style={{ height: 'calc(100vh - 120px)' }}>

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
                  <div className={`sc-ind ${locationReady ? 'ind-ok' : 'ind-wait'}`}>
                    <IonIcon icon={pinOutline} />
                    <span>{locationReady ? 'GPS Verified' : 'GPS Fix…'}</span>
                  </div>
                  <div
                    className={`sc-ind ${bleVerified ? 'ind-ok' : 'ind-wait'}`}
                    style={
                      !bleVerified && bleSignalStrength !== null && bleSignalStrength < -80
                        ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }
                        : {}
                    }
                  >
                    <IonIcon icon={bluetoothOutline} />
                    <span>{bleVerified
                      ? 'Beacon OK'
                      : bleSignalStrength !== null && bleSignalStrength < -80
                        ? 'BLE Weak'
                        : 'Beacon…'}</span>
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
                  : {}
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

                  {/* Shift Timing Window Selector Card */}
                  <div className="status-override-container" style={{ marginBottom: '18px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
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
                                <span>Morning Graces Left</span>
                                <span className="val-high">{graceSummary.gracesLeft} / 4</span>
                              </div>
                              <div className="grace-stat-row">
                                <span>Morning Graces Used</span>
                                <span className="val-high" style={{ color: '#ef4444' }}>{graceSummary.freeGracesUsed} Used</span>
                              </div>
                              <div className="grace-stat-row">
                                <span>P_Time (Base Permission)</span>
                                <span className="val-high">{graceSummary.pTime ?? 0} min</span>
                              </div>
                              <div className="grace-stat-row">
                                <span>Approved Overtime Credits</span>
                                <span className="val-high" style={{ color: '#16a34a' }}>+ {graceSummary.approvedOvertime ?? 0} min</span>
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
                <div className="rules-modal-body">
                  <div className="rule-section">
                    <h4 className="rule-sec-title">🌅 Morning In Window</h4>
                    <p style={{ margin: '4px 0' }}>
                      Standard check-in slot starts at <strong>7:00 AM</strong>.
                    </p>
                    <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                      <li>Each employee is allowed <strong>4 Morning Graces</strong> per month (arriving up to 10:30 AM).</li>
                      <li>If graces are exhausted, late minutes are deducted from your monthly <strong>Permission Balance</strong>.</li>
                      <li>Check-ins after <strong>10:35 AM</strong> bypass all graces/permissions and are automatically marked as <strong>LOP</strong>.</li>
                    </ul>
                  </div>

                  <div className="rule-section">
                    <h4 className="rule-sec-title">🍱 Lunch Out & Lunch In (1-Hour Rule)</h4>
                    <p style={{ margin: '4px 0' }}>
                      Lunch break is highly flexible. The system dynamically computes your personal check-in window:
                    </p>
                    <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                      <li>Your Lunch In cutoff is set to exactly <strong>1 hour from your actual Lunch Out</strong> registration.</li>
                      <li>For example: If you log Lunch Out at <strong>1:45 PM</strong>, you have until <strong>2:45 PM</strong> to log Lunch In without any late penalties.</li>
                      <li>If you do not register a Lunch Out today, the Lunch In window defaults to <strong>2:30 PM</strong>.</li>
                    </ul>
                  </div>

                  <div className="rule-section">
                    <h4 className="rule-sec-title">🌇 Evening Out Window</h4>
                    <p style={{ margin: '4px 0' }}>
                      End of shift checkout. Register your logout before leaving.
                    </p>
                  </div>
                </div>
                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafb', textAlign: 'right' }}>
                  <button
                    onClick={() => setShowRulesModal(false)}
                    style={{ padding: '8px 18px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Got It
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS POPUP OVERLAY */}
          {scanSuccess && attendanceDetails && (
            <div className="sc-success-popup-overlay">
              <div className="sc-success-popup-card animate__animated animate__zoomIn">
                <div className={`sc-success-popup-icon ${attendanceDetails.isDuplicate ? 'icon-warn' : 'icon-ok'}`} style={{ overflow: 'hidden', padding: 0 }}>
                  {capturedImg ? (
                    <img src={capturedImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    attendanceDetails.isDuplicate ? '⚠️' : '✓'
                  )}
                </div>
                <h2 className="sc-success-popup-title" style={{ color: attendanceDetails.isDuplicate ? '#d97706' : '#059669' }}>
                  {attendanceDetails.isDuplicate ? '⚠️ Already Marked' : '✅ Verified'}
                </h2>
                <div className="sc-success-popup-name">
                  {attendanceDetails.empName}
                </div>
                <div className="sc-success-popup-id">
                  ID #{attendanceDetails.empId}
                </div>
                <div className="sc-success-popup-time" style={{ fontWeight: 850, color: attendanceDetails.isDuplicate ? '#d97706' : '#059669', fontSize: '0.95rem' }}>
                  {attendanceDetails.status || 'Attendance Logged'}
                </div>
                <div className="sc-success-popup-time" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Time: {attendanceDetails.time}
                </div>
                <div className="sc-success-popup-time" style={{ color: '#4f46e5', fontWeight: 800 }}>
                  Face Match: {attendanceDetails.confidence || 98}%
                </div>
                {attendanceDetails.customMessage && (
                  <div className="sc-success-popup-msg" style={{ background: attendanceDetails.isDuplicate ? '#fffbeb' : '#f0fdf4', color: attendanceDetails.isDuplicate ? '#b45309' : '#15803d', border: `1px solid ${attendanceDetails.isDuplicate ? '#fde68a' : '#bbf7d0'}` }}>
                    {attendanceDetails.customMessage}
                  </div>
                )}
                <button className="sc-success-popup-btn" style={{ background: attendanceDetails.isDuplicate ? '#f59e0b' : '#10b981' }} onClick={resetScannerAndResume}>
                  Close
                </button>
              </div>
            </div>
          )}

        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceScanner;
