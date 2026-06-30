import { IonContent, IonPage, IonIcon, IonSpinner } from "@ionic/react";
import { arrowBackOutline, cameraReverseOutline, pinOutline, bluetoothOutline, calendarOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router";
import { API_BASE } from "../../config";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
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
  const [message,      setMessage]      = useState("Initializing camera...");
  const [statusColor,  setStatusColor]  = useState("#8b5cf6");

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
  const cameraReadyRef  = useRef(false);
  const scanSuccessRef  = useRef(false);
  const processingRef   = useRef(false);
  const loopTimeoutRef  = useRef<any>(null);
  const bleTimeoutRef   = useRef<any>(null);

  useEffect(() => { latitudeRef.current      = latitude;      }, [latitude]);
  useEffect(() => { longitudeRef.current     = longitude;     }, [longitude]);
  useEffect(() => { locationReadyRef.current = locationReady; }, [locationReady]);
  useEffect(() => { bleVerifiedRef.current   = bleVerified;   }, [bleVerified]);
  useEffect(() => { bleDeviceNameRef.current = bleDeviceName; }, [bleDeviceName]);
  useEffect(() => { bleDeviceIdRef.current   = bleDeviceId;   }, [bleDeviceId]);
  useEffect(() => { cameraReadyRef.current   = cameraReady;   }, [cameraReady]);
  useEffect(() => { scanSuccessRef.current   = scanSuccess;   }, [scanSuccess]);
  useEffect(() => { processingRef.current    = processing;    }, [processing]);

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: any = null;
    const startCamera = async () => {
      try {
        setCameraReady(false);
        if (!navigator.mediaDevices?.getUserMedia) { setMessage("Camera not supported"); setStatusColor("#ef4444"); return; }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: cameraMode }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try { await videoRef.current?.play(); setCameraReady(true); setMessage("Align face to scan"); setStatusColor("#8b5cf6"); }
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
        try { await BleClient.requestLEScan({ allowDuplicates: false }, () => {}); await BleClient.stopLEScan(); } catch {}
        await verifyEasyReach();
      } catch {}
    };
    initBLE();
    return () => { if (bleTimeoutRef.current) clearTimeout(bleTimeoutRef.current); };
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

  // ── Scan loop ─────────────────────────────────────────────────────────────
  const scheduleNextScan = (delay: number, resetScanState = false) => {
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    loopTimeoutRef.current = setTimeout(() => {
      if (resetScanState) {
        setScanSuccess(false); scanSuccessRef.current = false;
        setScannedEmployee(null); setMessage("Align face to scan"); setStatusColor("#8b5cf6");
      }
      autoScan();
    }, delay);
  };

  const autoScan = async () => {
    if (processingRef.current || scanSuccessRef.current) return;
    if (!cameraReadyRef.current || !videoRef.current) { scheduleNextScan(1000); return; }
    setProcessing(true); processingRef.current = true;
    setMessage("Analyzing face..."); setStatusColor("#3b82f6");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (ctx && videoRef.current) {
        ctx.save(); ctx.scale(-1, 1); ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height); ctx.restore();
        const image = canvas.toDataURL("image/jpeg", 0.6);
        const response = await fetch(`${API_BASE}Checkin/AISecurityAttendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": "dbase-ai-master-key-2026" },
          body: JSON.stringify({ image, latitude: latitudeRef.current, longitude: longitudeRef.current, bluetoothConnected: bleVerifiedRef.current, bluetoothDeviceName: bleDeviceNameRef.current, bluetoothDeviceId: bleDeviceIdRef.current })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.invalidLocation) { setStatusColor("#ef4444"); setMessage("⛔ Outside Office Location"); speakText("You are not in office location"); scheduleNextScan(4000); return; }
        if (data.invalidTime)     { setStatusColor("#ef4444"); setMessage(`⛔ ${data.message}`);          speakText(data.message);                          scheduleNextScan(4000); return; }
        if (data.alreadyMarked) {
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#f59e0b");
          setScannedEmployee({ empName: data.empName || "Employee", empId: data.empId || "", isDuplicate: true, customMessage: data.message || "Attendance already marked." });
          setMessage(`⚠️ Cooldown: ${data.empName}`); speakText(`${data.empName} attendance already marked`);
          scheduleNextScan(4500, true); return;
        }
        if (data.success) {
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#10b981");
          setScannedEmployee({ empName: data.empName || "Employee", empId: data.empId || "", status: data.status || "Attendance Logged", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isDuplicate: false });
          setMessage(`✅ Verified: ${data.empName}`); speakText(`${data.empName} attendance marked successfully`);
          scheduleNextScan(5000, true);
        } else {
          setStatusColor("#ef4444"); setMessage("❌ Face Not Recognized"); scheduleNextScan(2500);
        }
      } else { scheduleNextScan(1000); }
    } catch { setStatusColor("#ef4444"); setMessage("❌ Connection Timeout"); scheduleNextScan(3500); }
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

  const toggleCamera = () => { setCameraReady(false); setCameraMode(p => p === "user" ? "environment" : "user"); };

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
                  <div className={`sc-ring ${processing ? 'ring-scan' : scanSuccess ? 'ring-ok' : ''}`} />
                  <div className="sc-corners">
                    <span className="sc-cor tl" /><span className="sc-cor tr" />
                    <span className="sc-cor bl" /><span className="sc-cor br" />
                  </div>
                  <div className={`sc-laser ${processing ? 'laser-on' : ''}`} />
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

                {!cameraReady && (
                  <div className="sc-cam-loader">
                    <IonSpinner name="crescent" color="secondary" />
                    <p>Starting camera…</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: PANEL — toggles between idle and result */}
            <div className="sc-panel-area">
              {scanSuccess && scannedEmployee ? (

                /* ── RESULT CARD ── */
                <div className={`sc-result clay ${scannedEmployee.isDuplicate ? 'clay-warn' : 'clay-ok'}`}>
                  <div className="sc-res-top">
                    <div className={`sc-res-avatar ${scannedEmployee.isDuplicate ? 'av-warn' : 'av-ok'}`}>
                      {(scannedEmployee.empName || 'E').charAt(0)}
                    </div>
                    <div className="sc-res-info">
                      <div className="sc-res-name">{scannedEmployee.empName}</div>
                      <div className="sc-res-id">ID #{scannedEmployee.empId}</div>
                    </div>
                    <div className={`sc-res-badge ${scannedEmployee.isDuplicate ? 'badge-warn' : 'badge-ok'}`}>
                      {scannedEmployee.isDuplicate ? '⚠ Marked' : '✓ Verified'}
                    </div>
                  </div>
                  {scannedEmployee.isDuplicate ? (
                    <div className="sc-res-msg warn-msg">{scannedEmployee.customMessage}</div>
                  ) : (
                    <div className="sc-res-chips">
                      <div className="sc-chip ok-chip">
                        <span className="chip-lbl">Status</span>
                        <span className="chip-val">{scannedEmployee.status}</span>
                      </div>
                      <div className="sc-chip ok-chip">
                        <span className="chip-lbl">Logged At</span>
                        <span className="chip-val">{scannedEmployee.time}</span>
                      </div>
                    </div>
                  )}
                </div>

              ) : (

                /* ── IDLE PANEL ── */
                <div className="sc-idle clay">
                  <div className="sc-status-pill" style={{ background: `${statusColor}18`, color: statusColor, borderColor: `${statusColor}40` }}>
                    <span className="sc-dot" style={{ background: statusColor }} />
                    {processing ? 'VERIFYING...' : scanSuccess ? 'RECORDED' : 'AWAITING'}
                  </div>
                  <div className="sc-msg" style={{ color: statusColor }}>{message}</div>
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
                  <button className="sc-swap" onClick={toggleCamera}>
                    <IonIcon icon={cameraReverseOutline} />
                    <span>Flip</span>
                  </button>
                </div>

              )}
            </div>

          </div>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default SecurityAttendanceScanner;
