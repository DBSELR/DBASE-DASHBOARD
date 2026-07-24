import { IonContent, IonPage, IonIcon, IonSpinner } from "@ionic/react";
import { 
  arrowBackOutline, 
  cameraReverseOutline, 
  pinOutline, 
  bluetoothOutline, 
  calendarOutline,
  informationCircleOutline,
  closeOutline,
  playOutline,
  pauseOutline
} from "ionicons/icons";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useHistory } from "react-router";
import { API_BASE } from "../../config";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { BleClient, ScanResult } from "@capacitor-community/bluetooth-le";
import "./SecurityAttendanceScanner.css";

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
    default:
      return { label: slot || 'Attendance', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' };
  }
};

const SecurityAttendanceScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const history = useHistory();

  const [processing,   setProcessing]   = useState(false);
  const [cameraReady,  setCameraReady]  = useState(false);
  const [scanSuccess,  setScanSuccess]  = useState(false);
  const [cameraMode,   setCameraMode]   = useState<"user" | "environment">("user");
  const [latitude,     setLatitude]     = useState<number>(0);
  const [longitude,    setLongitude]    = useState<number>(0);
  const [locationReady,setLocationReady]= useState(false);
  const [bleVerified,  setBleVerified]  = useState(false);
  const [bleDeviceId,  setBleDeviceId]  = useState("");
  const [bleDeviceName,setBleDeviceName]= useState("");
  const [isBleScanning,setIsBleScanning]= useState(false);
  const [bleSignalStrength, setBleSignalStrength] = useState<number | null>(null);
  const [allowedBeacons, setAllowedBeacons] = useState<{name: string, mac: string}[]>([]);
  const [message,      setMessage]      = useState("Initializing camera...");
  const [statusColor,  setStatusColor]  = useState("#8b5cf6");
  const [matchCount,   setMatchCount]   = useState(0);
  const [verifyingName,setVerifyingName]= useState("");

  const [userData,     setUserData]     = useState<any>(null);
  const [userProfile,  setUserProfile]  = useState<any>(null);
  const [isMobile,     setIsMobile]     = useState(window.innerWidth <= 768);
  const [capturedImg,  setCapturedImg]  = useState<string | null>(null);
  const [debugLogs,     setDebugLogs]     = useState<string[]>([]);
  
  // Status Selector
  const [selectedStatus, setSelectedStatus] = useState<string>(getAutoStatus());
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  
  // Rules popup
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isScannerPaused, setIsScannerPaused] = useState<boolean>(false);
  const isScannerPausedRef = useRef<boolean>(false);

  // Cooldown countdown state
  const [cooldownCountdown, setCooldownCountdown] = useState<number>(0);
  const cooldownCountdownRef = useRef(0);

  useEffect(() => {
    cooldownCountdownRef.current = cooldownCountdown;
  }, [cooldownCountdown]);

  useEffect(() => { isScannerPausedRef.current = isScannerPaused; }, [isScannerPaused]);

  const toggleScannerPause = () => {
    const nextState = !isScannerPaused;
    setIsScannerPaused(nextState);
    isScannerPausedRef.current = nextState;
    if (nextState) {
      setMessage("⏸️ Scanner Paused");
      setStatusColor("#f59e0b");
    } else {
      setMessage("Awaiting scan...");
      setStatusColor("#8b5cf6");
    }
  };

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectedFacesRef = useRef<any[]>([]);

  const drawMultiFaceOverlays = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = video.clientWidth || 640;
    const height = video.clientHeight || 480;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const faces = detectedFacesRef.current;
    if (!faces || faces.length === 0) return;

    const timeNow = Date.now();
    const rotationAngle = (timeNow / 16) % (2 * Math.PI);

    faces.forEach((face: any, index: number) => {
      const box = face.box || face.location || (face.top ? face : null);
      if (!box) return;

      const imgW = box.imgW || box.imageWidth || 640;
      const imgH = box.imgH || box.imageHeight || 480;

      const scaleX = width / imgW;
      const scaleY = height / imgH;

      const rawLeft = box.left ?? 0;
      const rawRight = box.right ?? (rawLeft + 100);
      const rawTop = box.top ?? 0;
      const rawBottom = box.bottom ?? (rawTop + 100);

      const left = width - (rawRight * scaleX);
      const right = width - (rawLeft * scaleX);
      const top = rawTop * scaleY;
      const bottom = rawBottom * scaleY;

      const faceW = right - left;
      const faceH = bottom - top;
      const centerX = left + faceW / 2;
      const centerY = top + faceH / 2;
      const radius = Math.max(faceW, faceH) / 2 + 18;

      const isRecognized = face.isRecognized !== false;
      const isDup = face.alreadyMarked;
      const color = isRecognized ? (isDup ? '#f59e0b' : '#10b981') : '#ef4444';
      const name = face.empName || face.empId || 'Unknown Person';

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngle * (index % 2 === 0 ? 1 : -1));

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 8]);
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.stroke();

      ctx.rotate(-rotationAngle * 2);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(10, radius - 8), 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      ctx.restore();

      const bLen = 14;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      ctx.beginPath(); ctx.moveTo(left, top + bLen); ctx.lineTo(left, top); ctx.lineTo(left + bLen, top); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(right - bLen, top); ctx.lineTo(right, top); ctx.lineTo(right, top + bLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(left, bottom - bLen); ctx.lineTo(left, bottom); ctx.lineTo(left + bLen, bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(right - bLen, bottom); ctx.lineTo(right, bottom); ctx.lineTo(right, bottom - bLen); ctx.stroke();

      const badgeText = `${isRecognized ? (isDup ? '⚠️ ' : '✅ ') : '❓ '}${name}`;
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      const textW = ctx.measureText(badgeText).width;
      const bW = textW + 26;
      const bH = 26;
      const bX = centerX - bW / 2;
      const bY = top - 38;

      ctx.save();
      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(bX, bY, bW, bH, 13);
      } else {
        ctx.rect(bX, bY, bW, bH);
      }
      ctx.fillStyle = isRecognized ? (isDup ? 'rgba(245, 158, 11, 0.95)' : 'rgba(16, 185, 129, 0.95)') : 'rgba(239, 68, 68, 0.9)';
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText(badgeText, centerX, bY + bH / 2);
      ctx.restore();
    });
  }, []);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      drawMultiFaceOverlays();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [drawMultiFaceOverlays]);

  useEffect(() => {
    if (cooldownCountdown > 0) {
      const timer = setTimeout(() => {
        setCooldownCountdown((prev: number) => {
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

  const logDebug = (msg: string) => {
    console.log(`[DEBUG] ${msg}`);
    setDebugLogs(prev => [msg, ...prev.slice(0, 4)]);
  };

  const [scannedEmployee, setScannedEmployee] = useState<{
    empName?: string; empId?: string; status?: string; time?: string;
    isDuplicate?: boolean; customMessage?: string; confidence?: number;
  } | null>(null);

  const latitudeRef     = useRef(0);
  const longitudeRef    = useRef(0);
  const locationReadyRef= useRef(false);
  const bleVerifiedRef  = useRef(false);
  const bleDeviceNameRef= useRef("");
  const bleDeviceIdRef  = useRef("");
  const allowedBeaconsRef = useRef<{name: string, mac: string}[]>([]);
  const cameraReadyRef  = useRef(false);
  const scanSuccessRef  = useRef(false);
  const processingRef   = useRef(false);
  const loopTimeoutRef  = useRef<any>(null);
  const bleTimeoutRef   = useRef<any>(null);
  const matchCountRef   = useRef(0);
  const lastMatchedEmpIdRef = useRef("");
  const verifyingNameRef = useRef("");
  
  const selectedStatusRef = useRef(getAutoStatus());

  useEffect(() => { latitudeRef.current      = latitude;      }, [latitude]);
  useEffect(() => { longitudeRef.current     = longitude;     }, [longitude]);
  useEffect(() => { locationReadyRef.current = locationReady; }, [locationReady]);
  useEffect(() => { bleVerifiedRef.current   = bleVerified;   }, [bleVerified]);
  useEffect(() => { bleDeviceNameRef.current = bleDeviceName; }, [bleDeviceName]);
  useEffect(() => { bleDeviceIdRef.current   = bleDeviceId;   }, [bleDeviceId]);
  useEffect(() => { allowedBeaconsRef.current = allowedBeacons; }, [allowedBeacons]);
  useEffect(() => { cameraReadyRef.current   = cameraReady;   }, [cameraReady]);
  useEffect(() => { scanSuccessRef.current   = scanSuccess;   }, [scanSuccess]);
  useEffect(() => { processingRef.current    = processing;    }, [processing]);
  useEffect(() => { matchCountRef.current    = matchCount;    }, [matchCount]);
  useEffect(() => { verifyingNameRef.current = verifyingName; }, [verifyingName]);
  
  useEffect(() => {
    selectedStatusRef.current = selectedStatus;
  }, [selectedStatus]);

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

  // ── Load User Profile ──────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserData(parsed);
        setUserProfile(parsed);
      } catch (err) {
        console.error("Error loading user profile in security scanner", err);
      }
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync timing slot automatically if not overridden by the officer
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

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: any = null;
    const startCamera = async () => {
      try {
        setCameraReady(false);
        logDebug("Starting camera...");
        if (Capacitor.isNativePlatform()) {
          try {
            const perm = await Camera.requestPermissions({ permissions: ["camera"] });
            logDebug("Camera perm: " + perm.camera);
            if (perm.camera !== "granted") {
              setMessage("Camera permission denied");
              setStatusColor("#ef4444");
              return;
            }
          } catch (err: any) {
            logDebug("Native perm err: " + err.message);
          }
        }
        if (!navigator.mediaDevices?.getUserMedia) { setMessage("Camera not supported"); setStatusColor("#ef4444"); return; }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cameraMode }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
              setCameraReady(true);
              const w = videoRef.current?.videoWidth || 0;
              const h = videoRef.current?.videoHeight || 0;
              logDebug(`Camera active: ${w}x${h}`);
              setMessage("Align face to scan");
              setStatusColor("#8b5cf6");
            }
            catch { setMessage("Video play failed"); setStatusColor("#ef4444"); }
          };
        }
      } catch { setMessage("Unable to access camera"); setStatusColor("#ef4444"); }
    };
    startCamera();
    return () => { if (stream) stream.getTracks().forEach((x: any) => x.stop()); };
  }, [cameraMode]);

  // ── BLE ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const initBLE = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        await BleClient.initialize();
        const enabled = await BleClient.isEnabled();
        logDebug("Bluetooth enabled: " + enabled);
        try { await BleClient.requestLEScan({ allowDuplicates: false }, () => {}); await BleClient.stopLEScan(); } catch (err: any) { logDebug("BLE Perm Request Err: " + err.message); }
        await verifyEasyReach();
      } catch (e: any) {
        logDebug("BLE Init Error: " + e.message);
      }
    };
    initBLE();
    return () => { if (bleTimeoutRef.current) clearTimeout(bleTimeoutRef.current); };
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let watchId: any = null;
    let isMounted = true;
    const startLocationWatch = async () => {
      const isSecure = window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const isNative = Capacitor.isNativePlatform();

      if (!isNative && !isSecure) {
        console.warn("Geolocation requires HTTPS secure context on mobile browsers.");
        setMessage("⚠️ HTTPS Required for GPS");
        setStatusColor("#ef4444");
      }

      if (isNative) {
        try {
          const perm = await Geolocation.requestPermissions();
          if (perm.location !== "granted") return;
        } catch {}
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
          () => {},
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
          () => {},
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

  // ── Scan loop ─────────────────────────────────────────────────────────────
  const scheduleNextScan = (delay: number, resetScanState = false) => {
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    loopTimeoutRef.current = setTimeout(() => {
      if (resetScanState) {
        setScanSuccess(false); scanSuccessRef.current = false;
        setScannedEmployee(null); setMessage("Align face to scan"); setStatusColor("#8b5cf6");
        setCapturedImg(null);
        setBleSignalStrength(null);
      }
      autoScan();
    }, delay);
  };

  const resetScannerAndResume = () => {
    setScanSuccess(false);
    scanSuccessRef.current = false;
    setCapturedImg(null);
    setScannedEmployee(null);
    setMessage("Align face to scan");
    setStatusColor("#8b5cf6");
    setMatchCount(0);
    setCooldownCountdown(0);
    scheduleNextScan(1000);
  };

  const autoScan = async () => {
    if (isScannerPausedRef.current) { scheduleNextScan(1000); return; }
    if (processingRef.current || scanSuccessRef.current || cooldownCountdownRef.current > 0) return;
    if (!cameraReadyRef.current || !videoRef.current) { scheduleNextScan(1000); return; }
    if (latitudeRef.current === 0 && longitudeRef.current === 0) {
      setMessage("Getting GPS fix…"); setStatusColor("#f59e0b");
      scheduleNextScan(2000); return;
    }
    setProcessing(true); processingRef.current = true;
    setMessage("Analyzing face..."); setStatusColor("#3b82f6");
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

      const ctx = canvas.getContext("2d");
      if (!ctx || !videoRef.current) {
        scheduleNextScan(1000);
        return;
      }

      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const image = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImg(image);
      
      logDebug(`API POST: AISecurityAttendance Slot: ${selectedStatusRef.current}`);

      const isLastFrame = matchCountRef.current === 2;
      const response = await fetch(`${API_BASE}Checkin/AISecurityAttendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "dbase-ai-master-key-2026" },
        body: JSON.stringify({
          image,
          latitude: latitudeRef.current,
          longitude: longitudeRef.current,
          bluetoothConnected: bleVerifiedRef.current,
          bluetoothDeviceName: bleDeviceNameRef.current,
          bluetoothDeviceId: bleDeviceIdRef.current,
          saveNeeded: isLastFrame,
          status: selectedStatusRef.current
        })
      });
      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const eb = await response.json();
          errMsg = eb.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      logDebug(`API Res: success=${data.success}, msg=${data.message || ""}`);
      if (data.detectedFaces || data.matchedEmployees) {
        detectedFacesRef.current = data.detectedFaces || data.matchedEmployees || [];
      }
      
      if (data.matchedEmployees && Array.isArray(data.matchedEmployees) && data.matchedEmployees.length > 0) {
        const validSaved = data.matchedEmployees.filter((e: any) => e.alreadyMarked !== true && e.invalidLocation !== true && e.invalidTime !== true);
        const allNames = data.matchedEmployees.map((e: any) => e.empName || e.empId).join(", ");
        const savedNames = validSaved.map((e: any) => e.empName || e.empId).join(", ");

        setMatchCount(3);
        setScanSuccess(true); scanSuccessRef.current = true;

        if (validSaved.length > 0) {
          setStatusColor("#10b981");
          setScannedEmployee({
            empName: savedNames,
            empId: validSaved.map((e: any) => e.empId).join(", "),
            status: validSaved[0]?.status || "Attendance Logged",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isDuplicate: false,
            confidence: validSaved[0]?.confidence || 95
          });
          setMessage(`✅ Verified (${validSaved.length}): ${savedNames}`);
          speakText(`Attendance marked for ${savedNames}`);
        } else {
          setStatusColor("#f59e0b");
          setScannedEmployee({
            empName: allNames,
            empId: data.matchedEmployees.map((e: any) => e.empId).join(", "),
            status: "Already Marked Today",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isDuplicate: true,
            confidence: data.matchedEmployees[0]?.confidence || 90
          });
          setMessage(`⚠️ Cooldown: ${allNames}`);
          speakText(`${allNames} attendance already marked today`);
        }

        setVerifyingName(""); lastMatchedEmpIdRef.current = "";
        setTimeout(() => {
          resetScannerAndResume();
        }, 4000);
        return;
      }

      if (data.invalidLocation) {
        setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
        setStatusColor("#ef4444"); setMessage(`⛔ ${data.message || "Outside Office Location"}`);
        speakText(data.message || "You are not in office location");
        scheduleNextScan(4000);
        return;
      }
      if (data.invalidTime) {
        setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
        setStatusColor("#ef4444"); setMessage(`⛔ ${data.message}`);
        speakText(data.message);
        scheduleNextScan(4000);
        return;
      }
      if (data.alreadyMarked) {
        setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
        setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#f59e0b");

        let displayTime = data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (data.time && data.time.includes(":")) {
          try {
            const parts = data.time.split(":");
            const hr = parseInt(parts[0], 10);
            const min = parts[1];
            const ampm = hr >= 12 ? "PM" : "AM";
            const displayHr = hr % 12 || 12;
            displayTime = `${displayHr.toString().padStart(2, '0')}:${min} ${ampm}`;
          } catch {}
        }

        setScannedEmployee({ 
          empName: data.empName || "Employee", 
          empId: data.empId || "", 
          isDuplicate: true, 
          customMessage: data.message || "Attendance already marked.", 
          confidence: data.confidence,
          time: displayTime
        });
        setMessage(`⚠️ Cooldown: ${data.empName}`); speakText(`${data.empName} attendance already marked`);
        
        setTimeout(() => {
          resetScannerAndResume();
        }, 4000);
        return;
      }

      if (data.success) {
        const empId = data.empId || "";
        const empName = data.empName || "Employee";

        if (data.saveNeeded === false) {
          if (lastMatchedEmpIdRef.current === empId) {
            const nextCount = matchCountRef.current + 1;
            setMatchCount(nextCount);
            setVerifyingName(empName);
            setMessage(`Verifying: ${empName}...`);
            setStatusColor(nextCount === 1 ? "#3b82f6" : "#eab308");
          } else {
            setMatchCount(1);
            lastMatchedEmpIdRef.current = empId;
            setVerifyingName(empName);
            setMessage(`Analyzing: ${empName}...`);
            setStatusColor("#3b82f6");
          }
          scheduleNextScan(150);
        } else {
          setMatchCount(3);
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#10b981");
          setScannedEmployee({ empName, empId, status: data.status || "Attendance Logged", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isDuplicate: false, confidence: data.confidence });
          setMessage(`✅ Verified: ${empName}`); speakText(`${empName} attendance marked successfully`);
          setVerifyingName(""); lastMatchedEmpIdRef.current = "";
          
          setTimeout(() => {
            resetScannerAndResume();
          }, 4000);
        }
      } else {
        setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
        setStatusColor("#ef4444"); setMessage("❌ " + (data.message || "Face Not Recognized"));
        scheduleNextScan(500);
      }
    } catch (err: any) {
      logDebug("Err: " + err.message);
      setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
      let userFriendlyMsg = "Connection Error";
      const raw = (err?.message || "").toLowerCase();
      if (raw.includes("500") || raw.includes("conversion") || raw.includes("sql") || raw.includes("reference")) {
        userFriendlyMsg = "Service temporarily unavailable. Please try again.";
      } else if (raw.includes("timeout") || raw.includes("network") || raw.includes("fetch") || raw.includes("connection")) {
        userFriendlyMsg = "Connection Timeout. Please check network.";
      } else {
        userFriendlyMsg = err?.message || "Connection Error";
      }
      setStatusColor("#ef4444"); setMessage("❌ " + userFriendlyMsg); scheduleNextScan(1500);
    }
    finally { setProcessing(false); processingRef.current = false; }
  };

  useEffect(() => {
    if (cameraReady) scheduleNextScan(400);
    return () => { if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current); };
  }, [cameraReady]);

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
          const mac  = (result.device.deviceId || "").replace(/[:-]/g, "").trim().toUpperCase();
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
        } catch {}
      });
      if (bleTimeoutRef.current) clearTimeout(bleTimeoutRef.current);
      bleTimeoutRef.current = setTimeout(async () => {
        try { await BleClient.stopLEScan(); } catch {}
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

  const toggleCamera = () => { setCameraReady(false); setCameraMode(p => p === "user" ? "environment" : "user"); };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={true} className="scanner-pg">
        
        {/* Style block overrides for clean white dashboard styling */}
        <style>{`
          .scanner-pg {
            --background: #ffffff !important;
          }
          .sc-shell {
            background: #ffffff !important;
            background-image: 
              radial-gradient(circle at 80% 5%, rgba(139, 92, 246, 0.03) 0%, transparent 35%),
              radial-gradient(circle at 10% 85%, rgba(16, 185, 129, 0.02) 0%, transparent 40%) !important;
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
            background: #f3e8ff;
            color: #8b5cf6;
            font-size: 0.44rem;
            padding: 0px 3px;
            border-radius: 4px;
            font-weight: 800;
            line-height: 1.1;
            border: 1px solid rgba(139, 92, 246, 0.15);
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
        `}</style>

        <div className="sc-shell">

          {/* HEADER */}
          <div className="sc-header">
            <button className="sc-back" onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} />
            </button>
            <div className="sc-title-wrap">
              <h1 className="sc-title">SECURITY KIOSK</h1>
              <p className="sc-subtitle">Officer Face Verification Scanner</p>
            </div>

            {/* Status Override */}
            <div className="status-override-container">
              <div className="status-title-row">
                <span className="checklist-header" style={{ margin: 0 }}>Attendance Timing Window</span>
                <button 
                  onClick={() => setShowRulesModal(true)}
                  style={{ background: 'transparent', border: 'none', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  <IonIcon icon={informationCircleOutline} style={{ fontSize: '14px' }} />
                  View Rules
                </button>
              </div>

              <div className="status-btn-group">
                {["Morning In", "Lunch Out", "Lunch In", "Evening Out"].map(slot => {
                  const isAuto = slot === getAutoStatus();
                  const isActive = selectedStatus === slot;
                  const shortLabel = slot === "Morning In" ? "Morning" : slot === "Lunch Out" ? "Lunch Out" : slot === "Lunch In" ? "Lunch In" : "Evening";
                  const slotClass = slot === "Morning In" ? "slot-morning" : slot === "Lunch Out" ? "slot-lunch-out" : slot === "Lunch In" ? "slot-lunch-in" : "slot-evening";
                  return (
                    <button
                      key={slot}
                      className={`status-btn ${slotClass} ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedStatus(slot);
                        setIsManualOverride(true);
                        logDebug(`Selected manually on Kiosk: ${slot}`);
                      }}
                    >
                      <span>{shortLabel}</span>
                      {isAuto && <span className="auto-tag">Auto</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <button className="sc-log-btn" onClick={() => history.push('/ai-attendance-log/security')} style={{ background: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
              <IonIcon icon={calendarOutline} />
            </button>
          </div>

          {/* BODY */}
          <div className="sc-body">

            {/* LEFT: CAMERA */}
            <div className="sc-cam-area">
              <div className="sc-cam-card clay" style={{ borderColor: '#e2e8f0', background: '#f8fafc', position: 'relative' }}>
                <video ref={videoRef} autoPlay playsInline muted className="sc-video" />
                <canvas ref={overlayCanvasRef} className="sc-overlay-canvas" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />

                <div className="sc-hud">
                  <svg className="sc-progress-svg" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      className="sc-progress-track"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      className="sc-progress-bar"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 * (1 - (matchCount / 3))}
                      style={{
                        stroke: matchCount === 3 ? '#10b981' : matchCount === 2 ? '#f59e0b' : '#8b5cf6',
                        transition: 'stroke-dashoffset 0.15s ease-in-out, stroke 0.15s'
                      }}
                    />
                  </svg>

                  <div className={`sc-ring ${processing || matchCount > 0 ? 'ring-scan' : scanSuccess ? 'ring-ok' : ''}`} />
                  <div className="sc-corners">
                    <span className="sc-cor tl" /><span className="sc-cor tr" />
                    <span className="sc-cor bl" /><span className="sc-cor br" />
                  </div>
                  <div className={`sc-laser ${processing || matchCount > 0 ? 'laser-on' : ''}`} style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6, transparent)', boxShadow: '0 0 12px #8b5cf6' }} />
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

                {!cameraReady && (
                  <div className="sc-cam-loader" style={{ background: '#f8fafc' }}>
                    <div className="tech-loader">
                      <div className="tech-ring-1" />
                      <div className="tech-ring-2" />
                      <div className="tech-ring-3" />
                      <div className="tech-center" />
                    </div>
                    <p style={{ color: '#8b5cf6', marginTop: '16px', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                      STARTING BIOMETRIC CAMERA…
                    </p>
                  </div>
                )}

                {capturedImg && (
                  <div className="sc-last-capture-preview" onClick={() => setCapturedImg(null)} title="Clear Preview">
                    <img src={capturedImg} alt="last scan preview" />
                  </div>
                )}

                {cameraReady && (
                  <>
                    <button 
                      className={`sc-cam-pause-btn ${isScannerPaused ? 'is-paused' : ''}`} 
                      onClick={toggleScannerPause} 
                      title={isScannerPaused ? "Start Scanner" : "Pause Scanner"}
                    >
                      <IonIcon icon={isScannerPaused ? playOutline : pauseOutline} />
                    </button>
                    <button className="sc-cam-flip-btn" onClick={toggleCamera} title="Flip Camera">
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

            {/* RIGHT: PANEL */}
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

              {scanSuccess && scannedEmployee ? (

                /* ── RESULT CARD ── */
                <div className="scanner-dashboard-card animate__animated animate__fadeInUp animate__fast">
                  <div className="sc-res-top">
                    <div className={`sc-res-avatar ${scannedEmployee.isDuplicate ? 'av-warn' : 'av-ok'}`} style={{ overflow: 'hidden', padding: 0 }}>
                      {capturedImg ? (
                        <img src={capturedImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (scannedEmployee.empName || 'E').charAt(0)
                      )}
                    </div>
                    <div className="sc-res-info">
                      <div className="sc-res-name">{scannedEmployee.empName}</div>
                      <div className="sc-res-id">ID #{scannedEmployee.empId}</div>
                    </div>
                    <div className={`sc-res-badge ${scannedEmployee.isDuplicate ? 'badge-warn' : 'badge-ok'}`}>
                      {scannedEmployee.isDuplicate ? 'Already Marked' : 'Verified'}
                    </div>
                  </div>
                  {scannedEmployee.isDuplicate ? (
                    <div style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: '12px', padding: '14px', marginTop: '12px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e11d48', fontWeight: 800, fontSize: '0.88rem', marginBottom: '6px' }}>
                        <span>⚠️ ATTENDANCE ALREADY MARKED</span>
                      </div>
                      <div style={{ color: '#9f1239', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.4 }}>
                        {scannedEmployee.customMessage || `${scannedEmployee.status} is already logged for today at ${scannedEmployee.time}.`}
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#be123c', fontWeight: 700 }}>
                        <span style={{ background: '#ffe4e6', padding: '4px 10px', borderRadius: '6px' }}>Slot: {scannedEmployee.status}</span>
                        <span style={{ background: '#ffe4e6', padding: '4px 10px', borderRadius: '6px' }}>Time: {scannedEmployee.time}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Officer Verification Details
                      </h3>
                      <div className="sc-res-chips">
                        <div className="sc-chip ok-chip" style={{ background: getSlotColorConfig(scannedEmployee.status).bg, borderColor: getSlotColorConfig(scannedEmployee.status).border }}>
                          <span className="chip-lbl" style={{ color: getSlotColorConfig(scannedEmployee.status).color }}>Shift Status</span>
                          <span className="chip-val" style={{ color: getSlotColorConfig(scannedEmployee.status).color, fontWeight: 800 }}>{getSlotColorConfig(scannedEmployee.status).label}</span>
                        </div>
                        <div className="sc-chip ok-chip">
                          <span className="chip-lbl">Logged At</span>
                          <span className="chip-val">{scannedEmployee.time}</span>
                        </div>
                        <div className="sc-chip ok-chip">
                          <span className="chip-lbl">Face Match %</span>
                          <span className="chip-val">🎯 {scannedEmployee.confidence || 98}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={resetScannerAndResume}
                    style={{
                      width: '100%',
                      height: '46px',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#475569',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      marginTop: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  >
                    Clear Result & Scan Again
                  </button>
                </div>

              ) : (

                /* ── IDLE PANEL ── */
                <div className="scanner-dashboard-card">
                  <div className="sc-status-pill" style={{ background: cooldownCountdown > 0 ? '#f59e0b10' : `${statusColor}10`, color: cooldownCountdown > 0 ? '#f59e0b' : statusColor, borderColor: cooldownCountdown > 0 ? '#f59e0b25' : `${statusColor}25` }}>
                    <span className="sc-dot" style={{ background: cooldownCountdown > 0 ? '#f59e0b' : statusColor }} />
                    {cooldownCountdown > 0 
                      ? `RESUMING IN ${cooldownCountdown}S...` 
                      : processing 
                        ? 'ANALYZING FACE...' 
                        : 'AWAITING SCAN'}
                  </div>
                  <div className="sc-msg" style={{ color: cooldownCountdown > 0 ? '#f59e0b' : statusColor }}>
                    {cooldownCountdown > 0 
                      ? 'Please step away from the camera' 
                      : message}
                  </div>

                  {/* Dashboard Checklist Widget */}
                  {(!isMobile || sheetState === "expanded") && (
                    <div style={{ marginTop: '24px' }}>
                      <h3 className="checklist-header">
                        Security Telemetry Checklist
                      </h3>
                      
                      <div className="checklist-widget">
                        
                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📷</span>
                            <div style={{ textAlign: 'left' }} className="hide-web">
                              <div style={{ fontWeight: 700 }}>Live Video Stream</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {cameraReady ? 'Connected (640x480 user)' : 'Connecting camera device...'}
                              </div>
                            </div>
                          </div>
                          <span className={`check-status-badge ${cameraReady ? 'badge-verified' : 'badge-pending'}`}>
                            {cameraReady ? 'ACTIVE' : 'OFFLINE'}
                          </span>
                        </div>

                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📍</span>
                            <div style={{ textAlign: 'left' }} className="hide-web">
                              <div style={{ fontWeight: 700 }}>Officer Geofencing</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {locationReady ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : 'Resolving GPS coordinates...'}
                              </div>
                            </div>
                          </div>
                          <span className={`check-status-badge ${locationReady ? 'badge-verified' : 'badge-pending'}`}>
                            {locationReady ? 'VERIFIED' : 'SYNCING'}
                          </span>
                        </div>

                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📶</span>
                            <div style={{ textAlign: 'left' }} className="hide-web">
                              <div style={{ fontWeight: 700 }}>EasyReach BLE Beacon</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {bleVerified 
                                  ? `Found: ${bleDeviceName} (${bleSignalStrength} dBm)` 
                                  : bleSignalStrength !== null && bleSignalStrength < -80
                                    ? `Too far: ${bleSignalStrength} dBm`
                                    : 'Scanning BLE signals...'}
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
                              ? 'CONNECTED' 
                              : bleSignalStrength !== null && bleSignalStrength < -80
                                ? 'TOO FAR' 
                                : 'SCANNING'}
                          </span>
                        </div>

                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>👤</span>
                            <div style={{ textAlign: 'left' }} className="hide-web">
                              <div style={{ fontWeight: 700 }}>Biometric Profile</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {userData ? `${userData.empName || userData.EmpName} (${userData.empCode})` : 'Resolving login data...'}
                              </div>
                            </div>
                          </div>
                          <span className={`check-status-badge ${userData ? 'badge-verified' : 'badge-pending'}`}>
                            {userData ? 'LOADED' : 'AWAITING'}
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
                <div className="rules-modal-body text-left" style={{ textAlign: 'left' }}>
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
                    style={{ padding: '8px 18px', background: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Got It
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS POPUP OVERLAY */}
          {scanSuccess && scannedEmployee && (
            <div className="sc-success-popup-overlay">
              <div className="sc-success-popup-card animate__animated animate__zoomIn">
                <div className={`sc-success-popup-icon ${scannedEmployee.isDuplicate ? 'icon-warn' : 'icon-ok'}`} style={{ borderColor: scannedEmployee.isDuplicate ? '#f59e0b' : '#10b981', color: scannedEmployee.isDuplicate ? '#f59e0b' : '#10b981', overflow: 'hidden', padding: 0 }}>
                  {capturedImg ? (
                    <img src={capturedImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    scannedEmployee.isDuplicate ? '⚠️' : '✓'
                  )}
                </div>
                <h2 className="sc-success-popup-title">
                  {scannedEmployee.isDuplicate ? 'Already Marked' : 'Attendance Logged'}
                </h2>
                <div className="sc-success-popup-name">
                  {scannedEmployee.empName}
                </div>
                <div className="sc-success-popup-id">
                  ID #{scannedEmployee.empId}
                </div>
                <div className="sc-success-popup-time">
                  Time: {scannedEmployee.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="sc-success-popup-time" style={{ color: '#8b5cf6', fontWeight: 800 }}>
                  Face Match: {scannedEmployee.confidence || 98}%
                </div>
                {scannedEmployee.customMessage && (
                  <div className="sc-success-popup-msg">
                    {scannedEmployee.customMessage}
                  </div>
                )}
                <button className="sc-success-popup-btn" style={{ background: '#8b5cf6' }} onClick={resetScannerAndResume}>
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

export default SecurityAttendanceScanner;
