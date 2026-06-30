import { IonContent, IonPage, IonIcon, IonSpinner } from "@ionic/react";
import { arrowBackOutline, cameraReverseOutline, pinOutline, bluetoothOutline, calendarOutline } from "ionicons/icons";
import { useRef, useState, useEffect } from "react";
import { useHistory } from "react-router";
import { API_BASE } from "../../config";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
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

  const [attendanceDetails, setAttendanceDetails] = useState<{
    empName?: string; empId?: string; status?: string; time?: string; officeName?: string;
    isDuplicate?: boolean; customMessage?: string;
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
        try { await BleClient.requestLEScan({ allowDuplicates: false }, () => {}); await BleClient.stopLEScan(); } catch {}
        await verifyEasyReach();
      } catch {}
    };
    initBLE();
    return () => { if (bleTimeoutRef.current) clearTimeout(bleTimeoutRef.current); };
  }, []);

  // ── User load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try { const parsed = JSON.parse(storedUser); setUserData(parsed); setUserProfile(parsed); setResultMessage("Align your face in the frame"); setStatusColor("#6366f1"); }
      catch { setResultMessage("Error loading user profile"); setStatusColor("#ef4444"); }
    } else { setResultMessage("No user profile found. Please login."); setStatusColor("#ef4444"); }
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let watchId: any = null;
    const startLocationWatch = async () => {
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location === "granted") {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
          setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setLocationReady(true);
        }
      } catch {}
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (p) => { setLatitude(p.coords.latitude); setLongitude(p.coords.longitude); setLocationReady(true); },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      }
    };
    startLocationWatch();
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startVideo = async () => {
      try {
        setIsCameraReady(false);
        if (!navigator.mediaDevices?.getUserMedia) { setResultMessage("Camera not supported"); setStatusColor("#ef4444"); return; }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraMode, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try { await videoRef.current?.play(); setIsCameraReady(true); }
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
      }
      captureAndScan();
    }, delay);
  };

  const captureAndScan = async () => {
    if (isProcessingRef.current || scanSuccessRef.current) return;
    if (!isCameraReadyRef.current || !videoRef.current) { scheduleNextScan(1000); return; }
    setIsProcessing(true); isProcessingRef.current = true;
    setResultMessage("Scanning face..."); setStatusColor("#3b82f6");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 240;
      const context = canvas.getContext("2d");
      if (context && videoRef.current) {
        context.save(); context.scale(-1, 1); context.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height); context.restore();
        const imageData = canvas.toDataURL("image/jpeg", 0.6);
        const response = await fetch(`${API_BASE}Checkin/AILogAttendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": "dbase-ai-master-key-2026" },
          body: JSON.stringify({ image: imageData, empId: userDataRef.current?.empCode || "", empName: userProfileRef.current?.EmpName || userDataRef.current?.empName || "", latitude: latitudeRef.current, longitude: longitudeRef.current, bluetoothConnected: bleVerifiedRef.current, bluetoothDeviceName: bleDeviceNameRef.current, bluetoothDeviceId: bleDeviceIdRef.current })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.invalidLocation) {
          // GPS not yet acquired — retry quickly without alarming the user
          const isGpsNotReady = latitudeRef.current === 0 && longitudeRef.current === 0;
          if (isGpsNotReady) { setResultMessage("Getting GPS fix…"); setStatusColor("#f59e0b"); scheduleNextScan(2000); }
          else               { setResultMessage("⛔ Outside Office Location"); setStatusColor("#ef4444"); speakText("You are not in office location"); scheduleNextScan(4000); }
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
          setAttendanceDetails({ empName, empId, status: data.status || "Attendance Logged", time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), officeName: data.officeName || "Main Office Area" });
          setResultMessage(`✅ Welcome, ${empName}`);
          speakText(`${empName} attendance marked successfully`);
          scheduleNextScan(5000, true);
        } else { setResultMessage("❌ Face Not Recognized"); setStatusColor("#ef4444"); scheduleNextScan(2500); }
      } else { scheduleNextScan(1000); }
    } catch { setResultMessage("❌ Connection Timeout"); setStatusColor("#ef4444"); scheduleNextScan(3500); }
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
    try {
      let found = false;
      await BleClient.requestLEScan({}, async (result: ScanResult) => {
        try {
          const name = (result.device.name || "").trim().toUpperCase();
          const mac  = (result.device.deviceId || "").replace(/[:-]/g, "").trim().toUpperCase();
          if (name === "ER2650001F" && mac === "EA2658F0001F") {
            found = true; setBleVerified(true); bleVerifiedRef.current = true;
            setBleDeviceName(name); setBleDeviceId(result.device.deviceId);
            await BleClient.stopLEScan();
          }
        } catch {}
      });
      if (bleTimeoutRef.current) clearTimeout(bleTimeoutRef.current);
      bleTimeoutRef.current = setTimeout(async () => {
        try { await BleClient.stopLEScan(); } catch {}
        setIsBleScanning(false);
        if (!found && !bleVerifiedRef.current) bleTimeoutRef.current = setTimeout(verifyEasyReach, 30000);
      }, 7000);
    } catch {
      setIsBleScanning(false); setBleVerified(false);
      if (!bleVerifiedRef.current) bleTimeoutRef.current = setTimeout(verifyEasyReach, 30000);
    }
  };

  const toggleCameraMode = () => { setIsCameraReady(false); setCameraMode(p => p === "user" ? "environment" : "user"); };

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
              </div>
            </div>

            {/* RIGHT: PANEL — toggles between idle and result */}
            <div className="sc-panel-area">
            {scanSuccess && attendanceDetails ? (

              /* ── RESULT CARD ── */
              <div className={`sc-result clay ${attendanceDetails.isDuplicate ? 'clay-warn' : 'clay-ok'}`}>
                <div className="sc-res-top">
                  <div className={`sc-res-avatar ${attendanceDetails.isDuplicate ? 'av-warn' : 'av-ok'}`}>
                    {(attendanceDetails.empName || 'E').charAt(0)}
                  </div>
                  <div className="sc-res-info">
                    <div className="sc-res-name">{attendanceDetails.empName}</div>
                    <div className="sc-res-id">ID #{attendanceDetails.empId}</div>
                  </div>
                  <div className={`sc-res-badge ${attendanceDetails.isDuplicate ? 'badge-warn' : 'badge-ok'}`}>
                    {attendanceDetails.isDuplicate ? '⚠ Marked' : '✓ Marked'}
                  </div>
                </div>
                {attendanceDetails.isDuplicate ? (
                  <div className="sc-res-msg warn-msg">{attendanceDetails.customMessage}</div>
                ) : (
                  <div className="sc-res-chips">
                    <div className="sc-chip ok-chip">
                      <span className="chip-lbl">Session</span>
                      <span className="chip-val">{attendanceDetails.status}</span>
                    </div>
                    <div className="sc-chip ok-chip">
                      <span className="chip-lbl">Time</span>
                      <span className="chip-val">{attendanceDetails.time}</span>
                    </div>
                    <div className="sc-chip ok-chip chip-full">
                      <span className="chip-lbl">Location</span>
                      <span className="chip-val">📍 {attendanceDetails.officeName}</span>
                    </div>
                  </div>
                )}
              </div>

            ) : (

              /* ── IDLE PANEL ── */
              <div className="sc-idle clay">
                <div className="sc-status-pill" style={{ background: `${statusColor}18`, color: statusColor, borderColor: `${statusColor}40` }}>
                  <span className="sc-dot" style={{ background: statusColor }} />
                  {isProcessing ? 'ANALYZING...' : scanSuccess ? 'VERIFIED' : 'AWAITING'}
                </div>
                <div className="sc-msg" style={{ color: statusColor }}>{resultMessage}</div>
                <div className="sc-ind-chips">
                  <div className={`sc-ic ${locationReady ? 'ic-ok' : 'ic-wait'}`}>
                    <IonIcon icon={pinOutline} />
                    <span>{locationReady ? 'GPS Ready' : 'GPS…'}</span>
                  </div>
                  <div className={`sc-ic ${bleVerified ? 'ic-ok' : 'ic-wait'}`}>
                    <IonIcon icon={bluetoothOutline} />
                    <span>{bleVerified ? 'Beacon OK' : 'BLE…'}</span>
                  </div>
                </div>
                <button className="sc-swap" onClick={toggleCameraMode}>
                  <IonIcon icon={cameraReverseOutline} />
                  <span>Flip</span>
                </button>
              </div>

            )}
            </div>

          </div>{/* sc-body */}

        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceScanner;
