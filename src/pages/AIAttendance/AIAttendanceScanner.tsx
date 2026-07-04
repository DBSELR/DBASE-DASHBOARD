import { IonContent, IonPage, IonIcon, IonSpinner } from "@ionic/react";
import { arrowBackOutline, cameraReverseOutline, pinOutline, bluetoothOutline, calendarOutline } from "ionicons/icons";
import { useRef, useState, useEffect } from "react";
import { useHistory } from "react-router";
import { API_BASE } from "../../config";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { BleClient, ScanResult } from "@capacitor-community/bluetooth-le";
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

const AIAttendanceScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const history  = useHistory();

  const [isProcessing,  setIsProcessing]  = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [scanSuccess,   setScanSuccess]   = useState(false);
  const [cameraMode,    setCameraMode]    = useState<"user" | "environment">("user");
  const [latitude,      setLatitude]      = useState<number>(0);
  const [longitude,     setLongitude]     = useState<number>(0);
  const [locationReady, setLocationReady] = useState(false);
  const [resultMessage, setResultMessage] = useState("Initializing camera...");
  const [statusColor,   setStatusColor]   = useState("#6366f1");
  const [userData,      setUserData]      = useState<any>(null);
  const [userProfile,   setUserProfile]   = useState<any>(null);
  const [bleVerified,   setBleVerified]   = useState(false);
  const [bleDeviceId,   setBleDeviceId]   = useState("");
  const [bleDeviceName, setBleDeviceName] = useState("");
  const [isBleScanning, setIsBleScanning] = useState(false);
  const [isMobile,      setIsMobile]      = useState(window.innerWidth <= 768);
  const [capturedImg,   setCapturedImg]   = useState<string | null>(null);
  const [debugLogs,     setDebugLogs]     = useState<string[]>([]);
  const logDebug = (msg: string) => {
    console.log(`[DEBUG] ${msg}`);
    setDebugLogs(prev => [msg, ...prev.slice(0, 4)]);
  };

  const [attendanceDetails, setAttendanceDetails] = useState<{
    empName?: string; empId?: string; status?: string; time?: string; officeName?: string;
    isDuplicate?: boolean; customMessage?: string;
    presenceMethod?: string; graceType?: string;
    lateMinutes?: number; date?: string; attendanceStatus?: string;
  } | null>(null);

  const latitudeRef      = useRef(0);
  const longitudeRef     = useRef(0);
  const locationReadyRef = useRef(false);
  const bleVerifiedRef   = useRef(false);
  const bleDeviceNameRef = useRef("");
  const bleDeviceIdRef   = useRef("");
  const userDataRef      = useRef<any>(null);
  const userProfileRef   = useRef<any>(null);
  const isCameraReadyRef = useRef(false);
  const scanSuccessRef   = useRef(false);
  const isProcessingRef  = useRef(false);
  const loopTimeoutRef   = useRef<any>(null);
  const bleTimeoutRef    = useRef<any>(null);

  useEffect(() => { latitudeRef.current      = latitude;      }, [latitude]);
  useEffect(() => { longitudeRef.current     = longitude;     }, [longitude]);
  useEffect(() => { locationReadyRef.current = locationReady; }, [locationReady]);
  useEffect(() => { bleVerifiedRef.current   = bleVerified;   }, [bleVerified]);
  useEffect(() => { bleDeviceNameRef.current = bleDeviceName; }, [bleDeviceName]);
  useEffect(() => { bleDeviceIdRef.current   = bleDeviceId;   }, [bleDeviceId]);
  useEffect(() => { userDataRef.current      = userData;      }, [userData]);
  useEffect(() => { userProfileRef.current   = userProfile;   }, [userProfile]);
  useEffect(() => { isCameraReadyRef.current = isCameraReady; }, [isCameraReady]);
  useEffect(() => { scanSuccessRef.current   = scanSuccess;   }, [scanSuccess]);
  useEffect(() => { isProcessingRef.current  = isProcessing;  }, [isProcessing]);

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
        logDebug("User loaded: " + (parsed?.empCode || parsed?.EmpCode || "unknown"));
      }
      catch { setResultMessage("Error loading user profile"); setStatusColor("#ef4444"); }
    } else { setResultMessage("No user profile found. Please login."); setStatusColor("#ef4444"); }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
        setResultMessage("⚠️ HTTPS Required for GPS");
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
      }
      captureAndScan();
    }, delay);
  };

  const captureAndScan = async () => {
    if (isProcessingRef.current || scanSuccessRef.current) return;
    if (!isCameraReadyRef.current || !videoRef.current) { scheduleNextScan(1000); return; }
    if (latitudeRef.current === 0 && longitudeRef.current === 0) {
      setResultMessage("Getting GPS fix…"); setStatusColor("#f59e0b");
      scheduleNextScan(2000); return;
    }
    setIsProcessing(true); isProcessingRef.current = true;
    setResultMessage("Scanning face..."); setStatusColor("#3b82f6");
    try {
      const canvas = document.createElement("canvas");
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const context = canvas.getContext("2d");
      if (context && videoRef.current) {
        context.save();
        // Mirror horizontally (matching standard front-camera perspective)
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        context.restore();

        const imageData = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImg(imageData);
        logDebug(`Capture: ${videoWidth}x${videoHeight}`);
        logDebug(`Base64 len: ${imageData.length}`);
        
        const finalEmpId = userDataRef.current?.empCode || userDataRef.current?.EmpCode || "";
        logDebug(`API POST: ${finalEmpId}`);

        const response = await fetch(`${API_BASE}Checkin/AILogAttendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": "dbase-ai-master-key-2026" },
          body: JSON.stringify({ image: imageData, empId: finalEmpId, empName: userProfileRef.current?.EmpName || userDataRef.current?.empName || "", latitude: latitudeRef.current, longitude: longitudeRef.current, bluetoothConnected: bleVerifiedRef.current, bluetoothDeviceName: bleDeviceNameRef.current, bluetoothDeviceId: bleDeviceIdRef.current })
        });
        if (!response.ok) {
          let errMsg = `HTTP ${response.status}`;
          try { const eb = await response.json(); errMsg = eb.message || errMsg; } catch {}
          throw new Error(errMsg);
        }
        const data = await response.json();
        logDebug(`API Res: success=${data.success}, msg=${data.message || ""}`);
        if (data.invalidLocation) {
          // GPS not yet acquired — retry quickly without alarming the user
          const isGpsNotReady = latitudeRef.current === 0 && longitudeRef.current === 0;
          if (isGpsNotReady) { setResultMessage("Getting GPS fix…"); setStatusColor("#f59e0b"); scheduleNextScan(2000); }
          else               { setResultMessage(`⛔ ${data.message || "Outside Office Location"}`); setStatusColor("#ef4444"); speakText(data.message || "You are not in office location"); scheduleNextScan(4000); }
          return;
        }
        if (data.invalidTime)   { setResultMessage(`⛔ ${data.message}`); setStatusColor("#ef4444"); speakText(data.message); scheduleNextScan(4000); return; }
        if (data.alreadyMarked) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId   = data.empId   || userDataRef.current?.empCode || "";
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#f59e0b");
          setAttendanceDetails({ empName, empId, status: data.status || "", isDuplicate: true, customMessage: data.message || "Already marked" });
          setResultMessage(`⚠️ ${empName}`); speakText(`${empName} attendance already marked`);
          scheduleNextScan(4500, true); return;
        }
        if (data.success) {
          const empName = data.empName || userProfileRef.current?.EmpName || userDataRef.current?.empName || "Employee";
          const empId   = data.empId   || userDataRef.current?.empCode || "";
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#10b981");
          setAttendanceDetails({
            empName, empId,
            status:           data.status           || "Attendance Logged",
            time:             data.time             || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            officeName:       data.officeName        || "",
            presenceMethod:   data.presenceMethod    || "Face Only",
            graceType:        data.graceType         || "",
            lateMinutes:      data.lateMinutes       ?? 0,
            date:             data.date              || new Date().toLocaleDateString('en-GB'),
            attendanceStatus: data.attendanceStatus  || "",
          });
          setResultMessage(`✅ Welcome, ${empName}`);
          speakText(`${empName} attendance marked successfully`);
          scheduleNextScan(5000, true);
        } else { setResultMessage("❌ Face Not Recognized"); setStatusColor("#ef4444"); scheduleNextScan(2500); }
      } else { scheduleNextScan(1000); }
    } catch (err: any) {
      logDebug("Err: " + err.message);
      setResultMessage(`❌ ${err?.message || "Connection Error"}`); setStatusColor("#ef4444"); scheduleNextScan(3500);
    }
    finally { setIsProcessing(false); isProcessingRef.current = false; }
  };

  useEffect(() => {
    if (isCameraReady) scheduleNextScan(1200);
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
          const mac  = (result.device.deviceId || "").replace(/[:-]/g, "").trim().toUpperCase();
          if (name === "ER2650001F" && mac === "EA2658F0001F") {
            found = true; setBleVerified(true); bleVerifiedRef.current = true;
            setBleDeviceName(name); setBleDeviceId(result.device.deviceId);
            logDebug("Beacon verified!");
            await BleClient.stopLEScan();
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

  const toggleCameraMode = () => { setIsCameraReady(false); setCameraMode(p => p === "user" ? "environment" : "user"); };

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
              <h1 className="sc-title">AI FACE ATTENDANCE</h1>
              <p className="sc-subtitle">Self Check-In Portal</p>
            </div>
            <button className="sc-log-btn ai-log-btn" onClick={() => history.push('/ai-attendance-log/user')}>
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
                  <div className={`sc-ring ai-ring ${isProcessing ? 'ring-scan' : scanSuccess ? 'ring-ok' : ''}`} />
                  <div className="sc-corners">
                    <span className="sc-cor tl" /><span className="sc-cor tr" />
                    <span className="sc-cor bl" /><span className="sc-cor br" />
                  </div>
                  <div className={`sc-laser ai-laser ${isProcessing ? 'laser-on' : ''}`} />
                </div>

                <div className="sc-ind-row">
                  <div className={`sc-ind ${locationReady ? 'ind-ok' : 'ind-wait'}`}>
                    <IonIcon icon={pinOutline} />
                    <span>{locationReady ? 'GPS ✓' : 'GPS…'}</span>
                  </div>
                  <div className={`sc-ind ${bleVerified ? 'ind-ok' : 'ind-wait'}`}>
                    <IonIcon icon={bluetoothOutline} />
                    <span>{bleVerified ? 'BLE ✓' : 'BLE…'}</span>
                  </div>
                </div>

                {!isCameraReady && (
                  <div className="sc-cam-loader">
                    <IonSpinner name="crescent" color="primary" />
                    <p>Starting camera…</p>
                  </div>
                )}

                {capturedImg && (
                  <div className="sc-last-capture-preview" onClick={() => setCapturedImg(null)} title="Clear Preview">
                    <img src={capturedImg} alt="last scan preview" />
                  </div>
                )}

                {isCameraReady && (
                  <button className="sc-cam-flip-btn" onClick={toggleCameraMode} title="Flip Camera">
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

            {scanSuccess && attendanceDetails ? (

              /* ── RESULT CARD ── */
              <div className="scanner-dashboard-card">
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
                    {attendanceDetails.isDuplicate ? '⚠ Already Marked' : '✓ Logged Successfully'}
                  </div>
                </div>

                {attendanceDetails.isDuplicate ? (
                  <div className="sc-res-msg warn-msg">{attendanceDetails.customMessage}</div>
                ) : (
                  <div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      Verification Details
                    </h3>
                    
                    <div className="sc-res-chips">
                      <div className="sc-chip ok-chip">
                        <span className="chip-lbl">Shift Status</span>
                        <span className="chip-val">{attendanceDetails.status}</span>
                      </div>
                      <div className="sc-chip ok-chip">
                        <span className="chip-lbl">Timestamp</span>
                        <span className="chip-val">{attendanceDetails.time}</span>
                      </div>
                      <div className="sc-chip ok-chip">
                        <span className="chip-lbl">Calendar Date</span>
                        <span className="chip-val">{attendanceDetails.date}</span>
                      </div>
                      <div className="sc-chip ok-chip">
                        <span className="chip-lbl">Identity Mode</span>
                        <span className="chip-val">
                          {attendanceDetails.presenceMethod === 'Bluetooth + GPS' ? '📶📍 BT + GPS' :
                           attendanceDetails.presenceMethod === 'Bluetooth'       ? '📶 Bluetooth' :
                           attendanceDetails.presenceMethod === 'GPS'             ? '📍 GPS' :
                                                                                    '🎭 Face Recognition'}
                        </span>
                      </div>

                      {attendanceDetails.officeName && (
                        <div className="sc-chip ok-chip chip-full">
                          <span className="chip-lbl">Registered Office</span>
                          <span className="chip-val">📍 {attendanceDetails.officeName}</span>
                        </div>
                      )}

                      {(attendanceDetails.lateMinutes ?? 0) > 0 && (
                        <div className="sc-chip warn-chip chip-full">
                          <span className="chip-lbl">Late Warning</span>
                          <span className="chip-val">
                            ⚠️ {attendanceDetails.graceType || attendanceDetails.attendanceStatus} — {attendanceDetails.lateMinutes} min late
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            ) : (

              /* ── IDLE PANEL ── */
              <div className="scanner-dashboard-card">
                <div className="sc-status-pill" style={{ background: `${statusColor}18`, color: statusColor, borderColor: `${statusColor}40` }}>
                  <span className="sc-dot" style={{ background: statusColor }} />
                  {isProcessing ? 'SCANNING BIOMETRICS...' : 'AWAITING RECOGNITION'}
                </div>
                <div className="sc-msg" style={{ color: statusColor }}>{resultMessage}</div>
                
                {/* Dashboard Checklist Widget */}
                {(!isMobile || sheetState === "expanded") && (
                  <div style={{ marginTop: '24px' }}>
                    <h3 className="checklist-header">
                      Telemetry Checklist
                    </h3>
                    
                    <div className="checklist-widget">
                      {/* 1. Camera Health */}
                      <div className="check-item">
                        <div className="check-label-wrap">
                          <span style={{ fontSize: '18px' }}>📷</span>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700 }}>Live Video Stream</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                              {isCameraReady ? 'Connected (640x480 user)' : 'Connecting camera device...'}
                            </div>
                          </div>
                        </div>
                        <span className={`check-status-badge ${isCameraReady ? 'badge-verified' : 'badge-pending'}`}>
                          {isCameraReady ? 'ACTIVE' : 'OFFLINE'}
                        </span>
                      </div>

                      {/* 2. GPS Location */}
                      <div className="check-item">
                        <div className="check-label-wrap">
                          <span style={{ fontSize: '18px' }}>📍</span>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700 }}>Office Geofencing</div>
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
                              {bleVerified ? `Found: ${bleDeviceName}` : 'Scanning BLE signals...'}
                            </div>
                          </div>
                        </div>
                        <span className={`check-status-badge ${bleVerified ? 'badge-verified' : 'badge-pending'}`}>
                          {bleVerified ? 'CONNECTED' : 'SCANNING'}
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

          </div>{/* sc-body */}

          {scanSuccess && attendanceDetails && (
            <div className="sc-success-popup-overlay">
              <div className="sc-success-popup-card animate__animated animate__zoomIn">
                <div className={`sc-success-popup-icon ${attendanceDetails.isDuplicate ? 'icon-warn' : 'icon-ok'}`}>
                  {attendanceDetails.isDuplicate ? '⚠️' : '✓'}
                </div>
                <h2 className="sc-success-popup-title">
                  {attendanceDetails.isDuplicate ? 'Already Marked' : 'Attendance Logged'}
                </h2>
                <div className="sc-success-popup-name">
                  {attendanceDetails.empName}
                </div>
                <div className="sc-success-popup-id">
                  ID #{attendanceDetails.empId}
                </div>
                <div className="sc-success-popup-time">
                  Time: {attendanceDetails.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {attendanceDetails.customMessage && (
                  <div className="sc-success-popup-msg">
                    {attendanceDetails.customMessage}
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

export default AIAttendanceScanner;
