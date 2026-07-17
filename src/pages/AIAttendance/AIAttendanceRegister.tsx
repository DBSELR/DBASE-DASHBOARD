import { IonContent, IonPage, IonSpinner, IonIcon } from '@ionic/react';
import { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router';
import { 
  arrowBackOutline, 
  cameraOutline, 
  checkmarkCircleOutline, 
  alertCircleOutline, 
  personOutline, 
  idCardOutline, 
  shieldCheckmarkOutline,
  lockClosedOutline,
  volumeHighOutline
} from 'ionicons/icons';
import { AI_API_KEY } from './ai_config';
import { API_BASE } from "../../config";

const POSES = [
  { key: 'straight', label: 'Look Straight', voice: 'Please look straight at the camera.' },
  { key: 'left', label: 'Turn Left', voice: 'Please turn your head slightly left.' },
  { key: 'right', label: 'Turn Right', voice: 'Please turn your head slightly right.' },
  { key: 'up', label: 'Tilt Up', voice: 'Please tilt your head slightly up.' },
  { key: 'down', label: 'Tilt Down', voice: 'Please tilt your head slightly down.' }
];

const AIAttendanceRegister: React.FC = () => {
  const renderStraightSvg = () => (
    <svg viewBox="0 0 100 100" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M50 15 C32 15 28 25 28 45 C28 65 32 75 50 75 C68 75 72 65 72 45 C72 25 68 15 50 15 Z" />
      <path d="M40 73 L40 85 M60 73 L60 85" strokeWidth="2.5" />
      <circle cx="41" cy="42" r="1.5" fill="#6366f1" />
      <circle cx="59" cy="42" r="1.5" fill="#6366f1" />
      <path d="M50 42 L50 50 L53 50" strokeWidth="2.5" />
      <path d="M44 60 Q50 63 56 60" strokeWidth="2.5" />
    </svg>
  );

  const renderLeftSvg = () => (
    <svg viewBox="0 0 100 100" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M53 15 C35 15 32 25 32 45 C32 65 35 75 53 75 C63 75 67 70 67 45 C67 20 63 15 53 15 Z" />
      <path d="M67 40 C70 40 72 43 72 46 C72 49 70 52 67 52" />
      <circle cx="41" cy="42" r="1.5" fill="#6366f1" />
      <path d="M32 45 L22 48 L32 51" strokeWidth="2.5" />
      <path d="M36 60 Q40 61 44 60" strokeWidth="2.5" />
      <path d="M86 45 L74 45 M74 45 L79 40 M74 45 L79 50" strokeWidth="3" />
    </svg>
  );

  const renderRightSvg = () => (
    <svg viewBox="0 0 100 100" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M47 15 C37 15 33 20 33 45 C33 70 37 75 47 75 C65 75 68 65 68 45 C68 25 65 15 47 15 Z" />
      <path d="M33 40 C30 40 28 43 28 46 C28 49 30 52 33 52" />
      <circle cx="59" cy="42" r="1.5" fill="#6366f1" />
      <path d="M68 45 L78 48 L68 51" strokeWidth="2.5" />
      <path d="M56 60 Q60 61 64 60" strokeWidth="2.5" />
      <path d="M14 45 L26 45 M26 45 L21 40 M26 45 L21 50" strokeWidth="3" />
    </svg>
  );

  const renderUpSvg = () => (
    <svg viewBox="0 0 100 100" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M50 12 C32 12 28 22 28 42 C28 62 32 72 50 72 C68 72 72 62 72 42 C72 22 68 12 50 12 Z" />
      <path d="M42 68 L42 80 M58 68 L58 80" strokeWidth="2.5" />
      <circle cx="41" cy="33" r="1.5" fill="#6366f1" />
      <circle cx="59" cy="33" r="1.5" fill="#6366f1" />
      <path d="M50 33 L50 40 L53 39" strokeWidth="2.5" />
      <path d="M44 54 Q50 57 56 54" strokeWidth="2.5" />
      <path d="M50 88 L50 78 M50 78 L45 83 M50 78 L55 83" strokeWidth="3" />
    </svg>
  );

  const renderDownSvg = () => (
    <svg viewBox="0 0 100 100" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M50 18 C32 18 28 28 28 48 C28 68 32 78 50 78 C68 78 72 68 72 48 C72 28 68 18 50 18 Z" />
      <path d="M42 74 L42 86 M58 74 L58 86" strokeWidth="2.5" />
      <circle cx="41" cy="49" r="1.5" fill="#6366f1" />
      <circle cx="59" cy="49" r="1.5" fill="#6366f1" />
      <path d="M50 49 L50 61 L53 59" strokeWidth="2.5" />
      <path d="M44 67 Q50 70 56 67" strokeWidth="2.5" />
      <path d="M50 12 L50 22 M50 22 L45 17 M50 22 L55 17" strokeWidth="3" />
    </svg>
  );

  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const history = useHistory();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Pose states
  const [currentPoseIndex, setCurrentPoseIndex] = useState<number>(-1); // -1 = idle, 0-4 = active, -2 = completed
  const [countdown, setCountdown] = useState<number>(0);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isValidatingPose, setIsValidatingPose] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUserData(parsed);
      setEmpId(parsed?.empCode || "");
      setName(parsed?.EmpName || parsed?.empName || "");
    }
  }, []);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Speaks instructions to employee
  const speakInstruction = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis failed", e);
    }
  };

  const showPopup = (msg: string) => {
    setPopupMessage(msg);
    setTimeout(() => {
      setPopupMessage('');
    }, 4500);
  };

  // Start enrollment capture sequence
  const startEnrollment = async () => {
    setCameraError(null);
    setCapturedPhotos({});
    setIsCameraLoading(true);
    setCurrentPoseIndex(-1);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera device access is not supported by your browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        },
        audio: false
      });
      
      streamRef.current = stream;
      setCameraActive(true);
      setIsCameraLoading(false);
      setCurrentPoseIndex(0); // Trigger first pose

      // Slight timeout to let the DOM paint and ensure videoRef is bound to the element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => {
            console.error("Video playback start failed:", err);
          });
        }
      }, 80);

    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError(err.message || "Failed to start camera. Please verify permissions.");
      setCameraActive(false);
      setIsCameraLoading(false);
    }
  };

  // Stop camera feed
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsCameraLoading(false);
  };

  // Handle pose changes and speak guidance
  useEffect(() => {
    if (currentPoseIndex >= 0 && currentPoseIndex < 5 && cameraActive) {
      speakInstruction(POSES[currentPoseIndex].voice);
      setCountdown(3);
    }
  }, [currentPoseIndex, cameraActive]);

  // Countdown timer logic
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && currentPoseIndex >= 0 && currentPoseIndex < 5 && cameraActive) {
      capturePosePhoto();
    }
  }, [countdown]);

  // Capture frame for current pose and validate in real-time
  const capturePosePhoto = async () => {
    if (!videoRef.current || !cameraActive || isValidatingPose) return;
    setIsValidatingPose(true);
    try {
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;
      
      const canvas = document.createElement("canvas");
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        const photoData = canvas.toDataURL("image/jpeg", 0.95);
        const currentKey = POSES[currentPoseIndex].key;

        // Call backend real-time pose validation API
        const response = await fetch(`${API_BASE}Checkin/ValidateFacePose`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "dbase-ai-master-key-2026"
          },
          body: JSON.stringify({
            Image: photoData,
            ExpectedPose: currentKey
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          // Pose verified successfully!
          setCapturedPhotos(prev => ({
            ...prev,
            [currentKey]: photoData
          }));

          // Flash visual cue
          const scannerFrame = document.querySelector(".scanner-frame");
          if (scannerFrame) {
            scannerFrame.classList.add("flash-shutter");
            setTimeout(() => scannerFrame.classList.remove("flash-shutter"), 180);
          }

          speakInstruction("Correct");

          if (currentPoseIndex < 4) {
            setCurrentPoseIndex(prev => prev + 1);
          } else {
            stopCamera();
            setCurrentPoseIndex(-2); // Enrollment Poses Finished
            speakInstruction("Perfect! All poses captured correctly. Please submit to complete your enrollment.");
          }
        } else {
          // Pose was incorrect! Show correction toast, speak it, and restart countdown
          showPopup(result.message || "Incorrect pose. Please try again.");
          speakInstruction(result.message || "Incorrect pose. Please follow the guidance.");
          
          // Restart countdown for the SAME pose
          setTimeout(() => {
            setCountdown(3);
          }, 1500);
        }
      }
    } catch (err: any) {
      console.error("Capture and validate pose failed:", err);
      showPopup("Verification failed: " + (err.message || "Connection error"));
      
      // Retry same pose
      setTimeout(() => {
        setCountdown(3);
      }, 2000);
    } finally {
      setIsValidatingPose(false);
    }
  };

  const resetEnrollment = () => {
    stopCamera();
    setCapturedPhotos({});
    setCurrentPoseIndex(-1);
    setCountdown(0);
    setCameraError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showPopup('Employee name is required.');
      return;
    }
    if (Object.keys(capturedPhotos).length < 5) {
      showPopup('Please register all 5 face poses.');
      return;
    }

    setIsProcessing(true);

    const formData = new FormData();
    const finalName = empId.trim() ? `${name.trim()} (${empId.trim()})` : name.trim();
    formData.append('name', finalName);

    try {
      // Append all 5 poses
      for (const pose of POSES) {
        const photoData = capturedPhotos[pose.key];
        const res = await fetch(photoData);
        const blob = await res.blob();
        const file = new File([blob], `face_${pose.key}.jpg`, { type: 'image/jpeg' });
        formData.append("images[]", file);
      }

      const response = await fetch(`${API_BASE}Checkin/UploadModel`, {
        method: 'POST',
        headers: {
          'x-api-key': AI_API_KEY
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMessage("Your biometric profile has been successfully registered with 5 multi-angle references.");
        setShowSuccessPopup(true);
      } else {
        showPopup(data.message || "Face registration failed");
      } 
    } catch (error: any) {
      console.error(error);
      showPopup(error.message || 'Server connection failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen style={{ "--background": "#ffffff" }}>
        {/* Style block for premium white dashboard and visual animations */}
        <style>{`
          .white-bg-visuals {
            background-color: #ffffff;
            background-image: 
              radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.02) 0%, transparent 25%),
              radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.02) 0%, transparent 30%),
              radial-gradient(#e2e8f0 1.2px, transparent 1.2px);
            background-size: cover, cover, 24px 24px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px 16px;
            box-sizing: border-box;
          }

          .dashboard-container {
            width: 100%;
            max-width: 1100px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(226, 232, 240, 0.8);
            border-radius: 32px;
            overflow: hidden;
            box-shadow: 0 25px 60px rgba(99, 102, 241, 0.05), 0 2px 8px rgba(0, 0, 0, 0.01);
            position: relative;
            box-sizing: border-box;
          }

          .header-banner {
            padding: 32px 40px;
            background: linear-gradient(135deg, rgba(99,102,241,0.02) 0%, rgba(168,85,247,0.02) 100%);
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
          }

          .back-btn {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.02);
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            color: #475569;
          }
          .back-btn:hover {
            border-color: #cbd5e1;
            transform: translateY(-1px);
            color: #0f172a;
          }

          .enrollment-grid {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 40px;
            padding: 40px;
            box-sizing: border-box;
          }

          .scanner-frame {
            position: relative;
            width: 100%;
            height: 380px;
            background: #f8fafc;
            border-radius: 24px;
            overflow: hidden;
            border: 2px solid #e2e8f0;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.02);
            transition: all 0.3s;
          }
          .scanner-frame.active-scan {
            border-color: #6366f1;
            box-shadow: 0 0 25px rgba(99, 102, 241, 0.15);
          }

          .flash-shutter {
            animation: shutter-flash-anim 0.18s ease-out;
          }
          @keyframes shutter-flash-anim {
            0% { filter: brightness(2); }
            100% { filter: brightness(1); }
          }

          /* AI Cyber Focus Corners */
          .cyber-corner {
            position: absolute;
            width: 24px;
            height: 24px;
            border-color: #6366f1;
            border-style: solid;
            pointer-events: none;
            z-index: 15;
            transition: border-color 0.3s;
          }
          .scanner-frame.active-scan .cyber-corner {
            border-color: #6366f1;
          }
          .cyber-corner.top-left { top: 16px; left: 16px; border-width: 3px 0 0 3px; border-top-left-radius: 8px; }
          .cyber-corner.top-right { top: 16px; right: 16px; border-width: 3px 3px 0 0; border-top-right-radius: 8px; }
          .cyber-corner.bottom-left { bottom: 16px; left: 16px; border-width: 0 0 3px 3px; border-bottom-left-radius: 8px; }
          .cyber-corner.bottom-right { bottom: 16px; right: 16px; border-width: 0 3px 3px 0; border-bottom-right-radius: 8px; }

          /* Interactive scan beam line */
          .cyber-beam {
            position: absolute;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, #6366f1, transparent);
            box-shadow: 0 0 12px #6366f1;
            z-index: 10;
            animation: beamMove 3.5s infinite linear;
          }
          @keyframes beamMove {
            0% { top: 5%; }
            50% { top: 95%; }
            100% { top: 5%; }
          }

          .scan-guide-oval {
            width: 210px;
            height: 270px;
            border-radius: 50% / 45%;
            border: 2px dashed rgba(99, 102, 241, 0.45);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 0 9999px rgba(255, 255, 255, 0.45);
            z-index: 5;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .pose-outline-guide {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 170px;
            height: 170px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.28;
            z-index: 6;
            pointer-events: none;
            transition: all 0.3s ease;
          }
          .pose-outline-guide svg {
            width: 100%;
            height: 100%;
            filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.4));
          }
          @media (min-width: 320px) and (max-width: 480px) {
            .pose-outline-guide {
              width: 110px;
              height: 110px;
            }
          }

          .countdown-circle {
            width: 76px;
            height: 76px;
            border-radius: 50%;
            background: rgba(99, 102, 241, 0.95);
            color: #ffffff;
            font-size: 2.2rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
            animation: pop-pulse 1s infinite alternate;
            z-index: 10;
          }
          @keyframes pop-pulse {
            0% { transform: scale(0.9); }
            100% { transform: scale(1.05); }
          }

          .status-instruction-pill {
            position: absolute;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 10px 24px;
            border-radius: 30px;
            font-size: 0.92rem;
            font-weight: 750;
            color: #0f172a;
            box-shadow: 0 8px 20px rgba(0,0,0,0.06);
            z-index: 12;
            text-align: center;
            width: max-content;
            max-width: 80%;
            letter-spacing: 0.3px;
          }

          .pose-thumb-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 12px;
            margin-top: 16px;
          }

          .pose-thumb-card {
            border: 1px solid #e2e8f0;
            background: #ffffff;
            border-radius: 12px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.01);
          }
          .pose-thumb-card.active {
            border-color: #6366f1;
            background: rgba(99, 102, 241, 0.02);
            box-shadow: 0 0 10px rgba(99,102,241,0.15);
          }
          .pose-thumb-card.success {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.02);
          }

          .pose-thumb-image {
            width: 100%;
            aspect-ratio: 1;
            border-radius: 8px;
            object-fit: cover;
            background: #f1f5f9;
          }
          .pose-thumb-placeholder {
            width: 100%;
            aspect-ratio: 1;
            border-radius: 8px;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
          }
          .pose-thumb-label {
            font-size: 0.65rem;
            font-weight: 700;
            color: #64748b;
            margin-top: 6px;
            text-align: center;
            white-space: nowrap;
          }

          .btn-voice-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 8px 14px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 650;
            color: #475569;
            cursor: pointer;
            transition: all 0.15s;
          }
          .btn-voice-toggle.active {
            border-color: #6366f1;
            color: #6366f1;
            background: rgba(99,102,241,0.02);
            animation: voicePulse 2.5s infinite;
          }
          @keyframes voicePulse {
            0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.2); }
            70% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
            100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
          }

          .btn-enroll-start {
            width: 100%;
            height: 56px;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: #ffffff;
            font-size: 1.05rem;
            font-weight: 700;
            border: none;
            border-radius: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 10px 25px rgba(99, 102, 241, 0.22);
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .btn-enroll-start:hover {
            transform: translateY(-1.5px);
            box-shadow: 0 12px 30px rgba(99, 102, 241, 0.3);
          }

          .btn-enroll-reset {
            background: #ffffff;
            border: 1.5px solid #cbd5e1;
            color: #475569;
            height: 52px;
            border-radius: 14px;
            font-size: 0.95rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
            width: 100%;
          }
          .btn-enroll-reset:hover {
            background: #f8fafc;
            border-color: #94a3b8;
          }

          .btn-enroll-submit {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            height: 52px;
            border-radius: 14px;
            font-size: 0.95rem;
            font-weight: 700;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
            width: 100%;
            box-shadow: 0 8px 20px rgba(16, 185, 129, 0.2);
          }
          .btn-enroll-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 24px rgba(16, 185, 129, 0.28);
          }

          .rules-alert {
            background: rgba(99, 102, 241, 0.03);
            border: 1px solid rgba(99, 102, 241, 0.1);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 24px;
          }

          .popup-toast {
            position: fixed;
            top: 30px;
            right: 30px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            color: #1e293b;
            padding: 16px 24px;
            border-radius: 16px;
            z-index: 99999;
            box-shadow: 0 10px 25px rgba(0,0,0,0.08);
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            max-width: calc(100% - 40px);
            box-sizing: border-box;
          }

          .employee-info-card {
            background: rgba(251, 252, 254, 0.8);
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 24px;
            box-sizing: border-box;
          }

          .detail-label {
            color: #64748b;
            font-weight: 700;
            font-size: 0.78rem;
            margin-bottom: 6px;
            display: block;
          }

          .detail-value {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 14px 16px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            color: #334155;
            font-size: 0.95rem;
            font-weight: 650;
            box-sizing: border-box;
          }

          .guidelines-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 24px;
            box-sizing: border-box;
          }

          .section-title {
            margin: 0 0 18px 0;
            color: #1e293b;
            font-size: 1.05rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          /* ── RESPONSIVE MEDIA QUERIES FROM 320PX ONWARDS ── */
          
          /* Ultra small / Small Phones (320px to 480px) */
          @media (min-width: 320px) and (max-width: 480px) {
            .white-bg-visuals {
              padding: 12px 8px;
              align-items: flex-start;
              background-size: cover, cover, 18px 18px;
            }
            .dashboard-container {
              border-radius: 20px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.03);
            }
            .header-banner {
              padding: 20px 14px;
              flex-direction: column;
              align-items: flex-start;
              gap: 12px;
            }
            .back-btn {
              width: 38px;
              height: 38px;
              border-radius: 10px;
            }
            .register-title {
              font-size: 1.2rem;
              font-weight: 800;
            }
            .register-subtitle {
              font-size: 0.72rem;
              margin-top: 4px;
              line-height: 1.35;
            }
            .btn-voice-toggle {
              padding: 6px 10px;
              font-size: 0.72rem;
              border-radius: 8px;
            }
            .register-secure-badge {
              padding: 5px 8px;
              border-radius: 8px;
              font-size: 0.72rem;
            }
            .enrollment-grid {
              grid-template-columns: 1fr;
              gap: 20px;
              padding: 16px 12px;
            }
            .employee-info-card {
              padding: 14px;
              border-radius: 16px;
            }
            .employee-info-card .detail-grid-override {
              grid-template-columns: 1fr !important; /* Stack columns */
              gap: 12px !important;
            }
            .detail-value {
              padding: 10px 12px;
              font-size: 0.85rem;
              border-radius: 10px;
            }
            .guidelines-card {
              padding: 14px;
              border-radius: 16px;
            }
            .rules-alert {
              padding: 12px;
              margin-bottom: 16px;
            }
            .pose-thumb-grid {
              grid-template-columns: repeat(3, 1fr) !important; /* Wrap to 3 columns on small screens */
              gap: 8px;
            }
            .pose-thumb-card {
              padding: 6px;
              border-radius: 10px;
            }
            .pose-thumb-label {
              font-size: 0.58rem;
              margin-top: 4px;
            }
            .scanner-frame {
              height: 260px;
              border-radius: 16px;
            }
            .scan-guide-oval {
              width: 140px;
              height: 190px;
            }
            .countdown-circle {
              width: 54px;
              height: 54px;
              font-size: 1.5rem;
            }
            .status-instruction-pill {
              font-size: 0.75rem;
              padding: 6px 16px;
              bottom: 16px;
            }
            .btn-enroll-start {
              height: 48px;
              font-size: 0.92rem;
              border-radius: 12px;
            }
            .btn-enroll-reset, .btn-enroll-submit {
              height: 44px;
              font-size: 0.88rem;
              border-radius: 10px;
            }
          }

          /* Medium Phones / Phablets (481px to 768px) */
          @media (min-width: 481px) and (max-width: 768px) {
            .white-bg-visuals {
              padding: 20px 12px;
            }
            .header-banner {
              padding: 24px 20px;
              flex-direction: column;
              align-items: flex-start;
              gap: 16px;
            }
            .register-title {
              font-size: 1.45rem;
            }
            .enrollment-grid {
              grid-template-columns: 1fr;
              gap: 24px;
              padding: 24px 20px;
            }
            .pose-thumb-grid {
              grid-template-columns: repeat(5, 1fr);
              gap: 10px;
            }
            .scanner-frame {
              height: 310px;
            }
            .scan-guide-oval {
              width: 170px;
              height: 230px;
            }
          }

          /* Tablets & Medium Screens (769px to 1024px) */
          @media (min-width: 769px) and (max-width: 1024px) {
            .enrollment-grid {
              grid-template-columns: 1.1fr 0.9fr;
              gap: 24px;
              padding: 30px;
            }
            .scanner-frame {
              height: 340px;
            }
          }
        `}</style>

        <div className="white-bg-visuals">
          <div className="dashboard-container">
            
            {/* POPUP TOAST */}
            {popupMessage && (
              <div className="popup-toast animate__animated animate__fadeInRight">
                <IonIcon icon={alertCircleOutline} style={{ color: "#ef4444", fontSize: "20px" }} />
                <span>{popupMessage}</span>
              </div>
            )}

            {/* HEADER AREA */}
            <div className="header-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  onClick={() => history.push("/home")}
                  className="back-btn"
                  title="Back to Dashboard"
                >
                  <IonIcon icon={arrowBackOutline} style={{ fontSize: "20px" }} />
                </button>
                <div>
                  <h1 className="register-title">Biometric Face Enrollment</h1>
                  <p className="register-subtitle">
                    Create a secure 5-pose reference profile. Guided voice and visual telemetry check.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className={`btn-voice-toggle ${voiceEnabled ? 'active' : ''}`}
                  onClick={() => {
                    setVoiceEnabled(!voiceEnabled);
                    speakInstruction("Voice assistant " + (!voiceEnabled ? "activated" : "deactivated"));
                  }}
                  title="Toggle Voice Guide"
                >
                  <IonIcon icon={volumeHighOutline} style={{ fontSize: '15px' }} />
                  {voiceEnabled ? 'Voice ON' : 'Voice OFF'}
                </button>

                <div className="register-secure-badge" style={{ margin: 0 }}>
                  <IonIcon icon={shieldCheckmarkOutline} style={{ color: "#6366f1", fontSize: "15px" }} />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#4f46e5" }}>Secure Enrollment</span>
                </div>
              </div>
            </div>

            {/* GRID CONTENT */}
            <div className="enrollment-grid">
              
              {/* LEFT COLUMN: GUIDELINES & STEP CARDS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* DETAILS CARD */}
                <div className="employee-info-card">
                  <h3 className="section-title" style={{ marginBottom: '14px' }}>
                    <IonIcon icon={personOutline} style={{ color: '#6366f1' }} />
                    Employee Details
                  </h3>
                  <div className="detail-grid-override" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="detail-label">FULL NAME</label>
                      <div className="detail-value">
                        <IonIcon icon={personOutline} style={{ color: '#94a3b8' }} />
                        <span>{name || "Loading..."}</span>
                      </div>
                    </div>
                    <div>
                      <label className="detail-label">EMPLOYEE ID</label>
                      <div className="detail-value">
                        <IonIcon icon={idCardOutline} style={{ color: '#94a3b8' }} />
                        <span>{empId || "Loading..."}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VISUAL POSES TRACKER */}
                <div className="guidelines-card">
                  <h3 className="section-title">
                    📸 Multi-Angle Profile Reference
                  </h3>
                  
                  <div className="rules-alert">
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '18px' }}>💡</span>
                      <div style={{ fontSize: '0.76rem', color: '#4f46e5', fontWeight: 600, lineHeight: 1.4 }}>
                        Keep camera stable. The assistant will guide you to tilt your head in 5 directions. Each angle is captured automatically after a 3-second countdown.
                      </div>
                    </div>
                  </div>

                  <div className="pose-thumb-grid">
                    {POSES.map((pose, index) => {
                      const photo = capturedPhotos[pose.key];
                      const isActive = index === currentPoseIndex;
                      const isDone = !!photo;
                      
                      return (
                        <div 
                          key={pose.key} 
                          className={`pose-thumb-card ${isActive ? 'active' : ''} ${isDone ? 'success' : ''}`}
                        >
                          {photo ? (
                            <img src={photo} className="pose-thumb-image" alt={pose.label} />
                          ) : (
                            <div className="pose-thumb-placeholder">
                              <IonIcon icon={isActive ? cameraOutline : lockClosedOutline} style={{ fontSize: '16px' }} />
                            </div>
                          )}
                          <span className="pose-thumb-label">{pose.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: CAMERA VIEWPORT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div>
                  <label className="detail-label" style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.9rem', marginBottom: '12px' }}>
                    Biometric Telemetry Viewport
                  </label>

                  <div className={`scanner-frame ${cameraActive ? 'active-scan' : ''}`}>
                    {/* Cyber focus corner indicators */}
                    <div className="cyber-corner top-left"></div>
                    <div className="cyber-corner top-right"></div>
                    <div className="cyber-corner bottom-left"></div>
                    <div className="cyber-corner bottom-right"></div>

                    {/* Laser scan beam */}
                    {cameraActive && currentPoseIndex >= 0 && (
                      <div className="cyber-beam"></div>
                    )}

                    {/* VIDEO FEED */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover', 
                        transform: 'scaleX(-1)',
                        display: (cameraActive && currentPoseIndex !== -2) ? 'block' : 'none'
                      }}
                    />

                    {/* OVERLAYS */}
                    {cameraActive && currentPoseIndex >= 0 && currentPoseIndex < 5 && (
                      <>
                        {/* Target Outline Guide Shape */}
                        <div className="pose-outline-guide">
                          {currentPoseIndex === 0 && renderStraightSvg()}
                          {currentPoseIndex === 1 && renderLeftSvg()}
                          {currentPoseIndex === 2 && renderRightSvg()}
                          {currentPoseIndex === 3 && renderUpSvg()}
                          {currentPoseIndex === 4 && renderDownSvg()}
                        </div>

                        {/* Target Oval */}
                        <div className="scan-guide-oval">
                          {isValidatingPose ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.92)', padding: '12px 16px', borderRadius: '16px', border: '1px solid rgba(99,102,241,0.15)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
                              <IonSpinner name="crescent" color="primary" style={{ transform: 'scale(0.8)' }} />
                              <span style={{ fontSize: '0.68rem', color: '#4f46e5', fontWeight: 800, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verifying...</span>
                            </div>
                          ) : (
                            countdown > 0 && (
                              <div className="countdown-circle">
                                {countdown}
                              </div>
                            )
                          )}
                        </div>

                        {/* Pose instructions */}
                        <div className="status-instruction-pill animate__animated animate__pulse animate__infinite">
                          Step {currentPoseIndex + 1}/5: {POSES[currentPoseIndex].label.toUpperCase()}
                        </div>
                      </>
                    )}

                    {/* COMPLETED ENROLLMENT STATE PREVIEW */}
                    {currentPoseIndex === -2 && (
                      <div style={{ position: 'absolute', inset: 0, background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '64px', color: '#10b981', marginBottom: '12px' }} />
                        <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '1.15rem' }}>All Poses Captured</h3>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', maxWidth: '260px', marginTop: '6px', lineHeight: 1.4 }}>
                          5 directional references registered. Click submit below to save database profile.
                        </p>
                      </div>
                    )}

                    {/* CAMERA INACTIVE SCREEN */}
                    {!cameraActive && currentPoseIndex !== -2 && (
                      <div style={{ position: 'absolute', inset: 0, background: '#fafbfc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                        <IonIcon icon={cameraOutline} style={{ fontSize: '56px', color: '#cbd5e1', marginBottom: '16px' }} />
                        
                        {cameraError ? (
                          <>
                            <p style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 650, margin: '0 0 16px 0' }}>{cameraError}</p>
                            <button className="btn-enroll-reset" onClick={startEnrollment} style={{ width: 'max-content', padding: '0 20px', height: '40px' }}>
                              Retry Camera
                            </button>
                          </>
                        ) : isCameraLoading ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <IonSpinner name="crescent" color="secondary" />
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Initializing face scanner...</span>
                          </div>
                        ) : (
                          <>
                            <h4 style={{ margin: '0 0 4px 0', color: '#1e293b', fontWeight: 800, fontSize: '0.95rem' }}>Camera Disconnected</h4>
                            <p style={{ color: '#64748b', fontSize: '0.8rem', maxWidth: '280px', lineHeight: 1.4, margin: '0 0 20px 0' }}>
                              Start the biometric scanner to begin the guided 5-pose registration.
                            </p>
                            <button className="btn-enroll-start" onClick={startEnrollment} style={{ width: 'max-content', padding: '0 24px', height: '46px' }}>
                              <IonIcon icon={cameraOutline} style={{ fontSize: '18px' }} />
                              Start Guided Enrollment
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* DYNAMIC ACTIONS BAR */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {currentPoseIndex >= 0 && (
                    <button className="btn-enroll-reset" onClick={resetEnrollment}>
                      Cancel Enrollment
                    </button>
                  )}

                  {currentPoseIndex === -2 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <button className="btn-enroll-reset" onClick={resetEnrollment} disabled={isProcessing}>
                        Restart
                      </button>
                      <button className="btn-enroll-submit" onClick={handleSubmit} disabled={isProcessing}>
                        {isProcessing ? (
                          <IonSpinner name="bubbles" color="light" />
                        ) : (
                          <>
                            <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '18px' }} />
                            Submit Profile
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        </div>

        {/* SUCCESS POPUP MODAL */}
        {showSuccessPopup && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999999,
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                width: "90%",
                maxWidth: "400px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "28px",
                padding: "36px",
                textAlign: "center",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
                animation: "animate__animated animate__zoomIn animate__fast",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  background: "rgba(16, 185, 129, 0.08)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px auto",
                }}
              >
                <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: "40px", color: "#10b981" }} />
              </div>

              <h2 style={{ color: "#0f172a", fontWeight: 800, fontSize: "1.4rem", margin: "0 0 10px 0", letterSpacing: "-0.3px" }}>
                Enrollment Complete
              </h2>

              <p style={{ color: "#64748b", lineHeight: 1.5, fontSize: "0.92rem", margin: "0 0 28px 0" }}>
                {successMessage}
              </p>

              <button
                onClick={() => {
                  setShowSuccessPopup(false);
                  history.push("/home");
                }}
                style={{
                  width: "100%",
                  height: "50px",
                  borderRadius: "14px",
                  background: "#10b981",
                  color: "#ffffff",
                  fontSize: "1rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#059669";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#10b981";
                }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceRegister;
