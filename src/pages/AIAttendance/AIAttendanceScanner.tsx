import {
  IonContent,
  IonPage,
  IonIcon,
  IonSpinner,
} from "@ionic/react";
import { arrowBackOutline } from "ionicons/icons";
import { useRef, useState, useEffect } from "react";
import { useHistory } from "react-router";
import { API_BASE } from "../../config";
import "./AIAttendanceScanner.css";

const AIAttendanceScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const history = useHistory();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);

  const [resultMessage, setResultMessage] = useState(
    "Start to detect your face"
  );

  const [statusColor, setStatusColor] = useState("#6b7280");

  const [userData, setUserData] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  

  // =========================================
  // LOAD USER
  // =========================================

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      const parsed = JSON.parse(storedUser);

      setUserData(parsed);
      setUserProfile(parsed);
    }
  }, []);

  // =========================================
  // START CAMERA
  // =========================================

useEffect(() => {

  let stream: MediaStream | null = null;

  const startVideo = async () => {

    try {

      // CHECK CAMERA SUPPORT

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        setResultMessage(
          "Camera not supported"
        );

        setStatusColor("#ef4444");

        return;
      }

      // START CAMERA

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      if (videoRef.current) {

        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = async () => {

          try {

            await videoRef.current?.play();

            setIsCameraReady(true);

            setResultMessage(
              "Face detection started"
            );

            setStatusColor("#22c55e");

          } catch (playErr) {

            console.log(playErr);

            setResultMessage(
              "Video play failed"
            );

            setStatusColor("#ef4444");
          }
        };
      }

    } catch (err: any) {

      console.error("Camera Error:", err);

      // FRIENDLY ERRORS

      if (
        err.name === "NotAllowedError"
      ) {

        setResultMessage(
          "Camera permission denied"
        );

      }
      else if (
        err.name === "NotFoundError"
      ) {

        setResultMessage(
          "No camera device found"
        );

      }
      else if (
        err.name === "NotReadableError"
      ) {

        setResultMessage(
          "Camera already in use"
        );

      }
      else {

        setResultMessage(
          "Unable to access camera"
        );
      }

      setStatusColor("#ef4444");
    }
  };

  startVideo();

  return () => {

    if (stream) {

      stream.getTracks().forEach(
        (track) => track.stop()
      );
    }
  };

}, []);

  // =========================================
  // AUTO FACE SCAN
  // =========================================

  useEffect(() => {
    const handleAutoCapture = async () => {
      if (scanSuccess) return;
      if (!videoRef.current || isProcessing || !isCameraReady) return;

      try {
        setIsProcessing(true);

        const canvas = document.createElement("canvas");

        // canvas.width = videoRef.current.videoWidth;
        // canvas.height = videoRef.current.videoHeight;

        canvas.width = 320;
        canvas.height = 240;

        const context = canvas.getContext("2d");

        context?.drawImage(
          videoRef.current,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const imageData = canvas.toDataURL("image/jpeg");

        const response = await fetch(
          `${API_BASE}Checkin/AILogAttendance`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "dbase-ai-master-key-2026",
            },

            body: JSON.stringify({
              image: imageData,

              empId: userData?.empCode || "",

              empName:
                userProfile?.EmpName ||
                userData?.empName ||
                "",
            }),
          }
        );

        const data = await response.json();

        if (data.alreadyMarked) {

  setStatusColor("#f59e0b");

  setResultMessage(
    `⚠️ ${data.message}`
  );

  const utterance =
    new SpeechSynthesisUtterance(
      data.message
    );

  window.speechSynthesis.cancel();

  window.speechSynthesis.speak(
    utterance
  );

  setTimeout(() => {

    setResultMessage(
      "Start to detect your face"
    );

    setStatusColor("#6b7280");

  }, 4000);

  return;
}

        console.log(data);

       if (
  data.success &&
  data.name &&
  data.name.length > 0 &&
  data.name[0] !== "Unknown"
) {
 setScanSuccess(true);
  const empName = data.empName || "";
  const empId = data.empId || "";
  const status = data.status || "";
  const logTime = data.time || "";

  setStatusColor("#22c55e");

  // Voice Announcement
  const utterance = new SpeechSynthesisUtterance(
    `${empName} attendance marked successfully`
  );

  utterance.rate = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  // PROFESSIONAL MESSAGE
  setResultMessage(
    `✅ ${empName} (${empId})
${status} at ${logTime}`
  );

  // RESET
  setTimeout(() => {
    setResultMessage("Start to detect your face");
    setStatusColor("#6b7280");
    setScanSuccess(false);
  }, 5000);
}
else {
  setResultMessage("❌ Face Not Matched");
  setStatusColor("#ef4444");

  setTimeout(() => {
    setResultMessage("Start to detect your face");
    setStatusColor("#6b7280");
  }, 3000);
}
      } catch (error) {
        console.error(error);

        setResultMessage("Connection Error");
        setStatusColor("#ef4444");
      } finally {
        setIsProcessing(false);
      }
    };

    const interval = setInterval(handleAutoCapture, 2500);

    return () => clearInterval(interval);
  }, [isProcessing, isCameraReady, userData,scanSuccess]);

  return (
    <IonPage>
      <IonContent fullscreen className="attendance-page">

        {/* HEADER */}

        <div className="attendance-header">
          <IonIcon
            icon={arrowBackOutline}
            className="back-icon"
            onClick={() => history.goBack()}
          />

          <div>
            <h1>ATTENDANCE</h1>
            <p>Scan your face to verify</p>
          </div>
        </div>

        {/* CAMERA CARD */}

        <div className="scanner-wrapper">

          <div className="scanner-frame">

            {/* VIDEO */}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="scanner-video"
            />

            {/* FACE FRAME */}

            <div className="face-overlay">
              <div className="corner top-left"></div>
              <div className="corner top-right"></div>
              <div className="corner bottom-left"></div>
              <div className="corner bottom-right"></div>

              <div className="scan-line"></div>
            </div>

            {/* LOADER */}

            {!isCameraReady && (
              <div className="camera-loader">
                <IonSpinner name="crescent" />
              </div>
            )}
          </div>

          {/* BUTTON */}

          <button className="scan-button">
            {isProcessing ? "SCANNING..." : "START SCAN"}
          </button>

          {/* STATUS */}

         <div
  className="scan-status"
  style={{
    color: statusColor,
    whiteSpace: "pre-line",
  }}
>
  {resultMessage}
</div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceScanner;