import {
  IonContent,
  IonPage,
  IonIcon,
  IonSpinner,
} from "@ionic/react";

import { arrowBackOutline } from "ionicons/icons";

import {
  useRef,
  useState,
  useEffect,
} from "react";

import { useHistory } from "react-router";

import { API_BASE } from "../../config";

import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

import "./AIAttendanceScanner.css";
import {
  BleClient,
  ScanResult
} from "@capacitor-community/bluetooth-le";

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

const AIAttendanceScanner: React.FC = () => {

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const history =
    useHistory();

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [isCameraReady, setIsCameraReady] =
    useState(false);

  const [scanSuccess, setScanSuccess] =
    useState(false);

  // =========================================
  // LOCATION STATES
  // =========================================

  const [latitude, setLatitude] =
    useState<number>(0);

  const [longitude, setLongitude] =
    useState<number>(0);

  const [locationReady, setLocationReady] =
    useState(false);

  const [resultMessage, setResultMessage] =
    useState(
      "Start to detect your face"
    );

  const [statusColor, setStatusColor] =
    useState("#6b7280");

  const [userData, setUserData] =
    useState<any>(null);

  const [userProfile, setUserProfile] =
    useState<any>(null);

  const [cameraMode, setCameraMode] =
    useState<"user" | "environment">(
      "user"
    );

  const [bleVerified, setBleVerified] =
    useState(false);

  const [bleDeviceId, setBleDeviceId] =
    useState("");
  const [bleDeviceName, setBleDeviceName] =
    useState("");

    const [isBleScanning, setIsBleScanning] = useState(false);

useEffect(() => {
  let timer: any;

  const init = async () => {
    console.log("🚀 [AIAttendanceScanner] Component mounted - Initializing...");
    
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
        // Stop the initial scan immediately
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
  // LOAD USER
  //--------------------------------------------------

  useEffect(() => {
    console.log("👤 [User] Loading user from localStorage...");
    
    const storedUser =
      localStorage.getItem("user");

    if (storedUser) {
      try {
        const parsed =
          JSON.parse(storedUser);

        console.log("✅ [User] User loaded:", {
          empCode: parsed?.empCode,
          empName: parsed?.empName,
          EmpName: parsed?.EmpName
        });

        setUserData(parsed);
        setUserProfile(parsed);
      } catch (err) {
        console.error("❌ [User] Failed to parse user data:", err);
      }
    } else {
      console.warn("⚠️ [User] No user data found in localStorage");
    }

  }, []);

  //--------------------------------------------------
  // GET LOCATION
  //--------------------------------------------------

  //--------------------------------------------------
  // GET LOCATION
  //--------------------------------------------------

  useEffect(() => {

    const loadLocation = async () => {

      try {
        console.log("📍 [Location] Requesting geolocation permissions...");

        //------------------------------------------
        // CAPACITOR GEOLOCATION
        //------------------------------------------

        const permission =
          await Geolocation.requestPermissions();

        console.log(
          "📍 [Location] Permission response:",
          permission
        );

        if (
          permission.location === "granted"
        ) {
          console.log("✅ [Location] Permission granted - fetching position via Capacitor...");
          
          const position =
            await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 15000,
            });

          console.log(
            "✅ [Location] Capacitor position obtained:",
            {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            }
          );

          setLatitude(
            position.coords.latitude
          );

          setLongitude(
            position.coords.longitude
          );

          setLocationReady(true);

          return;
        } else {
          console.warn("⚠️ [Location] Capacitor geolocation permission denied");
        }

        //------------------------------------------
        // FALLBACK BROWSER GEOLOCATION
        //------------------------------------------

        console.log("[Location] Falling back to Browser Geolocation API...");
        
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(

            (position) => {

              console.log(
                "[Location] Browser geolocation obtained:",
                {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy
                }
              );

              setLatitude(
                position.coords.latitude
              );

              setLongitude(
                position.coords.longitude
              );

              setLocationReady(true);
            },

            (error) => {

              console.error("[Location] Browser geolocation error:", error);

              setResultMessage(
                "Location access denied"
              );

              setStatusColor("#ef4444");
            },

            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            }
          );
        }
        else {
          setResultMessage(
            "Geolocation not supported"
          );

          setStatusColor("#ef4444");
        }

      }
      catch (err) {
        console.error(
          "[Location] Error in loadLocation:",
          err
        );

        //------------------------------------------
        // FALLBACK AGAIN
        //------------------------------------------

        console.log("[Location] Attempting second fallback to Browser Geolocation...");
        
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(

            (position) => {
              console.log(
                "[Location] Second fallback succeeded:",
                {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                }
              );

              setLatitude(
                position.coords.latitude
              );

              setLongitude(
                position.coords.longitude
              );

              setLocationReady(true);
            },

            () => {
              console.error("[Location] Second fallback failed");

              setResultMessage(
                "Unable to fetch location"
              );

              setStatusColor("#ef4444");
            }
          );
        }
        else {
          setResultMessage(
            "Unable to fetch location"
          );

          setStatusColor("#ef4444");
        }
      }
    };

    loadLocation();

  }, []);

  // =========================================
  // GET GPS LOCATION
  // =========================================

  useEffect(() => {
    console.log("[GPS] Setting up continuous GPS tracking...");

    if (!navigator.geolocation) {
      console.error(
        "[GPS] Geolocation not supported in this browser"
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(

      (position) => {
        console.log(
          "[GPS] Position updated:",
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy + "m"
          }
        );

        setLatitude(
          position.coords.latitude
        );

        setLongitude(
          position.coords.longitude
        );
      },

      (error) => {
        console.error(
          "[GPS] Geolocation error:",
          error
        );

        setResultMessage(
          "Please enable location access"
        );

        setStatusColor("#ef4444");
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

  }, []);

  //--------------------------------------------------
  // START CAMERA
  //--------------------------------------------------

  useEffect(() => {
    console.log("[Camera] Starting camera setup with mode:", cameraMode);

    let stream: MediaStream | null = null;

    const startVideo = async () => {

      try {
        console.log("[Camera] Checking camera support...");
        
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        ) {
          console.error("[Camera] Camera not supported in this browser");
          
          setResultMessage(
            "Camera not supported"
          );

          setStatusColor("#ef4444");

          return;
        }

        console.log("[Camera] Requesting camera access with mode:", cameraMode);
        
        stream =
          await navigator.mediaDevices
            .getUserMedia({
              video: {
                facingMode:
                  cameraMode,

                width: {
                  ideal: 640
                },

                height: {
                  ideal: 480
                }
              },

              audio: false
            });

        if (videoRef.current) {
          console.log("[Camera] Stream obtained, attaching to video element...");
          
          videoRef.current.srcObject =
            stream;

          videoRef.current
            .onloadedmetadata =
            async () => {
              try {
                console.log("[Camera] Video metadata loaded, attempting to play...");
                
                await videoRef
                  .current
                  ?.play();

                console.log("[Camera] Video playback started successfully");
                
                setIsCameraReady(true);

                setResultMessage(
                  "Face detection started"
                );

                setStatusColor(
                  "#22c55e"
                );
              }
              catch (err) {
                console.error("[Camera] Video playback failed:", err);
                
                setResultMessage(
                  "Video play failed"
                );

                setStatusColor(
                  "#ef4444"
                );
              }
            };
        }

      }
      catch (err: any) {
        console.error("[Camera] getUserMedia error:", err);

        setResultMessage(
          "Unable to access camera"
        );

        setStatusColor("#ef4444");
      }
    };

    startVideo();

    return () => {
      if (stream) {
        console.log("[Camera] Stopping all media tracks");
        
        stream
          .getTracks()
          .forEach(
            (track) => {
              track.stop();
              console.log("[Camera] Stopped track:", track.kind);
            }
          );
      }
    };

  }, [cameraMode]);

  //--------------------------------------------------
  // AUTO SCAN
  //--------------------------------------------------

  useEffect(() => {

    const handleAutoCapture =
      async () => {

        //------------------------------------------------
        // PRESENCE: Bluetooth OR GPS is required
        //------------------------------------------------

        if (!locationReady) {
          console.warn("[Scan] Waiting for GPS before sending attendance request");
          setResultMessage("Waiting for GPS...");
          setStatusColor("#ef4444");
          return;
        }

        console.log("[Scan] Presence ready, GPS obtained:", {
          bleVerified,
          latitude,
          longitude
        });

        //--------------------------------------------
        // PREVENT MULTIPLE CALLS
        //--------------------------------------------

        if (
          scanSuccess ||
          isProcessing ||
          !videoRef.current ||
          !isCameraReady
        ) {
          console.debug("[Scan] Skipping scan due to:", {
            scanSuccess,
            isProcessing,
            videoRefReady: !!videoRef.current,
            isCameraReady
          });
          return;
        }

        console.log("[Scan] Starting attendance scan...");
        
        try {
          setIsProcessing(true);

          const canvas =
            document.createElement(
              "canvas"
            );

          canvas.width =
            videoRef.current.videoWidth;

          canvas.height =
            videoRef.current.videoHeight;

          const context =
            canvas.getContext("2d");

          context?.save();

          context?.scale(-1, 1);

          context?.drawImage(
            videoRef.current,
            -canvas.width,
            0,
            canvas.width,
            canvas.height
          );

          context?.restore();

          //--------------------------------------------
          // IMAGE
          //--------------------------------------------

          const imageData =
            canvas.toDataURL(
              "image/jpeg",
              0.85
            );
          
          console.log("[Scan] Face image captured", {
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            imageDataLength: imageData.length
          });
          
          console.log("[API] Sending attendance request with data:", {
            bluetoothConnected:
              bleVerified,

            bluetoothDeviceName:
              bleDeviceName,

            bluetoothDeviceId:
              bleDeviceId,

            latitude,
            longitude
          });

          //--------------------------------------------
          // API CALL
          //--------------------------------------------

          console.log("[API] Sending POST request to: Checkin/AILogAttendance");
          
          const response =
            await fetch(
              `${API_BASE}Checkin/AILogAttendance`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  "x-api-key":
                    "dbase-ai-master-key-2026",
                },

                body: JSON.stringify({

                  image: imageData,

                  empId:
                    userData?.empCode || "",

                  empName:
                    userProfile?.EmpName ||
                    userData?.empName ||
                    "",

                  latitude:
                    latitude,

                  longitude:
                    longitude,

                  bluetoothConnected:
                    bleVerified,

                  bluetoothDeviceName:
                    bleDeviceName,

                  bluetoothDeviceId:
                    bleDeviceId
                }),
              }
            );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              "[API] Request failed:",
              response.status,
              response.statusText,
              errorText
            );
            throw new Error(
              `API request failed ${response.status}: ${response.statusText}`
            );
          }

          let data;
          try {
            data = await response.json();
            console.log("[API] Response received:", data);
          } catch (parseError) {
            console.error("[API] JSON parse error:", parseError);
            const rawText = await response.text();
            console.error("[API] Raw response text:", rawText);
            const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
            throw new Error(`Failed to parse API response: ${errorMsg}`);
          }

          if (!data) {
            throw new Error("API returned empty response");
          }

          //--------------------------------------------
          // INVALID LOCATION
          //--------------------------------------------

          if (data.invalidLocation) {
            console.warn("[Scan] Invalid location - outside office area");
            setStatusColor("#ef4444");

            setResultMessage(
              "⛔ You are not in office location"
            );

            speakText("You are not in office location");

            setTimeout(() => {

              setResultMessage(
                "Start to detect your face"
              );

              setStatusColor(
                "#6b7280"
              );

            }, 4000);

            return;
          }

          //--------------------------------------------
          // INVALID TIME
          //--------------------------------------------

          if (data.invalidTime) {
            console.warn("[Scan] Invalid time for attendance - outside allowed hours", data.message);
            
            setStatusColor("#ef4444");

            setResultMessage(
              `⛔ ${data.message}`
            );

            speakText(data.message);

            setTimeout(() => {

              setResultMessage(
                "Start to detect your face"
              );

              setStatusColor(
                "#6b7280"
              );

            }, 4000);

            return;
          }

          //--------------------------------------------
          // ALREADY MARKED
          //--------------------------------------------

          if (data.alreadyMarked) {
            console.warn("[Scan] Attendance already marked today", data.message);
            
            setStatusColor("#f59e0b");

            setResultMessage(
              `⚠️ ${data.message}`
            );

            speakText(data.message);

            setTimeout(() => {

              setResultMessage(
                "Start to detect your face"
              );

              setStatusColor(
                "#6b7280"
              );

            }, 4000);

            return;
          }

          //--------------------------------------------
          // SUCCESS
          //--------------------------------------------

          if (
            data.success &&
            data.name &&
            data.name.length > 0 &&
            data.name[0] !== "Unknown"
          ) {
            console.log("[Scan] ATTENDANCE MARKED SUCCESSFULLY", {
              empId: data.empId,
              empName: data.empName,
              status: data.status,
              time: data.time,
              officeName: data.officeName
            });
            
            setScanSuccess(true);

            const empName =
              data.empName || "";

            const empId =
              data.empId || "";

            const status =
              data.status || "";

            const logTime =
              data.time || "";

            const officeName =
              data.officeName || "";

            setStatusColor("#22c55e");

            speakText(`${empName} attendance marked successfully`);

            setResultMessage(
              `✅ ${empName} (${empId})

${status} at ${logTime}

📍 ${officeName}`
            );

            setTimeout(() => {

              setResultMessage(
                "Start to detect your face"
              );

              setStatusColor(
                "#6b7280"
              );

              setScanSuccess(false);

            }, 5000);
          }
          else {
            console.warn("[Scan] Face not recognized or matched");
            
            setResultMessage(
              "❌ Face Not Matched"
            );

            setStatusColor("#ef4444");

            setTimeout(() => {

              setResultMessage(
                "Start to detect your face"
              );

              setStatusColor(
                "#6b7280"
              );

            }, 3000);
          }

        }
        catch (error) {
          console.error("[Scan] Attendance scanning error:", error);

          // Derive a safe, displayable message from the error
          let errorMessage = "Connection Error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }

          // Trim long messages for UI clarity
          const shortMsg = errorMessage.length > 200 ? errorMessage.slice(0, 200) + "..." : errorMessage;

          // Always show the specific error (prefixed) so users see what's failing
          setResultMessage(`❌ ${shortMsg}`);

          setStatusColor("#ef4444");
        }
        finally {
          setIsProcessing(false);
        }
      };

    const interval =
      setInterval(
        handleAutoCapture,
        4000
      );

    return () =>
      clearInterval(interval);

  },[
  isProcessing,
  isCameraReady,
  userData,
  scanSuccess,
  locationReady,
  bleVerified,
  bleDeviceId,
  bleDeviceName,
  latitude,
  longitude
]);

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
          const name =
            (result.device.name || "")
              .trim()
              .toUpperCase();

          const mac =
            (result.device.deviceId || "")
              .replace(/:/g, "")
              .replace(/-/g, "")
              .trim()
              .toUpperCase();

          console.log("[BLE] Device found", {
            name: name,
            mac: mac,
            originalId: result.device.deviceId
          });

          // Exact match with your database values
          if (
            name === "ER2650001F" &&
            mac === "EA2658F0001F"
          ) {
            found = true;

            setBleVerified(true);
            setBleDeviceName(name);
            setBleDeviceId(result.device.deviceId);

            console.log("[BLE] EASYREACH DEVICE MATCHED AND VERIFIED", {
              name: name,
              id: result.device.deviceId
            });

            setResultMessage(
              `EasyReach Verified\n${name}`
            );

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
      console.log("[BLE] 8-second scan timeout reached");
      
      try {
        await BleClient.stopLEScan();
        console.log("[BLE] LE scan stopped");
      } catch (err) {
        console.warn("[BLE] Error stopping scan", err);
      }
      
      setIsBleScanning(false);

      if (!found) {
        console.warn("[BLE] Target device not found after scan");
        setBleVerified(false);
        setResultMessage("EasyReach device not found");
        setStatusColor("#ef4444");
      } else {
        console.log("[BLE] Device found during scan");
      }
    }, 8000);
  } catch (err) {
    console.error("[BLE] Fatal error in verifyEasyReach", err);
    setIsBleScanning(false);
    setBleVerified(false);
    setResultMessage("Bluetooth scan failed");
    setStatusColor("#ef4444");
  }
};

  return (
    <IonPage>

      <IonContent
        fullscreen
        className="attendance-page"
        scrollY={true}
      >

        <div className="scanner-wrapper">

          <div className="scanner-frame">

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="scanner-video"
            />

            <div className="face-overlay">

              <div className="corner top-left"></div>

              <div className="corner top-right"></div>

              <div className="corner bottom-left"></div>

              <div className="corner bottom-right"></div>

              <div className="scan-line"></div>

            </div>

            {!isCameraReady && (
              <div className="camera-loader">
                <IonSpinner name="crescent" />
              </div>
            )}

          </div>

          <button className="scan-button">

            {isProcessing
              ? "SCANNING..."
              : "AI SCANNER ACTIVE"}

          </button>

          <button
            className="scan-button switch-btn"
            onClick={() => {

              setIsCameraReady(false);

              setCameraMode((prev) =>
                prev === "user"
                  ? "environment"
                  : "user"
              );

            }}
          >
            SWITCH CAMERA
          </button>

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