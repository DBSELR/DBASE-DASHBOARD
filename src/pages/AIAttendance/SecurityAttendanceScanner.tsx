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
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import {
  BleClient,
  ScanResult
} from "@capacitor-community/bluetooth-le";

import "./SecurityAttendanceScanner.css";

const speakText = (text: string) => {
  if (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  ) {
    try {
      const SpeechUtterance = (window as any).SpeechSynthesisUtterance;
      const utterance = new SpeechUtterance(text);
      utterance.rate = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn("SpeechSynthesis error:", error);
    }
  } else {
    console.warn("SpeechSynthesis not supported on this platform/browser.");
  }
};

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

  // =========================================
  // LOCATION & BLUETOOTH STATES
  // =========================================
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [locationReady, setLocationReady] = useState(false);
  const [bleVerified, setBleVerified] = useState(false);
  const [bleDeviceId, setBleDeviceId] = useState("");
  const [bleDeviceName, setBleDeviceName] = useState("");
  const [isBleScanning, setIsBleScanning] = useState(false);

  const [message,setMessage] =
    useState(
      "Start to detect employee face"
    );

  const [statusColor,setStatusColor] =
    useState("#6b7280");

    const [cameraMode, setCameraMode] =
  useState<"user" | "environment">(
    "user"
  );
  
  // =========================================
  // START CAMERA
  // =========================================

  useEffect(() => {

    let stream:any = null;

    const startCamera = async () => {

      try
      {
       stream = await navigator.mediaDevices.getUserMedia({
  video: {

    facingMode: {
      ideal: cameraMode
    },

    width: {
      ideal: 640
    },

    height: {
      ideal: 480
    }
  },

  audio: false
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

 }, [cameraMode]);

  // =========================================
  // BLE & LOCATION INITIALIZATION
  // =========================================

  useEffect(() => {
    let timer: any;

    const init = async () => {
      console.log("🚀 [SecurityAttendanceScanner] Component mounted - Initializing...");
      
      if (!Capacitor.isNativePlatform()) {
        console.log("🖥️ [BLE] Running on Web - Skipping Bluetooth LE initialization and periodic scan");
        return;
      }
      
      try {
        console.log("📱 [BleClient] Initializing Bluetooth...");
        await BleClient.initialize();
        console.log("✅ [BleClient] Bluetooth initialized successfully");
        
        // Request BLE permissions on Android 12+
        console.log("🔐 [BLE] Requesting Bluetooth permissions...");
        try {
          await BleClient.requestLEScan(
            { allowDuplicates: false },
            (result) => {
              console.log("[BLE] Permission granted - initial scan callback");
            }
          );
          await BleClient.stopLEScan();
          console.log("✅ [BLE] Bluetooth permissions granted");
        } catch (permErr) {
          console.warn("⚠️ [BLE] Permission request returned error (this may be normal):", permErr);
        }
        
        console.log("🔍 [BLE] Starting initial EasyReach verification...");
        await verifyEasyReach();
        
        timer = setInterval(() => {
          console.log("⏰ [BLE] Running periodic EasyReach verification (every 10s)");
          verifyEasyReach();
        }, 10000);
        
        console.log("✅ [Init] All initialization complete");
      } catch (err) {
        console.error("❌ [Init] Initialization failed:", err);
      }
    };

    init();

    return () => {
      if (timer) {
        console.log("🛑 [Cleanup] Clearing BLE verification interval");
        clearInterval(timer);
      }
    };
  }, []);

  //--------------------------------------------------
  // GET LOCATION
  //--------------------------------------------------
  useEffect(() => {
    const loadLocation = async () => {
      try {
        console.log("📍 [Location] Requesting geolocation permissions...");
        const permission = await Geolocation.requestPermissions();
        console.log("📍 [Location] Permission response:", permission);

        if (permission.location === "granted") {
          console.log("✅ [Location] Permission granted - fetching position via Capacitor...");
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
          });

          console.log("✅ [Location] Capacitor position obtained:", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });

          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setLocationReady(true);
          return;
        } else {
          console.warn("⚠️ [Location] Capacitor geolocation permission denied");
        }

        // Fallback to browser geolocation
        console.log("[Location] Falling back to Browser Geolocation API...");
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log("[Location] Browser geolocation obtained:", {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              });
              setLatitude(position.coords.latitude);
              setLongitude(position.coords.longitude);
              setLocationReady(true);
            },
            (error) => {
              console.error("[Location] Browser geolocation error:", error);
              setMessage("Location access denied");
              setStatusColor("#ef4444");
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            }
          );
        } else {
          setMessage("Geolocation not supported");
          setStatusColor("#ef4444");
        }
      } catch (err) {
        console.error("[Location] Error in loadLocation:", err);
        // Fallback again
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLatitude(position.coords.latitude);
              setLongitude(position.coords.longitude);
              setLocationReady(true);
            },
            () => {
              setMessage("Unable to fetch location");
              setStatusColor("#ef4444");
            }
          );
        }
      }
    };

    loadLocation();
  }, []);

  //--------------------------------------------------
  // GPS watch / tracking
  //--------------------------------------------------
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
      },
      (error) => {
        console.error("[GPS] Geolocation error:", error);
        setMessage("Please enable location access");
        setStatusColor("#ef4444");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  const verifyEasyReach = async () => {
    console.log("[BLE] Starting EasyReach device verification");
    
    if (!Capacitor.isNativePlatform()) {
      console.debug("[BLE] Skipping BLE verification on Web");
      return;
    }
    
    if (isBleScanning) {
      console.debug("[BLE] Scan already in progress, skipping");
      return;
    }
    setIsBleScanning(true);

    try {
      let found = false;
      console.log("[BLE] Initiating LE scan");

      await BleClient.requestLEScan(
        {},
        async (result: ScanResult) => {
          try {
            const name = (result.device.name || "").trim().toUpperCase();
            const mac = (result.device.deviceId || "")
              .replace(/:/g, "")
              .replace(/-/g, "")
              .trim()
              .toUpperCase();

            console.log("[BLE] Device found", {
              name: name,
              mac: mac,
              originalId: result.device.deviceId
            });

            if (name === "ER2650001F" && mac === "EA2658F0001F") {
              found = true;
              setBleVerified(true);
              setBleDeviceName(name);
              setBleDeviceId(result.device.deviceId);

              setMessage(`EasyReach Verified\n${name}`);
              setStatusColor("#22c55e");

              console.log("[BLE] Stopping LE scan (device found)");
              await BleClient.stopLEScan();
              return;
            }
          } catch (e) {
            console.error("[BLE] Error during scan callback", e);
          }
        }
      );

      setTimeout(async () => {
        try {
          await BleClient.stopLEScan();
        } catch (err) {
          console.warn("[BLE] Error stopping scan", err);
        }
        setIsBleScanning(false);

        if (!found) {
          setBleVerified(false);
          setMessage("EasyReach device not found");
          setStatusColor("#ef4444");
        }
      }, 8000);
    } catch (err) {
      console.error("[BLE] Fatal error in verifyEasyReach", err);
      setIsBleScanning(false);
      setBleVerified(false);
      setMessage("Bluetooth scan failed");
      setStatusColor("#ef4444");
    }
  };

  // =========================================
  // AUTO FACE SCAN
  // =========================================

  useEffect(()=>{

    const autoScan = async ()=>{

      if (!locationReady) {
        console.warn("[Scan] Waiting for GPS before sending attendance request");
        setMessage("Waiting for GPS...");
        setStatusColor("#ef4444");
        return;
      }

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
                  "application/json",
                "x-api-key":
                  "dbase-ai-master-key-2026",
              },

              body:JSON.stringify({
                image:image,
                latitude:latitude,
                longitude:longitude,
                bluetoothConnected:bleVerified,
                bluetoothDeviceName:bleDeviceName,
                bluetoothDeviceId:bleDeviceId
              })
            }
          );

        const data =
          await response.json();

        // =====================================
        // INVALID LOCATION
        // =====================================

        if(data.invalidLocation)
        {
          setStatusColor(
            "#ef4444"
          );

          setMessage(
            "⛔ You are not in office location"
          );

          speakText("You are not in office location");

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

          speakText(data.message);

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

          speakText(`${data.empName}\nattendance already marked`);

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

          speakText(`${data.empName}\nattendance marked successfully`);

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
    scanSuccess,
    locationReady,
    bleVerified,
    bleDeviceId,
    bleDeviceName,
    latitude,
    longitude
  ]);

  return (
    <IonPage>

      <IonContent
  fullscreen
  className="attendance-page"
  scrollY={true}
>

        {/* HEADER */}

        {/* <div className="attendance-header">

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
        </div> */}

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
  {processing ? "SCANNING..." : "AI SCANNER ACTIVE"}
</button>

<button
  className="scan-button switch-btn"
  onClick={() => {

    setCameraReady(false);

    setCameraMode((prev) =>
      prev === "user"
        ? "environment"
        : "user"
    );
  }}
>
  SWITCH CAMERA
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
