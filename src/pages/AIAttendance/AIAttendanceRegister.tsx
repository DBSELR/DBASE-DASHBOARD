import { IonContent, IonPage, IonButton, IonSpinner, IonIcon } from '@ionic/react';
import { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router';
import { 
  arrowBackOutline, 
  cameraOutline, 
  refreshOutline, 
  checkmarkCircleOutline, 
  alertCircleOutline, 
  personOutline, 
  idCardOutline, 
  trashOutline,
  shieldCheckmarkOutline
} from 'ionicons/icons';
import { AI_API_KEY } from './ai_config';
import { API_BASE } from "../../config";

const AIAttendanceRegister: React.FC = () => {
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const history = useHistory();
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUserData(parsed);
      setUserProfile(parsed);
      
      // AUTO FILL
      setEmpId(parsed?.empCode || "");
      setName(parsed?.EmpName || parsed?.empName || "");
    }
  }, []);

  // Manage camera streaming lifecycle
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const showPopup = (msg: string) => {
    setPopupMessage(msg);
    setTimeout(() => {
      setPopupMessage('');
    }, 4000);
  };

  // Start video camera feed
  const startCamera = async () => {
    setCameraError(null);
    setCapturedPhoto(null);
    setIsCameraLoading(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser or device does not support camera access.");
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setCameraActive(true);
            setIsCameraLoading(false);
          } catch (err) {
            console.error("Video play failed:", err);
            setCameraError("Failed to initiate live video feed.");
            setIsCameraLoading(false);
          }
        };
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError(err.message || "Unable to access camera. Please check permissions.");
      setCameraActive(false);
      setIsCameraLoading(false);
    }
  };

  // Stop video camera feed
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

  // Capture frame from the video stream
  const capturePhoto = () => {
    if (!videoRef.current || !cameraActive) {
      showPopup("Camera stream is not ready.");
      return;
    }
    try {
      // Determine camera stream's native dimensions dynamically to prevent scaling/stretching on mobile screens
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;
      
      const canvas = document.createElement("canvas");
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        // Mirror the canvas context horizontally so the captured photo 
        // matches the mirror preview shown to the user on screen.
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        const photoData = canvas.toDataURL("image/jpeg", 0.95);
        setCapturedPhoto(photoData);
        stopCamera();
      }
    } catch (err) {
      console.error("Capture photo failed:", err);
      showPopup("Failed to capture picture. Please try again.");
    }
  };

  const retakePhoto = () => {
    startCamera();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showPopup('Employee name is required.');
      return;
    }
    if (!capturedPhoto) {
      showPopup('Please capture a live photo before submitting.');
      return;
    }

    setIsProcessing(true);

    const formData = new FormData();
    const finalName = empId.trim() ? `${name.trim()} (${empId.trim()})` : name.trim();
    formData.append('name', finalName);

    try {
      // Convert captured photo (data URI) to binary Blob
      const responseBlob = await fetch(capturedPhoto);
      const blob = await responseBlob.blob();
      
      // Package the blob as a File object mimicking user uploaded image
      const file = new File([blob], 'captured_face.jpg', { type: 'image/jpeg' });
      formData.append("images[]", file);

      console.log("Uploading Captured File:", file.name);

      const response = await fetch(`${API_BASE}Checkin/UploadModel`, {
        method: 'POST',
        headers: {
          'x-api-key': AI_API_KEY
        },
        body: formData,
      });

      const data = await response.json();
      console.log("Upload response:", data);

      if (response.ok && data.success) {
        setSuccessMessage(
          `${data.uploadedFaces || 1} face(s) registered successfully`
        );
        setShowSuccessPopup(true);
      } else {
        if (data.errors && data.errors.length > 0) {
          showPopup(data.errors[0]);
        } else {
          showPopup(data.message || "Face registration failed");
        }
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
      <IonContent fullscreen style={{ "--background": "#f8fafc" }}>
        {/* Style block for live scan animation overlay */}
        <style>{`
          @keyframes scan-glow {
            0% { top: 5%; opacity: 0.8; }
            50% { top: 90%; opacity: 0.8; }
            100% { top: 5%; opacity: 0.8; }
          }
          @keyframes pulse-ring {
            0% { transform: scale(0.95); opacity: 0.5; }
            50% { transform: scale(1.02); opacity: 0.9; }
            100% { transform: scale(0.95); opacity: 0.5; }
          }
          .scanner-frame {
            position: relative;
            width: 100%;
            height: 350px;
            background: #0f172a;
            border-radius: 20px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.4);
          }
          @media (max-width: 768px) {
            .scanner-frame {
              height: 280px;
              border-radius: 16px;
            }
          }
          .video-feed {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scaleX(-1);
          }
          .scan-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: 10;
          }
          .scan-oval {
            width: 220px;
            height: 280px;
            border-radius: 50% / 45%;
            border: 2px dashed rgba(99, 102, 241, 0.6);
            box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.65);
            position: relative;
            animation: pulse-ring 3s infinite ease-in-out;
          }
          @media (max-width: 768px) {
            .scan-oval {
              width: 170px;
              height: 220px;
            }
          }
          .scan-line {
            position: absolute;
            left: 5%;
            right: 5%;
            height: 3px;
            background: linear-gradient(90deg, transparent, #6366f1, transparent);
            box-shadow: 0 0 12px #6366f1;
            animation: scan-glow 4s infinite linear;
          }
          .terminal-badge {
            position: absolute;
            top: 16px;
            left: 16px;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(8px);
            padding: 6px 12px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            gap: 6px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 0.78rem;
            color: #ffffff;
            font-weight: 600;
            letter-spacing: 0.5px;
            z-index: 20;
          }
          .pulse-dot {
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            box-shadow: 0 0 8px #22c55e;
          }
          .pulse-dot-inactive {
            width: 8px;
            height: 8px;
            background: #ef4444;
            border-radius: 50%;
          }
          .preview-photo {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          /* Responsive Layout Styles */
          .register-wrapper {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .register-wrapper {
              padding: 12px;
              align-items: flex-start;
            }
          }

          .register-card {
            width: 100%;
            max-width: 1050px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.01);
            position: relative;
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .register-card {
              border-radius: 16px;
            }
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
          @media (max-width: 768px) {
            .popup-toast {
              top: 16px;
              right: 16px;
              left: 16px;
              padding: 12px 16px;
              font-size: 0.85rem;
              border-radius: 12px;
            }
          }

          .register-header {
            padding: 30px 40px;
            background: linear-gradient(135deg, rgba(99,102,241,0.02) 0%, rgba(139,92,246,0.02) 100%);
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .register-header {
              padding: 16px 20px;
              flex-direction: column;
              align-items: flex-start;
              gap: 12px;
            }
          }

          .register-header-left {
            display: flex;
            align-items: center;
            gap: 20px;
          }
          @media (max-width: 768px) {
            .register-header-left {
              gap: 12px;
              width: 100%;
            }
          }

          .btn-back {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            transition: all 0.2s;
            flex-shrink: 0;
          }
          @media (max-width: 768px) {
            .btn-back {
              width: 38px;
              height: 38px;
              border-radius: 10px;
            }
          }

          .register-title {
            margin: 0;
            color: #0f172a;
            font-size: 1.8rem;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          @media (max-width: 768px) {
            .register-title {
              font-size: 1.25rem;
            }
          }

          .register-subtitle {
            margin-top: 6px;
            color: #64748b;
            font-size: 0.95rem;
            line-height: 1.4;
            max-width: 600px;
          }
          @media (max-width: 768px) {
            .register-subtitle {
              font-size: 0.8rem;
              margin-top: 4px;
            }
          }

          .register-secure-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(99, 102, 241, 0.06);
            padding: 10px 16px;
            border-radius: 14px;
            border: 1px solid rgba(99, 102, 241, 0.12);
            flex-shrink: 0;
          }
          @media (max-width: 768px) {
            .register-secure-badge {
              padding: 6px 10px;
              border-radius: 10px;
              font-size: 0.75rem;
            }
          }

          .register-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
            gap: 36px;
            padding: 40px;
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .register-grid {
              grid-template-columns: 1fr;
              gap: 24px;
              padding: 20px;
            }
          }

          .employee-info-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 24px;
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .employee-info-card {
              padding: 16px;
              border-radius: 16px;
            }
          }

          .section-title {
            margin: 0 0 18px 0;
            color: #1e293b;
            font-size: 1.1rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          @media (max-width: 768px) {
            .section-title {
              font-size: 0.95rem;
              margin-bottom: 12px;
            }
          }

          .detail-label {
            color: #64748b;
            font-weight: 600;
            font-size: 0.82rem;
            margin-bottom: 6px;
            display: block;
          }
          @media (max-width: 768px) {
            .detail-label {
              font-size: 0.75rem;
            }
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
            font-weight: 600;
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .detail-value {
              padding: 10px 12px;
              font-size: 0.85rem;
              border-radius: 10px;
            }
          }

          .guidelines-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.01);
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .guidelines-card {
              padding: 16px;
              border-radius: 16px;
            }
          }

          .guidelines-text {
            margin: 0 0 18px 0;
            color: #64748b;
            font-size: 0.88rem;
            line-height: 1.4;
          }
          @media (max-width: 768px) {
            .guidelines-text {
              font-size: 0.78rem;
              margin-bottom: 12px;
            }
          }

          .guidelines-list {
            color: #475569;
            line-height: 1.7;
            font-size: 0.88rem;
            padding-left: 20px;
            margin: 0 0 20px 0;
          }
          @media (max-width: 768px) {
            .guidelines-list {
              font-size: 0.78rem;
              margin-bottom: 12px;
              padding-left: 15px;
            }
          }

          .rec-avoid-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          @media (max-width: 480px) {
            .rec-avoid-grid {
              grid-template-columns: 1fr;
              gap: 8px;
            }
          }

          .rec-box {
            background: rgba(34, 197, 94, 0.04);
            border: 1px solid rgba(34, 197, 94, 0.15);
            border-radius: 12px;
            padding: 12px;
            text-align: center;
          }
          .avoid-box {
            background: rgba(239, 68, 68, 0.04);
            border: 1px solid rgba(239, 68, 68, 0.15);
            border-radius: 12px;
            padding: 12px;
            text-align: center;
          }
          @media (max-width: 768px) {
            .rec-box, .avoid-box {
              padding: 8px;
            }
          }

          .rec-avoid-title {
            font-weight: 700;
            font-size: 0.78rem;
            margin-bottom: 4px;
          }
          .rec-avoid-desc {
            margin: 0;
            font-size: 0.72rem;
            line-height: 1.3;
          }

          .btn-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          @media (max-width: 768px) {
            .btn-container {
              gap: 12px;
            }
          }

          .photo-controls-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          @media (max-width: 480px) {
            .photo-controls-grid {
              grid-template-columns: 1fr;
              gap: 10px;
            }
          }

          .btn-action {
            height: 56px;
            border-radius: 16px;
            font-size: 1.05rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
            box-sizing: border-box;
          }
          @media (max-width: 768px) {
            .btn-action {
              height: 48px;
              border-radius: 12px;
              font-size: 0.9rem;
            }
          }
          
          .btn-action-primary {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: #ffffff;
            border: none;
            box-shadow: 0 10px 20px rgba(99, 102, 241, 0.25);
          }
          .btn-action-success {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            border: none;
            box-shadow: 0 10px 20px rgba(16, 185, 129, 0.25);
          }
          .btn-action-secondary {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            color: #475569;
          }
        `}</style>

        <div className="register-wrapper">
          <div className="register-card">
            {/* POPUP ALERT */}
            {popupMessage && (
              <div className="popup-toast animate__animated animate__fadeInRight">
                <IonIcon icon={alertCircleOutline} style={{ color: "#ef4444", fontSize: "20px" }} />
                <span>{popupMessage}</span>
              </div>
            )}

            {/* HEADER AREA */}
            <div className="register-header">
              <div className="register-header-left">
                <button
                  onClick={() => history.push("/ai-attendance-admin-dashboard")}
                  className="btn-back"
                  title="Back to Dashboard"
                >
                  <IonIcon icon={arrowBackOutline} style={{ fontSize: "20px", color: "#475569" }} />
                </button>

                <div>
                  <h1 className="register-title">
                    Biometric Face Enrollment
                  </h1>
                  <p className="register-subtitle">
                    Register direct camera pictures to secure verification. AI-generated or heavily edited photos are prohibited.
                  </p>
                </div>
              </div>

              <div className="register-secure-badge">
                <IonIcon icon={shieldCheckmarkOutline} style={{ color: "#6366f1", fontSize: "18px" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#4f46e5" }}>Secure Link</span>
              </div>
            </div>

            {/* TWO-COLUMN GRID LAYOUT */}
            <div className="register-grid">
              {/* LEFT COLUMN: GUIDELINES & EMP INFO */}
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                
                {/* EMPLOYEE INFO CARD */}
                <div className="employee-info-card">
                  <h3 className="section-title">
                    <IonIcon icon={personOutline} style={{ color: "#6366f1" }} />
                    Employee Details
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label className="detail-label">
                        FULL NAME
                      </label>
                      <div className="detail-value">
                        <IonIcon icon={personOutline} style={{ color: "#94a3b8" }} />
                        <span>{name || "Loading name..."}</span>
                      </div>
                    </div>

                    <div>
                      <label className="detail-label">
                        EMPLOYEE ID / CODE
                      </label>
                      <div className="detail-value">
                        <IonIcon icon={idCardOutline} style={{ color: "#94a3b8" }} />
                        <span>{empId || "Loading ID..."}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CAMERA GUIDELINES */}
                <div className="guidelines-card">
                  <h3 className="section-title">
                    📸 Enrollment Guidelines
                  </h3>
                  <p className="guidelines-text">
                    Live camera capture ensures maximum registration accuracy.
                  </p>

                  <ul className="guidelines-list">
                    <li style={{ marginBottom: "6px" }}>Capture 1 clear, front-facing live photo.</li>
                    <li style={{ marginBottom: "6px" }}>Align your face inside the overlay oval marker.</li>
                    <li style={{ marginBottom: "6px" }}>Position yourself in well-lit surroundings.</li>
                    <li style={{ marginBottom: "6px" }}>Remove masks, glasses, caps, or headwear.</li>
                    <li style={{ marginBottom: "6px" }}>Make sure no other faces are visible in the stream.</li>
                  </ul>

                  {/* RECOMMEND VS AVOID CHECKS */}
                  <div className="rec-avoid-grid">
                    <div className="rec-box">
                      <div style={{ fontSize: "24px", marginBottom: "4px" }}>👤</div>
                      <div className="rec-avoid-title" style={{ color: "#166534" }}>RECOMMENDED</div>
                      <p className="rec-avoid-desc" style={{ color: "#15803d" }}>
                        Front-facing view under natural light.
                      </p>
                    </div>

                    <div className="avoid-box">
                      <div style={{ fontSize: "24px", marginBottom: "4px" }}>🧢🕶️</div>
                      <div className="rec-avoid-title" style={{ color: "#991b1b" }}>AVOID</div>
                      <p className="rec-avoid-desc" style={{ color: "#b91c1c" }}>
                        Hats, sunglasses, filters, dark shadows.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: CAMERA TERMINAL CONTAINER */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                
                {/* VIDEO FEED TERMINAL */}
                <div>
                  <label className="detail-label" style={{ color: "#334155", fontWeight: 700, fontSize: "0.95rem", marginBottom: "12px" }}>
                    Live Biometric Camera Capture
                  </label>

                  <div className="scanner-frame">
                    {/* TOP BADGE STATUS */}
                    <div className="terminal-badge">
                      <span className={cameraActive && !capturedPhoto ? "pulse-dot" : "pulse-dot-inactive"} />
                      <span>
                        {capturedPhoto 
                          ? "PHOTO CAPTURED" 
                          : cameraActive 
                            ? "LIVE CAMERA ACTIVE" 
                            : "CAMERA INACTIVE"
                        }
                      </span>
                    </div>

                    {/* LIVE STREAM FEED */}
                    {!capturedPhoto && (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="video-feed"
                        style={{ display: cameraActive ? "block" : "none" }}
                      />
                    )}

                    {/* CAPTURED PREVIEW FEED */}
                    {capturedPhoto && (
                      <img
                        src={capturedPhoto}
                        alt="Captured Face"
                        className="preview-photo"
                      />
                    )}

                    {/* LIVE TARGET OVERLAY */}
                    {cameraActive && !capturedPhoto && (
                      <div className="scan-overlay">
                        <div className="scan-oval">
                          <div className="scan-line" />
                        </div>
                      </div>
                    )}

                    {/* CAMERA ERROR / INACTIVE SCREEN */}
                    {!cameraActive && !capturedPhoto && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "24px",
                          color: "#94a3b8",
                          zIndex: 10,
                          textAlign: "center",
                          background: "#0f172a",
                        }}
                      >
                        <IonIcon icon={cameraOutline} style={{ fontSize: "56px", color: "#475569", marginBottom: "16px" }} />
                        {cameraError ? (
                          <>
                            <p style={{ color: "#ef4444", fontSize: "0.9rem", margin: "0 0 16px 0", fontWeight: 600 }}>{cameraError}</p>
                            <button
                              onClick={startCamera}
                              style={{
                                background: "#6366f1",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "12px",
                                padding: "10px 20px",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                boxShadow: "0 4px 10px rgba(99,102,241,0.2)",
                              }}
                            >
                              Retry Access
                            </button>
                          </>
                        ) : isCameraLoading ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                            <IonSpinner name="crescent" color="secondary" />
                            <p style={{ fontSize: "0.88rem", margin: 0, color: "#94a3b8" }}>Accessing camera device...</p>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                            <h3 style={{ color: "#ffffff", margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 700 }}>Camera Stream Offline</h3>
                            <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 16px 0", maxWidth: "260px", lineHeight: 1.4 }}>
                              Biometric live camera feed is currently off. Click below to start scanner.
                            </p>
                            <button
                              onClick={startCamera}
                              style={{
                                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "12px",
                                padding: "10px 20px",
                                fontSize: "0.88rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                boxShadow: "0 6px 15px rgba(99, 102, 241, 0.25)",
                              }}
                            >
                              <IonIcon icon={cameraOutline} style={{ fontSize: "16px" }} />
                              Open Camera
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* CONTROLS */}
                <div className="btn-container">
                  {/* SCENARIO 1: Live camera active, ready to snap */}
                  {cameraActive && !capturedPhoto && (
                    <button
                      onClick={capturePhoto}
                      className="btn-action btn-action-primary"
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 12px 24px rgba(99, 102, 241, 0.3)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "0 10px 20px rgba(99, 102, 241, 0.25)";
                      }}
                    >
                      <IonIcon icon={cameraOutline} style={{ fontSize: "20px" }} />
                      Capture Live Picture
                    </button>
                  )}

                  {/* SCENARIO 2: Picture has been captured, ready to submit or retake */}
                  {capturedPhoto && (
                    <div className="photo-controls-grid">
                      <button
                        onClick={retakePhoto}
                        disabled={isProcessing}
                        className="btn-action btn-action-secondary"
                        onMouseOver={(e) => {
                          if (!isProcessing) e.currentTarget.style.background = "#f8fafc";
                        }}
                        onMouseOut={(e) => {
                          if (!isProcessing) e.currentTarget.style.background = "#ffffff";
                        }}
                      >
                        <IonIcon icon={refreshOutline} style={{ fontSize: "18px" }} />
                        Retake Photo
                      </button>

                      <button
                        onClick={handleSubmit}
                        disabled={isProcessing}
                        className="btn-action btn-action-success"
                        onMouseOver={(e) => {
                          if (!isProcessing) {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 12px 24px rgba(16, 185, 129, 0.3)";
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isProcessing) {
                            e.currentTarget.style.transform = "none";
                            e.currentTarget.style.boxShadow = "0 10px 20px rgba(16, 185, 129, 0.25)";
                          }
                        }}
                      >
                        {isProcessing ? (
                          <IonSpinner name="bubbles" color="light" />
                        ) : (
                          <>
                            <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: "18px" }} />
                            Submit Enrollment
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* SCENARIO 3: Camera is disabled / error state */}
                  {!cameraActive && !capturedPhoto && (
                    <button
                      onClick={startCamera}
                      className="btn-action btn-action-primary"
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 12px 24px rgba(99, 102, 241, 0.25)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "0 10px 20px rgba(99, 102, 241, 0.25)";
                      }}
                    >
                      <IonIcon icon={cameraOutline} style={{ fontSize: "20px" }} />
                      Open Camera
                    </button>
                  )}

                  <IonButton
                    expand="block"
                    fill="clear"
                    onClick={() => history.push("/ai-attendance-admin-dashboard")}
                    style={{
                      height: "44px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      "--color": "#64748b",
                      marginTop: "4px",
                    }}
                  >
                    Back to Admin Dashboard
                  </IonButton>
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
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                width: "90%",
                maxWidth: "400px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "24px",
                padding: "36px",
                textAlign: "center",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.08)",
                animation: "animate__animated animate__zoomIn animate__fast",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  background: "rgba(16, 185, 129, 0.1)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px auto",
                }}
              >
                <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: "40px", color: "#10b981" }} />
              </div>

              <h2
                style={{
                  color: "#0f172a",
                  fontWeight: 800,
                  fontSize: "1.4rem",
                  margin: "0 0 10px 0",
                  letterSpacing: "-0.3px",
                }}
              >
                Enrollment Complete
              </h2>

              <p
                style={{
                  color: "#64748b",
                  lineHeight: 1.5,
                  fontSize: "0.92rem",
                  margin: "0 0 28px 0",
                }}
              >
                {successMessage}
              </p>

              <button
                onClick={() => {
                  setShowSuccessPopup(false);
                  history.push("/ai-attendance-admin-dashboard");
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
