import {
  IonContent,
  IonPage,
  IonIcon,
  IonSpinner,
} from "@ionic/react";

import {
  arrowBackOutline
} from "ionicons/icons";

import {
  useEffect,
  useRef,
  useState
} from "react";

import { useHistory } from "react-router";

import { API_BASE } from "../../config";

import "./SecurityAttendanceScanner.css";

const SecurityAttendanceScanner: React.FC = () => {

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const history = useHistory();

  const [processing,setProcessing] =
    useState(false);

  const [cameraReady,setCameraReady] =
    useState(false);

  const [scanSuccess,setScanSuccess] =
    useState(false);

  const [message,setMessage] =
    useState(
      "Start to detect employee face"
    );

  const [statusColor,setStatusColor] =
    useState("#6b7280");

  // =========================================
  // START CAMERA
  // =========================================

  useEffect(() => {

    let stream:any = null;

    const startCamera = async () => {

      try
      {
        stream =
          await navigator
          .mediaDevices
          .getUserMedia({

            video:{
              facingMode:"environment",

              width:{
                ideal:640
              },

              height:{
                ideal:480
              }
            },

            audio:false
          });

        if(videoRef.current)
        {
          videoRef.current.srcObject =
            stream;

          videoRef.current
          .onloadedmetadata =
          async ()=>{

            try
            {
              await videoRef
              .current
              ?.play();

              setCameraReady(true);

              setMessage(
                "AI Face Scanner Ready"
              );

              setStatusColor(
                "#22c55e"
              );
            }
            catch
            {
              setMessage(
                "Camera play failed"
              );

              setStatusColor(
                "#ef4444"
              );
            }
          };
        }
      }
      catch(ex:any)
      {
        console.log(ex);

        setMessage(
          "Unable to access camera"
        );

        setStatusColor(
          "#ef4444"
        );
      }
    };

    startCamera();

    return ()=>{

      if(stream)
      {
        stream
        .getTracks()
        .forEach(
          (x:any)=>x.stop()
        );
      }
    };

  },[]);

  // =========================================
  // AUTO FACE SCAN
  // =========================================

  useEffect(()=>{

    const autoScan = async ()=>{

      if(
        processing ||
        scanSuccess ||
        !cameraReady ||
        !videoRef.current
      )
      {
        return;
      }

      try
      {
        setProcessing(true);

        // =====================================
        // CAPTURE IMAGE
        // =====================================

        const canvas =
          document.createElement(
            "canvas"
          );

      canvas.width =
  videoRef.current.videoWidth;

canvas.height =
  videoRef.current.videoHeight;

        const ctx =
          canvas.getContext("2d");

        ctx?.save();

ctx?.scale(-1, 1);

ctx?.drawImage(
  videoRef.current,
  -canvas.width,
  0,
  canvas.width,
  canvas.height
);

ctx?.restore();

       const image =
  canvas.toDataURL(
  "image/jpeg",
  0.85
)

        // =====================================
        // API CALL
        // =====================================

        const response =
          await fetch(
            `${API_BASE}Checkin/AISecurityAttendance`,
            {
              method:"POST",

              headers:{
                "Content-Type":
                  "application/json"
              },

              body:JSON.stringify({
                image:image
              })
            }
          );

        const data =
          await response.json();

        // =====================================
        // INVALID TIME
        // =====================================

        if(data.invalidTime)
        {
          setStatusColor(
            "#ef4444"
          );

          setMessage(
            `⛔ ${data.message}`
          );

          const utter =
            new SpeechSynthesisUtterance(
              data.message
            );

          speechSynthesis.cancel();

          speechSynthesis.speak(
            utter
          );

          setTimeout(()=>{

            setMessage(
              "Start to detect employee face"
            );

            setStatusColor(
              "#6b7280"
            );

          },4000);

          return;
        }

        // =====================================
        // ALREADY MARKED
        // =====================================

        if(data.alreadyMarked)
        {
          setStatusColor(
            "#f59e0b"
          );

          setMessage(
            `⚠️
${data.empName}

${data.message}`
          );

          const utter =
            new SpeechSynthesisUtterance(
              `${data.empName}
attendance already marked`
            );

          speechSynthesis.cancel();

          speechSynthesis.speak(
            utter
          );

          setTimeout(()=>{

            setMessage(
              "Start to detect employee face"
            );

            setStatusColor(
              "#6b7280"
            );

          },4000);

          return;
        }

        // =====================================
        // SUCCESS
        // =====================================

        if(data.success)
        {
          setScanSuccess(true);

          setStatusColor(
            "#22c55e"
          );

          setMessage(
`✅ ${data.empName}
(${data.empId})

${data.status}`
          );

          const utter =
            new SpeechSynthesisUtterance(
              `${data.empName}
attendance marked successfully`
            );

          utter.rate = 1;

          speechSynthesis.cancel();

          speechSynthesis.speak(
            utter
          );

          setTimeout(()=>{

            setMessage(
              "Start to detect employee face"
            );

            setStatusColor(
              "#6b7280"
            );

            setScanSuccess(false);

          },5000);
        }
        else
        {
          setStatusColor(
            "#ef4444"
          );

          setMessage(
            "❌ Face Not Matched"
          );

          setTimeout(()=>{

            setMessage(
              "Start to detect employee face"
            );

            setStatusColor(
              "#6b7280"
            );

          },3000);
        }
      }
      catch(ex)
      {
        console.log(ex);

        setStatusColor(
          "#ef4444"
        );

        setMessage(
          "Connection Error"
        );
      }
      finally
      {
        setProcessing(false);
      }
    };

    const interval =
      setInterval(
        autoScan,
        3500
      );

    return ()=>{
      clearInterval(interval);
    };

  },[
    processing,
    cameraReady,
    scanSuccess
  ]);

  return (
    <IonPage>

      <IonContent
        fullscreen
        className="attendance-page"
      >

        {/* HEADER */}

        <div className="attendance-header">

          <IonIcon
            icon={arrowBackOutline}
            className="back-icon"
            onClick={()=>
              history.goBack()
            }
          />

          <div>
            <h1>
              SECURITY ATTENDANCE
            </h1>

            <p>
              AI Face Verification System
            </p>
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

            {/* FACE OVERLAY */}

            <div className="face-overlay">

              <div className="corner top-left"></div>

              <div className="corner top-right"></div>

              <div className="corner bottom-left"></div>

              <div className="corner bottom-right"></div>

              <div className="scan-line"></div>

            </div>

            {/* CAMERA LOADER */}

            {!cameraReady && (

              <div className="camera-loader">

                <IonSpinner
                  name="crescent"
                />

              </div>
            )}

          </div>

          {/* BUTTON */}

          <button className="scan-button">

            {
              processing
              ?
              "SCANNING..."
              :
              "AI SCANNER ACTIVE"
            }

          </button>

          {/* STATUS */}

          <div
            className="scan-status"
            style={{
              color:statusColor,
              whiteSpace:"pre-line"
            }}
          >
            {message}
          </div>

        </div>

      </IonContent>

    </IonPage>
  );
};

export default SecurityAttendanceScanner;
