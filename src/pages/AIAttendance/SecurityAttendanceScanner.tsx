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
  pauseOutline,
  checkmarkCircleOutline,
  alertCircleOutline
} from "ionicons/icons";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useHistory } from "react-router";
import { API_BASE } from "../../config";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { BleClient, ScanResult } from "@capacitor-community/bluetooth-le";
import "./SecurityAttendanceScanner.css";

const playSuccessChime = () => {
  if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.12);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
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
      osc.frequency.setValueAtTime(392.00, now);
      osc.frequency.setValueAtTime(329.63, now + 0.15);
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
    // Match already 12-hour format e.g. "01:32 PM", "13:32 PM", "1:32:00 PM"
    const ampmMatch = clean.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (ampmMatch) {
      const h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2];
      const ap = ampmMatch[3].toUpperCase();
      const normH = h === 0 ? 12 : (h > 12 ? h % 12 || 12 : h);
      return `${normH.toString().padStart(2, '0')}:${m} ${ap}`;
    }
    // Match 24-hour format e.g. "13:32" or "13:32:15" or "13.32"
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

const SecurityAttendanceScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const history = useHistory();

  const [processing, setProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [cameraMode, setCameraMode] = useState<"user" | "environment">("user");
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [locationReady, setLocationReady] = useState(false);
  const [bleVerified, setBleVerified] = useState(false);
  const [bleDeviceId, setBleDeviceId] = useState("");
  const [bleDeviceName, setBleDeviceName] = useState("");
  const [isBleScanning, setIsBleScanning] = useState(false);
  const [bleSignalStrength, setBleSignalStrength] = useState<number | null>(null);
  const [allowedBeacons, setAllowedBeacons] = useState<{ name: string, mac: string }[]>([]);
  const [message, setMessage] = useState("Initializing camera...");
  const [statusColor, setStatusColor] = useState("#8b5cf6");
  const [matchCount, setMatchCount] = useState(0);
  const [verifyingName, setVerifyingName] = useState("");
  const [activeFaceCount, setActiveFaceCount] = useState<number>(0);

  const [userData, setUserData] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [capturedImg, setCapturedImg] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [scannedEmployee, setScannedEmployee] = useState<{
    empName?: string;
    empId?: string;
    status?: string;
    time?: string;
    customMessage?: string;
    isDuplicate?: boolean;
    confidence?: number;
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

  // Status Selector
  const [selectedStatus, setSelectedStatus] = useState<string>(getAutoStatus());
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [isSlotSelected, setIsSlotSelected] = useState<boolean>(false);
  const [showSlotModal, setShowSlotModal] = useState<boolean>(true);

  // Rules popup
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isScannerPaused, setIsScannerPaused] = useState<boolean>(false);
  const isScannerPausedRef = useRef<boolean>(false);
  const [policyMap, setPolicyMap] = useState<Record<string, string>>({});
  const getPolVal = (key: string, fallback: string = '') => policyMap[key] || fallback;

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
      .catch(() => { });
  }, []);

  // Live Biometric Smart Guidance States & Voice Prompts
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

  // Cooldown countdown state
  const [cooldownCountdown, setCooldownCountdown] = useState<number>(0);
  const cooldownCountdownRef = useRef(0);

  // Auto-dismiss countdown for biometric modal
  const [countdownTimer, setCountdownTimer] = useState<number>(3);
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const autoDismissIntervalRef = useRef<any>(null);

  const startAutoDismissCountdown = (totalSeconds: number = 3) => {
    if (autoDismissIntervalRef.current) clearInterval(autoDismissIntervalRef.current);
    setCountdownTimer(totalSeconds);
    setProgressPercent(100);

    const startTime = Date.now();
    const totalMs = totalSeconds * 1000;

    autoDismissIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, totalMs - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);
      const pct = Math.max(0, (remainingMs / totalMs) * 100);

      setCountdownTimer(remainingSec);
      setProgressPercent(pct);

      if (remainingMs <= 0) {
        clearInterval(autoDismissIntervalRef.current);
        autoDismissIntervalRef.current = null;
        resetScannerAndResume();
      }
    }, 50);
  };

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

  const getSlotColorConfig = (slot?: string) => {
    const s = (slot || '').toLowerCase();
    if (s.includes('morning') || s.includes('in') || s.includes('09:') || s.includes('10:')) {
      return { label: '🌅 Morning In', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' };
    }
    if (s.includes('lunch') && s.includes('out')) {
      return { label: '🍱 Lunch Out', color: '#f59e0b', bg: '#fef3c7', border: '#fde68a' };
    }
    if (s.includes('lunch') && s.includes('in')) {
      return { label: '🍱 Lunch In', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' };
    }
    if (s.includes('evening') || s.includes('out')) {
      return { label: '🌆 Evening Out', color: '#dc2626', bg: '#fee2e2', border: '#fecdd3' };
    }
    if (s.includes('night') || s.includes('permission')) {
      return { label: '🌙 ' + (slot || 'Session'), color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' };
    }
    return { label: slot || 'Attendance Slot', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
  };

  useEffect(() => {
    cooldownCountdownRef.current = cooldownCountdown;
  }, [cooldownCountdown]);

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
      setMessage("⏸️ Scanner Paused");
      setStatusColor("#f59e0b");
      detectedFacesRef.current = [];
      setActiveFaceCount(0);
    } else {
      setMessage("Awaiting scan...");
      setStatusColor("#8b5cf6");
    }
  };

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectedFacesRef = useRef<any[]>([]);
  const lastDetectedFacesTimestampRef = useRef<number>(0);
  const latestServerIdentitiesRef = useRef<any[]>([]);
  const recentlyMarkedEmpIdsRef = useRef<Map<string, number>>(new Map());

  // Smooth 60 FPS motion lerp tracker cache
  const smoothTrackedFacesRef = useRef<Map<string, any>>(new Map());

  // Real-time client-side fast face detector (runs every 35ms for 0ms latency tracking & motion follow)
  useEffect(() => {
    let detector: any = null;
    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 6 });
      } catch { }
    }

    let isMounted = true;
    const runFastLocalDetector = async () => {
      if (!isMounted || !cameraReady || !videoRef.current || isScannerPausedRef.current || showSlotModalRef.current || !isSlotSelectedRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2) return;

      const timeNow = Date.now();
      const isFreshServerMatch = (timeNow - lastDetectedFacesTimestampRef.current) < 1600;
      const validServerFaces = (isFreshServerMatch && latestServerIdentitiesRef.current.length > 0) ? latestServerIdentitiesRef.current : [];

      if (detector) {
        try {
          const localDetections = await detector.detect(video);
          if (Array.isArray(localDetections) && localDetections.length > 0) {
            const vW = video.clientWidth || 640;
            const vH = video.clientHeight || 480;
            const iW = video.videoWidth || 640;
            const iH = video.videoHeight || 480;
            const sX = vW / iW;
            const sY = vH / iH;

            const updatedLocalFaces = localDetections.map((d: any, idx: number) => {
              const b = d.boundingBox;
              const rawLeft = b.x ?? b.left ?? 0;
              const rawTop = b.y ?? b.top ?? 0;
              const rawW = b.width ?? 120;
              const rawH = b.height ?? 120;

              // Mirror transform for selfie/front camera
              const left = vW - ((rawLeft + rawW) * sX);
              const right = vW - (rawLeft * sX);
              const top = rawTop * sY;
              const bottom = (rawTop + rawH) * sY;

              const faceW = Math.max(50, right - left);
              const faceH = Math.max(50, bottom - top);
              const centerX = left + faceW / 2;
              const centerY = top + faceH / 2;
              const radius = Math.max(faceW, faceH) / 2 + 18;

              // Pair ONLY with fresh, confirmed server identities (never stale/ghost identities)
              const matchedServer = validServerFaces[idx] || (validServerFaces.length > 0 ? validServerFaces[0] : null);
              const isConfirmedRecognized = Boolean(matchedServer && matchedServer.isRecognized === true && matchedServer.empName && matchedServer.empName !== 'Unknown Person');
              const isUnknown = Boolean(matchedServer && (matchedServer.isRecognized === false || matchedServer.empName === 'Unknown Person'));

              const empName = isConfirmedRecognized
                ? (matchedServer.empName || matchedServer.EmpName || matchedServer.empId)
                : (isUnknown ? 'Unknown Person' : 'Aligning Face...');

              return {
                id: `face_${idx}`,
                centerX,
                centerY,
                radius,
                empName,
                isRecognized: isConfirmedRecognized,
                isUnknown,
                alreadyMarked: Boolean(matchedServer?.alreadyMarked),
                lastSeen: timeNow
              };
            });

            if (updatedLocalFaces.length > 0) {
              detectedFacesRef.current = updatedLocalFaces;
              setActiveFaceCount(updatedLocalFaces.length);

              const primaryB = localDetections[0].boundingBox;
              const rawW = primaryB.width ?? 120;
              const rawH = primaryB.height ?? 120;
              const rawLeft = primaryB.x ?? primaryB.left ?? 0;
              const rawTop = primaryB.y ?? primaryB.top ?? 0;
              const fCenterX = rawLeft + rawW / 2;
              const fCenterY = rawTop + rawH / 2;

              const sizeRatio = Math.max(rawW, rawH) / iH;
              const distFromCenter = Math.hypot(fCenterX - (iW / 2), fCenterY - (iH / 2));

              if (rawW < 95 || sizeRatio < 0.22) {
                setGuidanceState("too-far");
                setGuidanceText("📏 Come closer to the camera");
                triggerVoiceGuidance("too-far", "Please come closer to the camera");
              } else if (rawW > 260 || sizeRatio > 0.65) {
                setGuidanceState("too-close");
                setGuidanceText("📏 Move back a little");
                triggerVoiceGuidance("too-close", "Please move back a little");
              } else if (distFromCenter > 65) {
                setGuidanceState("off-center");
                setGuidanceText("🎯 Center your face in the circle");
                triggerVoiceGuidance("off-center", "Please center your face inside the circle");
              } else {
                setGuidanceState("aligned");
                setGuidanceText("⚡ Hold still, analyzing face...");
                triggerVoiceGuidance("aligned", "Hold still");
              }
              return;
            } else {
              setGuidanceState("idle");
              setGuidanceText("🎯 Align your face in the circle");
            }
          }
        } catch { }
      }

      // Fast Client-Side Canvas Dynamic 4-Column Multi-Face Region Locator Fallback
      try {
        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = 160;
        sampleCanvas.height = 120;
        const sCtx = sampleCanvas.getContext("2d");
        if (sCtx && video) {
          sCtx.drawImage(video, 0, 0, 160, 120);
          const imgData = sCtx.getImageData(0, 0, 160, 120);
          const data = imgData.data;

          const vW = video.clientWidth || 640;
          const vH = video.clientHeight || 480;
          const sX = vW / 160;
          const sY = vH / 120;

          // Segment image into 4 horizontal columns for multi-person separation (3, 4+ faces)
          const cols = [
            { minX: 40, maxX: 0, minY: 120, maxY: 0, count: 0 },
            { minX: 80, maxX: 40, minY: 120, maxY: 0, count: 0 },
            { minX: 120, maxX: 80, minY: 120, maxY: 0, count: 0 },
            { minX: 160, maxX: 120, minY: 120, maxY: 0, count: 0 }
          ];

          for (let y = 10; y < 110; y += 4) {
            for (let x = 10; x < 150; x += 4) {
              const idx = (y * 160 + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              const isSkin = (r > 60 && g > 40 && b > 20 && (r - Math.min(g, b) > 15) && (Math.abs(r - g) > 15) && r > g && r > b);
              if (isSkin) {
                const cIdx = Math.min(3, Math.floor(x / 40));
                const col = cols[cIdx];
                col.count++;
                if (x < col.minX) col.minX = x;
                if (x > col.maxX) col.maxX = x;
                if (y < col.minY) col.minY = y;
                if (y > col.maxY) col.maxY = y;
              }
            }
          }

          const localFaces: any[] = [];

          cols.forEach((col, idx) => {
            if (col.count > 12 && col.maxX > col.minX) {
              const rawW = col.maxX - col.minX;
              const rawH = col.maxY - col.minY;
              const left = vW - ((col.minX + rawW) * sX);
              const right = vW - (col.minX * sX);
              const top = col.minY * sY;
              const bottom = (col.minY + rawH) * sY;
              const fW = Math.max(65, right - left);
              const fH = Math.max(65, bottom - top);
              const cX = left + fW / 2;
              const cY = top + fH / 2;
              const rad = Math.max(fW, fH) / 2 + 18;

              const matchedServer = validServerFaces[localFaces.length] || (validServerFaces.length > 0 ? validServerFaces[0] : null);
              const isConfirmedRecognized = Boolean(matchedServer && matchedServer.isRecognized === true && matchedServer.empName && matchedServer.empName !== 'Unknown Person');
              const isUnknown = Boolean(matchedServer && (matchedServer.isRecognized === false || matchedServer.empName === 'Unknown Person'));

              const empName = isConfirmedRecognized
                ? (matchedServer.empName || matchedServer.EmpName || matchedServer.empId)
                : (isUnknown ? 'Unknown Person' : 'Aligning Face...');

              localFaces.push({
                id: `local_face_${idx}`,
                centerX: cX,
                centerY: cY,
                radius: rad,
                empName,
                isRecognized: isConfirmedRecognized,
                isUnknown,
                alreadyMarked: Boolean(matchedServer?.alreadyMarked),
                lastSeen: timeNow
              });
            }
          });

          if (localFaces.length > 0) {
            detectedFacesRef.current = localFaces;
            setActiveFaceCount(localFaces.length);

            const primary = localFaces[0];
            const distFromCenter = Math.hypot(primary.centerX - (vW / 2), primary.centerY - (vH / 2));
            if (primary.radius < 50) {
              setGuidanceState("too-far");
              setGuidanceText("📏 Come closer to the camera");
              triggerVoiceGuidance("too-far", "Please come closer to the camera");
            } else if (primary.radius > 135) {
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

    const intervalId = setInterval(runFastLocalDetector, 35); // 30 FPS client-side detector loop
    return () => { isMounted = false; clearInterval(intervalId); };
  }, [cameraReady]);

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

    if (showSlotModalRef.current || !isSlotSelectedRef.current) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const timeNow = Date.now();
    if (lastDetectedFacesTimestampRef.current > 0 && (timeNow - lastDetectedFacesTimestampRef.current > 3000)) {
      latestServerIdentitiesRef.current = [];
    }

    const rawFaces = detectedFacesRef.current;
    if (!rawFaces || rawFaces.length === 0) {
      smoothTrackedFacesRef.current.clear();
      return;
    }

    // Pick ONLY the single primary face for badge rendering when verified
    const face = rawFaces[0];
    if (!face) return;

    const isRecognized = face.isRecognized === true && Boolean(face.empName) && face.empName !== 'Analyzing...' && face.empName !== 'Aligning Face...' && face.empName !== 'Unknown Person';

    // Only render overlay badge if face is recognized with a confirmed name
    if (!isRecognized) return;

    let targetCenterX = width / 2;
    let targetCenterY = Math.max(25, (height / 2) - 155);

    if (face.centerX !== undefined) {
      targetCenterX = face.centerX;
      targetCenterY = Math.max(25, face.centerY - (face.radius || 80) - 30);
    }

    const isDup = face.alreadyMarked;
    const color = isDup ? '#f59e0b' : '#10b981';
    const name = face.empName || '';

    // Single clean floating verified badge
    const badgeText = `${isDup ? '⚠️ ' : '✅ '}${name}`;
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    const textW = ctx.measureText(badgeText).width;
    const bW = textW + 28;
    const bH = 28;
    const bX = targetCenterX - bW / 2;
    const bY = targetCenterY;

    ctx.save();
    ctx.beginPath();
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(bX, bY, bW, bH, 14);
    } else {
      ctx.rect(bX, bY, bW, bH);
    }
    ctx.fillStyle = isDup ? 'rgba(245, 158, 11, 0.95)' : 'rgba(16, 185, 129, 0.95)';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    ctx.fillText(badgeText, targetCenterX, bY + bH / 2 + 4);
    ctx.restore();
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

  const latitudeRef = useRef(0);
  const longitudeRef = useRef(0);
  const locationReadyRef = useRef(false);
  const bleVerifiedRef = useRef(false);
  const bleDeviceNameRef = useRef("");
  const bleDeviceIdRef = useRef("");
  const allowedBeaconsRef = useRef<{ name: string, mac: string }[]>([]);
  const cameraReadyRef = useRef(false);
  const scanSuccessRef = useRef(false);
  const processingRef = useRef(false);
  const loopTimeoutRef = useRef<any>(null);
  const bleTimeoutRef = useRef<any>(null);
  const matchCountRef = useRef(0);
  const lastMatchedEmpIdRef = useRef("");
  const lastScanTimeRef = useRef<number>(0);
  const verifyingNameRef = useRef("");
  const alreadyMarkedSuppressedRef = useRef<string | null>(null);

  const selectedStatusRef = useRef(getAutoStatus());

  useEffect(() => { latitudeRef.current = latitude; }, [latitude]);
  useEffect(() => { longitudeRef.current = longitude; }, [longitude]);
  useEffect(() => { locationReadyRef.current = locationReady; }, [locationReady]);
  useEffect(() => { bleVerifiedRef.current = bleVerified; }, [bleVerified]);
  useEffect(() => { bleDeviceNameRef.current = bleDeviceName; }, [bleDeviceName]);
  useEffect(() => { bleDeviceIdRef.current = bleDeviceId; }, [bleDeviceId]);
  useEffect(() => { allowedBeaconsRef.current = allowedBeacons; }, [allowedBeacons]);
  useEffect(() => { cameraReadyRef.current = cameraReady; }, [cameraReady]);
  useEffect(() => { scanSuccessRef.current = scanSuccess; }, [scanSuccess]);
  useEffect(() => { processingRef.current = processing; }, [processing]);
  useEffect(() => { matchCountRef.current = matchCount; }, [matchCount]);
  useEffect(() => { verifyingNameRef.current = verifyingName; }, [verifyingName]);

  useEffect(() => {
    selectedStatusRef.current = selectedStatus;
    alreadyMarkedSuppressedRef.current = null;
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
    if (!isSlotSelected) {
      setCameraReady(false);
      return;
    }
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
  }, [cameraMode, isSlotSelected]);

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

  // ── Scan loop ─────────────────────────────────────────────────────────────
  const scheduleNextScan = (delay: number, resetScanState = false) => {
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    loopTimeoutRef.current = setTimeout(() => {
      if (resetScanState) {
        setScanSuccess(false); scanSuccessRef.current = false;
        setScannedEmployee(null); setMessage("Align face to scan"); setStatusColor("#8b5cf6");
        setCapturedImg(null);
        setBleSignalStrength(null);
        detectedFacesRef.current = [];
        setActiveFaceCount(0);
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
    latestServerIdentitiesRef.current = [];
    detectedFacesRef.current = [];
    setActiveFaceCount(0);
    setShowSlotModal(true);
    scheduleNextScan(150);
  };

  const handleSlotSelect = async (slot: string) => {
    setSelectedStatus(slot);
    selectedStatusRef.current = slot;
    setIsSlotSelected(true);
    setShowSlotModal(false);
    alreadyMarkedSuppressedRef.current = null;
    logDebug(`Slot selected: ${slot}`);

    if (slot === "Permission Out" || slot === "Permission In") {
      const empId = userData?.empCode || userData?.EmpCode || "";
      if (empId) {
        try {
          setMessage(`Checking Permission Approval for ${empId}...`);
          setStatusColor("#3b82f6");
          const res = await fetch(`${API_BASE}Checkin/GetActivePermissionForToday?empId=${empId}`);
          if (res.ok) {
            const permData = await res.json();
            if (!permData.hasApprovedPermission) {
              setMessage("⚠️ No Approved Permission Found for Today");
              setStatusColor("#f59e0b");
              speakText("No approved permission request found for today. Please request permission first.");
            } else {
              setMessage(`✅ Approved Permission: ${permData.approvedMinutes}m (Return window calculated from OUT scan)`);
              setStatusColor("#10b981");
              speakText(`Permission approved for ${permData.approvedMinutes} minutes.`);
            }
          }
        } catch { }
      }
    }
  };

  const autoScan = async () => {
    if (showSlotModalRef.current || !isSlotSelectedRef.current) {
      scheduleNextScan(400);
      return;
    }
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
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx || !videoRef.current) {
        scheduleNextScan(150);
        return;
      }

      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const image = canvas.toDataURL("image/jpeg", 0.80);
      setCapturedImg(image);

      logDebug(`API POST: AISecurityAttendance Slot: ${selectedStatusRef.current}`);

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
          saveNeeded: true,
          status: selectedStatusRef.current
        })
      });
      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const eb = await response.json();
          errMsg = eb.message || errMsg;
        } catch { }
        throw new Error(errMsg);
      }
      const data = await response.json();
      logDebug(`API Res: success=${data.success}, msg=${data.message || ""}`);

      const newFaces = data.detectedFaces || data.matchedEmployees || [];
      latestServerIdentitiesRef.current = newFaces;
      detectedFacesRef.current = newFaces;
      setActiveFaceCount(newFaces.length);
      if (newFaces.length > 0) {
        lastDetectedFacesTimestampRef.current = Date.now();
      } else {
        setMatchCount(0);
        lastMatchedEmpIdRef.current = "";
        setVerifyingName("");
        if (!scanSuccessRef.current) {
          setMessage("Align face to scan");
          setStatusColor("#8b5cf6");
        }
      }

      // Clean expired entries from recent cooldown (older than 20 seconds)
      const nowTs = Date.now();
      recentlyMarkedEmpIdsRef.current.forEach((ts, id) => {
        if (nowTs - ts > 20000) recentlyMarkedEmpIdsRef.current.delete(id);
      });

      if (data.matchedEmployees && Array.isArray(data.matchedEmployees) && data.matchedEmployees.length > 0) {
        const firstEmp = data.matchedEmployees[0];
        const primaryEmpId = firstEmp?.empId || "";
        const currentSlotKey = `${primaryEmpId}_${selectedStatusRef.current}`;

        // Reset suppression if a different employee faces the camera
        if (alreadyMarkedSuppressedRef.current && !alreadyMarkedSuppressedRef.current.startsWith(primaryEmpId)) {
          alreadyMarkedSuppressedRef.current = null;
        }

        // Filter valid saved (excluding recently marked within 20s from duplicate popups)
        const validSaved = data.matchedEmployees.filter((e: any) => 
          e.alreadyMarked !== true && 
          e.invalidLocation !== true && 
          e.invalidTime !== true && 
          e.hasPermission !== false && 
          e.success !== false &&
          !recentlyMarkedEmpIdsRef.current.has(e.empId)
        );

        const allNames = data.matchedEmployees.map((e: any) => e.empName || e.empId).join(", ");
        const savedNames = validSaved.map((e: any) => e.empName || e.empId).join(", ");

        if (validSaved.length > 0) {
          // Register newly saved in recent map
          validSaved.forEach((e: any) => {
            if (e.empId) recentlyMarkedEmpIdsRef.current.set(e.empId, nowTs);
          });

          setMatchCount(2);
          setScanSuccess(true); scanSuccessRef.current = true;
          lastScanTimeRef.current = nowTs;
          alreadyMarkedSuppressedRef.current = currentSlotKey;

          setStatusColor("#10b981");
          const firstSaved = validSaved[0] || {};
          const displayTime = formatTime12H(firstSaved.time12 || firstSaved.time || data.time12 || data.time || new Date());
          const slotName = firstSaved.status || selectedStatusRef.current || "Morning In";

          setScannedEmployee({
            empName: savedNames,
            empId: validSaved.map((e: any) => e.empId).join(", "),
            status: slotName,
            time: displayTime,
            isDuplicate: false,
            customMessage: `✅ ${slotName} recorded successfully at ${displayTime}.`,
            confidence: firstSaved.confidence || 95,
            gpsDetails: buildGpsTelemetry(firstSaved, data)
          });
          setMessage(`✅ Verified (${validSaved.length}): ${savedNames}`);
          playSuccessChime();
          speakText(`Attendance marked for ${savedNames}`);

          startAutoDismissCountdown(3);
          return;
        }

        // If person was already marked recently in this session (e.g. still in camera view)
        const allAreRecentlyMarked = data.matchedEmployees.every((e: any) => 
          recentlyMarkedEmpIdsRef.current.has(e.empId) || (e.alreadyMarked === true && alreadyMarkedSuppressedRef.current === `${e.empId}_${selectedStatusRef.current}`)
        );

        if (allAreRecentlyMarked) {
          // Keep scanning continuously for next person in crowd without blocking
          scheduleNextScan(200);
          return;
        }

        const firstMatched = data.matchedEmployees[0] || {};
        const isInvalidLoc = firstMatched.invalidLocation === true || (firstMatched.message && (firstMatched.message.includes("Location") || firstMatched.message.includes("Bluetooth") || firstMatched.message.includes("Geofence")));
        const displayTime = formatTime12H(firstMatched.time12 || firstMatched.time || data.time12 || data.time || new Date());
        const slotName = firstMatched.status || selectedStatusRef.current || "Morning In";

        if (isInvalidLoc) {
          setMatchCount(0);
          lastMatchedEmpIdRef.current = "";
          setVerifyingName("");
          setStatusColor("#ef4444");
          const errMsg = firstMatched.message || "Location / Bluetooth presence verification failed.";

          setScannedEmployee({
            empName: allNames,
            empId: data.matchedEmployees.map((e: any) => e.empId).join(", "),
            status: slotName,
            time: displayTime,
            customMessage: `⛔ Location Restriction: ${errMsg}`,
            isDuplicate: true,
            confidence: firstMatched.confidence || 90,
            gpsDetails: buildGpsTelemetry(firstMatched, data)
          });
          setScanSuccess(true);
          scanSuccessRef.current = true;
          setMessage(`⛔ Location Restricted: ${allNames}`);
          speakText(errMsg);
          startAutoDismissCountdown(4);
          return;
        }

        const isNoPerm = firstMatched.hasPermission === false || (firstMatched.success === false && firstMatched.message && (firstMatched.message.includes("Permission") || firstMatched.message.includes("Lunch Out is permitted") || firstMatched.message.includes("Evening Out is permitted")));

        if (isNoPerm) {
          setStatusColor("#ef4444");
          const alertTitle = "Permission Required";
          const alertMsg = firstMatched.message || "No approved permission found for today to exit.";
          setScannedEmployee({
            empName: allNames,
            empId: data.matchedEmployees.map((e: any) => e.empId).join(", "),
            status: "Permission Required",
            time: displayTime,
            customMessage: `⛔ Approval Required: ${alertMsg}`,
            isDuplicate: true,
            confidence: firstMatched.confidence || 90,
            gpsDetails: buildGpsTelemetry(firstMatched, data)
          });
          setScanSuccess(true);
          scanSuccessRef.current = true;
          setMessage(`⛔ ${alertTitle}: ${allNames}`);
          speakText(alertMsg);
          startAutoDismissCountdown(3);
          return;
        } else {
          setStatusColor("#f59e0b");
          const alertMsg = firstMatched.message || `${slotName} was already marked at ${displayTime}`;
          setScannedEmployee({
            empName: allNames,
            empId: data.matchedEmployees.map((e: any) => e.empId).join(", "),
            status: slotName,
            time: displayTime,
            customMessage: `⚠️ ${slotName} was already recorded at ${displayTime}. You cannot punch again for this session.`,
            isDuplicate: true,
            confidence: firstMatched.confidence || 90,
            gpsDetails: buildGpsTelemetry(firstMatched, data)
          });
          setScanSuccess(true);
          scanSuccessRef.current = true;
          setMessage(`⚠️ ${slotName} Already Marked: ${allNames}`);
          speakText(`${allNames} ${slotName} already marked`);
          startAutoDismissCountdown(3);
          return;
        }
      }

      if (data.invalidLocation) {
        setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
        setStatusColor("#ef4444");
        const errMsg = data.message || "Outside Office Location";

        setScannedEmployee({
          empName: "Employee",
          empId: "",
          status: selectedStatusRef.current,
          time: formatTime12H(new Date()),
          customMessage: `⛔ Location Restriction: ${errMsg}`,
          isDuplicate: true,
          confidence: 90,
          gpsDetails: buildGpsTelemetry(undefined, data)
        });
        setScanSuccess(true);
        scanSuccessRef.current = true;
        setMessage(`⛔ ${errMsg}`);
        speakText(errMsg);
        startAutoDismissCountdown(4);
        return;
      }
      if (data.invalidTime) {
        setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
        setStatusColor("#ef4444");
        const errMsg = data.message || "Invalid Slot Time";
        setScannedEmployee({
          empName: "Employee",
          empId: "",
          status: selectedStatusRef.current,
          time: formatTime12H(new Date()),
          customMessage: `⛔ Timing Restriction: ${errMsg}`,
          isDuplicate: true,
          confidence: 90,
          gpsDetails: buildGpsTelemetry(undefined, data)
        });
        setScanSuccess(true);
        scanSuccessRef.current = true;
        setMessage(`⛔ ${errMsg}`);
        speakText(errMsg);
        startAutoDismissCountdown(3);
        return;
      }
      if (data.alreadyMarked) {
        setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
        if (data.empId && recentlyMarkedEmpIdsRef.current.has(data.empId)) {
          scheduleNextScan(200);
          return;
        }
        setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#f59e0b");
        const displayTime = formatTime12H(data.time12 || data.time || new Date());
        const slotName = data.status || selectedStatusRef.current || "Morning In";
        const empName = data.empName || "Employee";

        setScannedEmployee({
          empName: empName,
          empId: data.empId || "",
          status: slotName,
          isDuplicate: true,
          customMessage: `⚠️ ${slotName} was already recorded at ${displayTime}. You cannot punch again for this session.`,
          confidence: data.confidence || 95,
          time: displayTime,
          gpsDetails: buildGpsTelemetry(undefined, data)
        });
        setMessage(`⚠️ ${slotName} Already Marked: ${empName}`);
        speakText(`${empName} ${slotName} already marked`);

        startAutoDismissCountdown(3);
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
          scheduleNextScan(100);
        } else {
          const displayTime = formatTime12H(data.time12 || data.time || new Date());
          const slotName = data.status || selectedStatusRef.current || "Morning In";
          if (empId) recentlyMarkedEmpIdsRef.current.set(empId, Date.now());
          setMatchCount(3);
          setScanSuccess(true); scanSuccessRef.current = true; setStatusColor("#10b981");
          setScannedEmployee({
            empName,
            empId,
            status: slotName,
            time: displayTime,
            isDuplicate: false,
            customMessage: `✅ ${slotName} recorded successfully at ${displayTime}.`,
            confidence: data.confidence || 98,
            gpsDetails: buildGpsTelemetry(undefined, data)
          });
          setMessage(`✅ Verified: ${empName}`); speakText(`${empName} attendance marked successfully`);
          setVerifyingName(""); lastMatchedEmpIdRef.current = "";

          setTimeout(() => {
            resetScannerAndResume();
          }, 800);
        }
      } else {
        setMatchCount(0); lastMatchedEmpIdRef.current = ""; setVerifyingName("");
        if (!data.matchedEmployees || data.matchedEmployees.length === 0) {
          setScannedEmployee(null);
          alreadyMarkedSuppressedRef.current = null;
          setStatusColor("#8b5cf6"); setMessage("Align face to scan");
        } else {
          setStatusColor("#ef4444"); setMessage("❌ " + (data.message || "Face Not Recognized"));
        }
        scheduleNextScan(400);
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
            grid-template-columns: repeat(6, 1fr);
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
              grid-template-columns: repeat(3, 1fr) !important;
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
          .status-btn.slot-perm-out.active {
            background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 2px 8px rgba(225, 29, 72, 0.25) !important;
            border-color: #e11d48 !important;
          }
          .status-btn.slot-perm-in.active {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25) !important;
            border-color: #2563eb !important;
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
          .status-btn.slot-perm-out:not(.active):hover {
            background: rgba(225, 29, 72, 0.05);
            color: #e11d48;
            border-color: rgba(225, 29, 72, 0.25);
          }
          .status-btn.slot-perm-in:not(.active):hover {
            background: rgba(37, 99, 235, 0.05);
            color: #2563eb;
            border-color: rgba(37, 99, 235, 0.25);
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

        <div className="sc-kiosk-page-container">

          {/* ── Premium Native Header ── */}
          <div className="sc-top-nav">
            <div className="sc-top-nav-left">
              <button className="sc-top-nav-back-btn" onClick={() => history.goBack()} title="Go Back">
                <IonIcon icon={arrowBackOutline} style={{ color: "white" }} />
              </button>
              <div className="sc-top-nav-title-wrap">
                <h1 className="sc-top-nav-title">Security Kiosk</h1>
                <p className="sc-top-nav-subtitle">Biometric Face Verification</p>
              </div>
            </div>
            <div className="sc-top-nav-right">
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
                onClick={() => history.push('/ai-attendance-log/security')}
                title="View Attendance Logs"
              >
                <IonIcon icon={calendarOutline} />
              </button>
            </div>
          </div>

          {/* ── CENTERED KIOSK TERMINAL SCANNER ── */}
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
                    <span className="sc-kiosk-slot-label">Target: <strong>{getSlotColorConfig(selectedStatus).label}</strong></span>
                  </div>
                  <span className="sc-kiosk-change-badge">🔄 Switch Slot</span>
                </button>
              </div>

              <div className="sc-kiosk-tb-row2">
                <div
                  className="sc-kiosk-status-pill"
                  style={{
                    background: cooldownCountdown > 0 ? '#f59e0b15' : `${statusColor}15`,
                    color: cooldownCountdown > 0 ? '#f59e0b' : statusColor,
                    borderColor: cooldownCountdown > 0 ? '#f59e0b40' : `${statusColor}40`
                  }}
                >
                  <span className="sc-dot" style={{ background: cooldownCountdown > 0 ? '#f59e0b' : statusColor }} />
                  <span>
                    {cooldownCountdown > 0
                      ? `RESUMING IN ${cooldownCountdown}S...`
                      : processing
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
                  <div className={`sc-ind ${locationReady ? 'ind-ok' : 'ind-wait'}`}>
                    <IonIcon icon={pinOutline} />
                    <span>{locationReady ? 'GPS OK' : 'GPS Fix…'}</span>
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
                    <span>{bleVerified ? 'Beacon OK' : bleSignalStrength !== null && bleSignalStrength < -80 ? 'BLE Weak' : 'Beacon…'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Centered Camera Viewport */}
            <div className="sc-kiosk-camera-box">
              <video ref={videoRef} autoPlay playsInline muted className="sc-video" />
              <canvas ref={overlayCanvasRef} className="sc-overlay-canvas" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} />

              <div className="sc-hud">
                <div className={`sc-fixed-guide-target state-${scanSuccess ? 'success' : processing ? 'aligned is-scanning' : guidanceState === 'aligned' ? 'aligned' : guidanceState === 'idle' ? 'idle' : 'warning'}`}>
                  {/* Outer slow-rotating calibration dial */}
                  <div className="sc-fixed-dial-outer" />

                  {/* Fixed Biometric Frame */}
                  <div className="sc-fixed-frame" />

                  {/* Precision Corner Brackets */}
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

                {/* Live HUD Guidance Pill */}
                {!scanSuccess && (
                  <div className={`sc-hud-guidance-pill pill-${processing ? 'aligned' : guidanceState}`}>
                    <span>{processing ? '⚡ Hold still, analyzing face...' : guidanceText}</span>
                  </div>
                )}
              </div>

              {!cameraReady && (
                <div className="sc-cam-loader" style={{ background: '#090d16' }}>
                  <div className="tech-loader">
                    <div className="tech-ring-1" />
                    <div className="tech-ring-2" />
                    <div className="tech-ring-3" />
                    <div className="tech-center" />
                  </div>
                  <p style={{ color: '#a78bfa', marginTop: '16px', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                    INITIALIZING BIOMETRIC KIOSK CAMERA…
                  </p>
                </div>
              )}

              {cameraReady && (
                <div className="sc-kiosk-cam-actions">
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
                </div>
              )}
            </div>

            {/* 3. Bottom Telemetry & Status Bar */}
            <div className="sc-kiosk-footer-info">
              <div className="sc-kiosk-info-card">
                <div className="sc-kiosk-info-icon">🛡️</div>
                <div className="sc-kiosk-info-text">
                  <div className="sc-kiosk-info-title">{userData ? `${userData.empName || userData.EmpName}` : 'Security Gate Officer'}</div>
                  <div className="sc-kiosk-info-subtitle">Emp Code #{userData?.empCode || userData?.EmpCode || 'KIOSK-01'}</div>
                </div>
              </div>
              <div className="sc-kiosk-info-card">
                <div className="sc-kiosk-info-icon">📍</div>
                <div className="sc-kiosk-info-text">
                  <div className="sc-kiosk-info-title">{locationReady ? 'Geofence Active' : 'Locating GPS...'}</div>
                  <div className="sc-kiosk-info-subtitle">Branch Office Biometrics</div>
                </div>
              </div>
              <div className="sc-kiosk-info-card">
                <div className="sc-kiosk-info-icon">⏱️</div>
                <div className="sc-kiosk-info-text">
                  <div className="sc-kiosk-info-title">Active Slot: {selectedStatus}</div>
                  <div className="sc-kiosk-info-subtitle">Auto Shift Timings Verified</div>
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
                    <div className="slot-hub-icon-wrap">🛡️</div>
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
                    {/* <span>Rules</span> */}
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
                        <span className="rule-text">Allowed up to <strong>{getPolVal('ApprovedExcessPermissionMinutes', '180')} min</strong> beyond allotted P_Time subject to available permission balance (overtime/carryover).</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag" style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}>1x LOP</span>
                        <span className="rule-text">Excess up to <strong>{getPolVal('SingleLopExcessMinutes', '120')} min</strong> without balance attracts <strong>Single Loss of Pay (1x LOP)</strong>.</span>
                      </li>
                      <li className="rule-item">
                        <span className="rule-tag" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>2x Double LOP</span>
                        <span className="rule-text">Excess &gt; <strong>{getPolVal('DoubleLopExcessMinutes', '120')} min</strong> without balance attracts <strong>Double Loss of Pay (Double LOP / 2x LOP)</strong> (allotted permission time is also included in deduction).</span>
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
                        <span className="rule-text">Issued for every <strong>{getPolVal('YellowSlipExcessFrequency', '3')} excess permission sessions</strong> without available balance.</span>
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

          {/* BIOMETRIC ATTENDANCE POPUP OVERLAY */}
          {scanSuccess && scannedEmployee && createPortal(
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
                    background: !scannedEmployee.isDuplicate
                      ? '#ecfdf5'
                      : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
                        ? '#fee2e2'
                        : '#fef3c7'),
                    color: !scannedEmployee.isDuplicate
                      ? '#047857'
                      : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
                        ? '#b91c1c'
                        : '#b45309'),
                    border: `1px solid ${!scannedEmployee.isDuplicate
                      ? '#a7f3d0'
                      : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
                        ? '#fecdd3'
                        : '#fde68a')}`
                  }}
                >
                  <IonIcon
                    icon={!scannedEmployee.isDuplicate ? checkmarkCircleOutline : alertCircleOutline}
                    style={{ fontSize: '15px' }}
                  />
                  <span>
                    {!scannedEmployee.isDuplicate
                      ? 'VERIFIED ATTENDANCE'
                      : (scannedEmployee.customMessage?.includes('already recorded')
                        ? 'ALREADY RECORDED TODAY'
                        : 'ATTENDANCE ALERT')}
                  </span>
                </div>

                {/* 2. Photo with Glowing Ring */}
                <div className="sc-modal-photo-wrap">
                  <div
                    className={`sc-modal-photo-ring ${
                      !scannedEmployee.isDuplicate
                        ? 'ring-ok'
                        : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
                          ? 'ring-error'
                          : 'ring-warn')
                    }`}
                  >
                    {capturedImg ? (
                      <img src={capturedImg} alt="Face Snapshot" className="sc-modal-photo-img" />
                    ) : (
                      <div className="sc-modal-photo-img sc-modal-photo-fallback">
                        {(scannedEmployee.empName || 'E').charAt(0)}
                      </div>
                    )}
                  </div>
                  <div
                    className="sc-modal-photo-badge"
                    style={{
                      background: !scannedEmployee.isDuplicate
                        ? '#10b981'
                        : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
                          ? '#ef4444'
                          : '#f59e0b')
                    }}
                  >
                    <IonIcon icon={!scannedEmployee.isDuplicate ? checkmarkCircleOutline : alertCircleOutline} />
                  </div>
                </div>

                {/* 3. Employee Name & ID (Rendered ONLY ONCE, Bold & Clean) */}
                <h2 className="sc-modal-emp-name">{scannedEmployee.empName}</h2>
                <div className="sc-modal-emp-id-wrap">
                  <span className="sc-modal-emp-id">ID: #{scannedEmployee.empId}</span>
                </div>

                {/* 4. Primary Highlight Status Banner */}
                <div
                  className="sc-modal-status-banner"
                  style={{
                    background: !scannedEmployee.isDuplicate
                      ? '#f0fdf4'
                      : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
                        ? '#fef2f2'
                        : '#fffbeb'),
                    color: !scannedEmployee.isDuplicate
                      ? '#166534'
                      : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
                        ? '#991b1b'
                        : '#92400e'),
                    border: `1px solid ${!scannedEmployee.isDuplicate
                      ? '#bbf7d0'
                      : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
                        ? '#fecdd3'
                        : '#fde68a')}`
                  }}
                >
                  <div className="sc-modal-status-banner-text">
                    {scannedEmployee.customMessage || (
                      !scannedEmployee.isDuplicate
                        ? `✅ ${scannedEmployee.status} marked successfully.`
                        : `⚠️ ${scannedEmployee.status} was already marked.`
                    )}
                  </div>
                </div>

                {/* 5. Metrics Tiles (Slot, Punch Time, Face Match) */}
                <div className="sc-modal-metrics-row">
                  <div className="sc-modal-metric-card">
                    <span className="sc-modal-metric-label">Slot</span>
                    <span className="sc-modal-metric-value" style={{ color: getSlotColorConfig(scannedEmployee.status).color }}>
                      {getSlotColorConfig(scannedEmployee.status).label}
                    </span>
                  </div>

                  <div className="sc-modal-metric-card">
                    <span className="sc-modal-metric-label">Time</span>
                    <span className="sc-modal-metric-value" style={{ color: '#0f172a' }}>
                      {scannedEmployee.time}
                    </span>
                  </div>

                  <div className="sc-modal-metric-card">
                    <span className="sc-modal-metric-label">Face Match</span>
                    <span className="sc-modal-metric-value" style={{ color: '#4f46e5' }}>
                      {scannedEmployee.confidence || 98}%
                    </span>
                  </div>
                </div>

                {/* 5b. GPS & Telemetry Comparison Card (Actual GPS vs Present GPS) */}
                {scannedEmployee.gpsDetails && (
                  <div className="sc-modal-gps-card">
                    <div className="sc-modal-gps-header">
                      <span className="sc-modal-gps-title">📍 Location &amp; Telemetry</span>
                      {scannedEmployee.gpsDetails.distance && (
                        <span className="sc-modal-gps-badge-distance">
                          {scannedEmployee.gpsDetails.distance}
                        </span>
                      )}
                    </div>

                    <div className="sc-modal-gps-grid">
                      {/* Office Target */}
                      <div className="sc-modal-gps-col">
                        <span className="sc-modal-gps-label">🏢 Target Office</span>
                        <span className="sc-modal-gps-value-bold">
                          {scannedEmployee.gpsDetails.actualOfficeName || "Office Geofence"}
                        </span>
                        <span className="sc-modal-gps-coords">
                          {scannedEmployee.gpsDetails.actualGps || "HQ Geofence"}
                        </span>
                        {scannedEmployee.gpsDetails.allowedRadius && (
                          <span className="sc-modal-gps-subtag">
                            {scannedEmployee.gpsDetails.allowedRadius}
                          </span>
                        )}
                      </div>

                      {/* Device Present GPS */}
                      <div className="sc-modal-gps-col">
                        <span className="sc-modal-gps-label">📱 Present GPS</span>
                        <span className="sc-modal-gps-value-bold" style={{ color: scannedEmployee.gpsDetails.gpsMatched ? '#047857' : '#dc2626' }}>
                          Device Location
                        </span>
                        <span className="sc-modal-gps-coords">
                          {scannedEmployee.gpsDetails.presentGps || "Locating..."}
                        </span>
                        <span
                          className="sc-modal-gps-subtag"
                          style={{
                            color: scannedEmployee.gpsDetails.gpsMatched ? '#047857' : '#b91c1c',
                            background: scannedEmployee.gpsDetails.gpsMatched ? '#ecfdf5' : '#fee2e2',
                            borderColor: scannedEmployee.gpsDetails.gpsMatched ? '#a7f3d0' : '#fca5a5'
                          }}
                        >
                          {scannedEmployee.gpsDetails.gpsMatched ? 'Inside Geofence' : 'Outside Geofence'}
                        </span>
                      </div>
                    </div>

                    {/* Telemetry Status: GPS & Bluetooth */}
                    <div className="sc-modal-gps-telemetry-row">
                      <div className="sc-modal-gps-telem-item">
                        <span className="sc-modal-gps-telem-name">GPS Geofence:</span>
                        <span className={`sc-modal-gps-telem-status ${scannedEmployee.gpsDetails.gpsMatched ? 'status-pass' : 'status-fail'}`}>
                          {scannedEmployee.gpsDetails.gpsMatched ? '✅ IN RADIUS' : '❌ OUTSIDE RADIUS'}
                        </span>
                      </div>

                      {scannedEmployee.gpsDetails.bluetoothRequired && (
                        <div className="sc-modal-gps-telem-item">
                          <span className="sc-modal-gps-telem-name">Bluetooth:</span>
                          <span className={`sc-modal-gps-telem-status ${scannedEmployee.gpsDetails.bluetoothMatched ? 'status-pass' : 'status-fail'}`}>
                            {scannedEmployee.gpsDetails.bluetoothMatched ? '✅ DETECTED' : '❌ NOT FOUND'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Google Maps Distance Link */}
                    {scannedEmployee.gpsDetails.actualGps && scannedEmployee.gpsDetails.presentGps && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(scannedEmployee.gpsDetails.presentGps.replace(/\s+/g, ''))}&destination=${encodeURIComponent(scannedEmployee.gpsDetails.actualGps.replace(/\s+/g, ''))}`}
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
                    background: !scannedEmployee.isDuplicate
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : (scannedEmployee.customMessage?.includes('Location') || scannedEmployee.customMessage?.includes('Approval') || scannedEmployee.customMessage?.includes('Timing')
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

export default SecurityAttendanceScanner;
