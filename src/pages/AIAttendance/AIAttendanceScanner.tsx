import { IonContent, IonPage, useIonToast } from '@ionic/react';
import { useRef, useState, useEffect } from 'react';
import { useHistory } from 'react-router';
import { API_BASE_URL } from './ai_config';
import './AIAttendanceScanner.css';
import 'animate.css'; // Requires animate.css which is standard, but keeping exact layout animations locally is also fine.

const AIAttendanceScanner: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState('Scanning for faces...');
  const [statusColor, setStatusColor] = useState('var(--text-secondary)');
  const [presentToast] = useIonToast();
  const history = useHistory();

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Webcam error:", err);
        setResultMessage("Error accessing webcam. Please check permissions.");
        setStatusColor("#f87171");
      }
    };
    startVideo();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    const handleAutoCapture = async () => {
      if (!videoRef.current || isProcessing) return;

      // Basic check
      if (videoRef.current.videoWidth === 0) return;
      setIsProcessing(true);

      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        const context = canvas.getContext('2d');
        context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');

        const response = await fetch(`${API_BASE_URL}/recognize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageData })
        });

        const data = await response.json();

        if (data.success && data.name && data.name.length > 0 && data.name[0] !== "Unknown") {
          const namesStr = data.name.join(", ");
          setStatusColor("#4ade80");

          // Only play audio once per recognition cycle
          if (!resultMessage.includes("Attendance Granted")) {
            let spokenName = namesStr.replace(/\(Cooldown\)/g, "already marked");
            spokenName = spokenName.replace(/\(Morning In\)/g, "").replace(/\(Lunch Out\)/g, "").replace(/\(Lunch In\)/g, "").replace(/\(Evening Out\)/g, "");
            const utterance = new SpeechSynthesisUtterance("Attendance marked for " + spokenName);
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
          }

          setResultMessage("✓ Attendance Granted for: " + namesStr);

          setTimeout(() => {
            setResultMessage("Scanning for faces...");
            setStatusColor("var(--text-secondary)");
          }, 4000);
        } else {
          if (!resultMessage.includes("Attendance Granted")) {
            setStatusColor("var(--text-secondary)");
            setResultMessage("Scanning for faces...");
          }
        }
      } catch (error) {
        console.error("Error:", error);
        if (!resultMessage.includes("Attendance Granted")) {
          setStatusColor("#f87171");
          setResultMessage("Scanner connection error... retrying.");
        }
      } finally {
        setIsProcessing(false);
      }
    };

    const interval = setInterval(handleAutoCapture, 2000);
    return () => clearInterval(interval);
  }, [isProcessing, resultMessage]);

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="container">
          <div className="text-content">
            <h1 className="animate__animated animate__fadeInUp">Let's automate what's slowing you down.</h1>
            <p className="animate__animated animate__fadeInUp">AI Powered Attendance System</p>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }} className="animate__animated animate__fadeInUp">Experience the future of attendance tracking</p>
          </div>

          <div className="camera-module">
            <div className="video-container">
              <div className="scan-line"></div>
              <video className="video-element-exact" ref={videoRef} autoPlay playsInline muted preload="metadata"></video>
            </div>
            <div style={{ color: statusColor, marginTop: '1rem', fontSize: '1.25rem', textAlign: 'center', transition: 'all 0.3s ease' }}>
              {resultMessage}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', margin: '2rem auto 4rem auto', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
        </div>

        <div className="credits-popup">
          <div className="credits-content">
            <h3>Credits</h3>
            <p><strong>Developer:</strong><br />Sandeep Dukkipati</p>
            <p><strong>Company:</strong><br />DBase Solutions Pvt Ltd</p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceScanner;
