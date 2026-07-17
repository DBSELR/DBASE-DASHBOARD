import { IonContent, IonPage, IonIcon, IonSpinner } from "@ionic/react";
import { arrowBackOutline, cameraReverseOutline, pinOutline, bluetoothOutline, calendarOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
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
  const logDebug = (msg: string) => {
    console.log(`[DEBUG] ${msg}`);
    setDebugLogs(prev => [msg, ...prev.slice(0, 4)]);
  };

  const [scannedEmployee, setScannedEmployee] = useState<{
    empName?: string; empId?: string; status?: string; time?: string;
    isDuplicate?: boolean; customMessage?: string;
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

  const autoScan = async () => {
    if (processingRef.current || scanSuccessRef.current) return;
    if (!cameraReadyRef.current || !videoRef.current) { scheduleNextScan(1000); return; }
    if (latitudeRef.current === 0 && longitudeRef.current === 0) {
      setMessage("Getting GPS fix…"); setStatusColor("#f59e0b");
      scheduleNextScan(2000); return;
    }
    setProcessing(true); processingRef.current = true;
    setMessage("Analyzing face..."); setStatusColor("#3b82f6");
    try {
      const canvas = document.createElement("canvas");
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const ctx = canvas.getContext("2d");
      if (ctx && videoRef.current) {
        ctx.save();
        // Mirror horizontally (matching standard front-camera perspective)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        const image = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImg(image);
        logDebug(`Capture: ${videoWidth}x${videoHeight}`);
        logDebug(`Base64 len: ${image.length}`);
        
        logDebug(`API POST: AISecurityAttendance`);

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
            saveNeeded: isLastFrame
          })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        logDebug(`API Res: success=${data.success}, msg=${data.message || ""}`);
        
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
          setScannedEmployee({ empName: data.empName || "Employee", empId: data.empId || "", isDuplicate: true, customMessage: data.message || "Attendance already marked." });
          setMessage(`⚠️ Cooldown: ${data.empName}`); speakText(`${data.empName} attendance already marked`);
          scheduleNextScan(4500, true);
          return;
        }
        if (data.success) {
          const empId = data.empId || "";
          const empName = data.empName || "Employee";

          if (data.saveNeeded === false) {
            // First or second matching frame (identify mode)
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
            // Capture next frame very quickly to perform consensus check
            scheduleNextScan(150);
          } else {
            // Third frame matched and successfully saved to DB
            setMatchCount(3);
            setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#10b981");
            setScannedEmployee({ empName, empId, status: data.status || "Attendance Logged", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isDuplicate: false });
            setMessage(`✅ Verified: ${empName}`); speakText(`${empName} attendance marked successfully`);
            setVerifyingName(""); lastMatchedEmpIdRef.current = "";
            scheduleNextScan(5000, true);
          }
        } else {
          setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
          setStatusColor("#ef4444"); setMessage("❌ Face Not Recognized");
          scheduleNextScan(1500);
        }
      } else { scheduleNextScan(1000); }
    } catch (err: any) {
      logDebug("Err: " + err.message);
      setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
      setStatusColor("#ef4444"); setMessage("❌ Connection Timeout"); scheduleNextScan(3500);
    }
    finally { setProcessing(false); processingRef.current = false; }
  };

  useEffect(() => {
    if (cameraReady) scheduleNextScan(1200);
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
            const isCloseEnough = rssi >= -80;

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

  // ── Drag Sheet Gesture ────────────────────────────────────────────────────
  const COLLAPSED_Y = 120;

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

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <IonPage>
      <IonContent fullscreen scrollY={false} className="scanner-pg">
        <div className="sc-shell">

          {/* HEADER */}
          <div className="sc-header">
            <button className="sc-back" onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} />
            </button>
            <div className="sc-title-wrap">
              <h1 className="sc-title">SECURITY ATTENDANCE</h1>
              <p className="sc-subtitle">Officer Face Verification Scanner</p>
            </div>
            <button className="sc-log-btn" onClick={() => history.push('/ai-attendance-log/security')}>
              <IonIcon icon={calendarOutline} />
            </button>
          </div>

          {/* BODY — camera left · panel right */}
          <div className="sc-body">

            {/* LEFT: CAMERA */}
            <div className="sc-cam-area">
              <div className="sc-cam-card clay">
                <video ref={videoRef} autoPlay playsInline muted className="sc-video" />

                <div className="sc-hud">
                  {/* Glowing Circular Progress Ring */}
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
                        stroke: matchCount === 3 ? '#10b981' : matchCount === 2 ? '#f59e0b' : '#3b82f6',
                        transition: 'stroke-dashoffset 0.15s ease-in-out, stroke 0.15s'
                      }}
                    />
                  </svg>

                  <div className={`sc-ring ${matchCount > 0 ? 'ring-scan' : scanSuccess ? 'ring-ok' : ''}`} />
                  <div className="sc-corners">
                    <span className="sc-cor tl" /><span className="sc-cor tr" />
                    <span className="sc-cor bl" /><span className="sc-cor br" />
                  </div>
                  <div className={`sc-laser ${matchCount > 0 ? 'laser-on' : ''}`} />
                </div>

                <div className="sc-ind-row">
                  <div className={`sc-ind ${locationReady ? 'ind-ok' : 'ind-wait'}`}>
                    <IonIcon icon={pinOutline} />
                    <span>{locationReady ? 'GPS ✓' : 'GPS…'}</span>
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
                      ? 'BLE ✓' 
                      : bleSignalStrength !== null && bleSignalStrength < -80
                        ? 'BLE Weak'
                        : 'BLE…'}</span>
                  </div>
                </div>

                {!cameraReady && (
                  <div className="sc-cam-loader">
                    <IonSpinner name="crescent" color="secondary" />
                    <p>Starting camera…</p>
                  </div>
                )}

                {capturedImg && (
                  <div className="sc-last-capture-preview" onClick={() => setCapturedImg(null)} title="Clear Preview">
                    <img src={capturedImg} alt="last scan preview" />
                  </div>
                )}

                {cameraReady && (
                  <button className="sc-cam-flip-btn" onClick={toggleCamera} title="Flip Camera">
                    <IonIcon icon={cameraReverseOutline} />
                  </button>
                )}

                {/* Debug Logs Overlay */}
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  zIndex: 100,
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#22c55e',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  pointerEvents: 'none',
                  maxWidth: '75%',
                  lineHeight: '1.3',
                  border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                  {debugLogs.length === 0 ? "[DEBUG] Idle" : debugLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: PANEL — toggles between idle and result */}
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
                <div className="scanner-dashboard-card">
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
                      {scannedEmployee.isDuplicate ? '⚠ Already Marked' : '✓ Verified'}
                    </div>
                  </div>
                  {scannedEmployee.isDuplicate ? (
                    <div className="sc-res-msg warn-msg">{scannedEmployee.customMessage}</div>
                  ) : (
                    <div>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Officer Verification Details
                      </h3>
                      <div className="sc-res-chips">
                        <div className="sc-chip ok-chip">
                          <span className="chip-lbl">Shift Status</span>
                          <span className="chip-val">{scannedEmployee.status}</span>
                        </div>
                        <div className="sc-chip ok-chip">
                          <span className="chip-lbl">Logged At</span>
                          <span className="chip-val">{scannedEmployee.time}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              ) : (

                /* ── IDLE PANEL ── */
                <div className="scanner-dashboard-card">
                  <div className="sc-status-pill" style={{ background: `${statusColor}18`, color: statusColor, borderColor: `${statusColor}40` }}>
                    <span className="sc-dot" style={{ background: statusColor }} />
                    {processing ? 'ANALYZING FACE...' : 'AWAITING SCAN'}
                  </div>
                  <div className="sc-msg" style={{ color: statusColor }}>{message}</div>
                  
                  {/* Dashboard Checklist Widget */}
                  {(!isMobile || sheetState === "expanded") && (
                    <div style={{ marginTop: '24px' }}>
                      <h3 className="checklist-header">
                        Security Telemetry Checklist
                      </h3>
                      
                      <div className="checklist-widget">
                        {/* 1. Camera Health */}
                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📷</span>
                            <div style={{ textAlign: 'left' }}>
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

                        {/* 2. GPS Location */}
                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📍</span>
                            <div style={{ textAlign: 'left' }}>
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

                        {/* 3. Bluetooth Beacon */}
                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>📶</span>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontWeight: 700 }}>EasyReach BLE Beacon</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                {bleVerified 
                                  ? `Found: ${bleDeviceName} (${bleSignalStrength} dBm)` 
                                  : bleSignalStrength !== null && bleSignalStrength < -80
                                    ? `Too far: ${bleSignalStrength} dBm (Must be on 4th floor)`
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

                        {/* 4. Employee Identity */}
                        <div className="check-item">
                          <div className="check-label-wrap">
                            <span style={{ fontSize: '18px' }}>👤</span>
                            <div style={{ textAlign: 'left' }}>
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

          </div>

          {scanSuccess && scannedEmployee && (
            <div className="sc-success-popup-overlay">
              <div className="sc-success-popup-card animate__animated animate__zoomIn">
                <div className={`sc-success-popup-icon ${scannedEmployee.isDuplicate ? 'icon-warn' : 'icon-ok'}`}>
                  {scannedEmployee.isDuplicate ? '⚠️' : '✓'}
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
                {scannedEmployee.customMessage && (
                  <div className="sc-success-popup-msg">
                    {scannedEmployee.customMessage}
                  </div>
                )}
                <button className="sc-success-popup-btn" onClick={() => {
                  setScanSuccess(false);
                  scanSuccessRef.current = false;
                  setCapturedImg(null);
                }}>
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
