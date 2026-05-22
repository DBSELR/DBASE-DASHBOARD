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

import "./AIAttendanceScanner.css";

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

  //--------------------------------------------------
  // LOAD USER
  //--------------------------------------------------

  useEffect(() => {

    const storedUser =
      localStorage.getItem("user");

    if (storedUser)
    {
      const parsed =
        JSON.parse(storedUser);

      setUserData(parsed);

      setUserProfile(parsed);
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

      //------------------------------------------
      // CAPACITOR GEOLOCATION
      //------------------------------------------

      const permission =
        await Geolocation.requestPermissions();

      console.log(
        "LOCATION PERMISSION : ",
        permission
      );

      if (
        permission.location === "granted"
      )
      {
        const position =
          await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
          });

        console.log(
          "CAPACITOR LOCATION : ",
          position
        );

        setLatitude(
          position.coords.latitude
        );

        setLongitude(
          position.coords.longitude
        );

        setLocationReady(true);

        return;
      }

      //------------------------------------------
      // FALLBACK BROWSER GEOLOCATION
      //------------------------------------------

      if ("geolocation" in navigator)
      {
        navigator.geolocation.getCurrentPosition(

          (position) => {

            console.log(
              "BROWSER LOCATION : ",
              position
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

            console.log(error);

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
      else
      {
        setResultMessage(
          "Geolocation not supported"
        );

        setStatusColor("#ef4444");
      }

    }
    catch (err)
    {
      console.log(
        "LOCATION ERROR : ",
        err
      );

      //------------------------------------------
      // FALLBACK AGAIN
      //------------------------------------------

      if ("geolocation" in navigator)
      {
        navigator.geolocation.getCurrentPosition(

          (position) => {

            setLatitude(
              position.coords.latitude
            );

            setLongitude(
              position.coords.longitude
            );

            setLocationReady(true);
          },

          () => {

            setResultMessage(
              "Unable to fetch location"
            );

            setStatusColor("#ef4444");
          }
        );
      }
      else
      {
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

  if (!navigator.geolocation) {

    console.log(
      "Geolocation not supported"
    );

    return;
  }

  navigator.geolocation.getCurrentPosition(

    (position) => {

      console.log(
        "LAT:",
        position.coords.latitude
      );

      console.log(
        "LONG:",
        position.coords.longitude
      );

      setLatitude(
        position.coords.latitude
      );

      setLongitude(
        position.coords.longitude
      );
    },

    (error) => {

      console.log(
        "LOCATION ERROR : ",
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

    let stream: MediaStream | null = null;

    const startVideo = async () => {

      try
      {
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        )
        {
          setResultMessage(
            "Camera not supported"
          );

          setStatusColor("#ef4444");

          return;
        }

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

        if (videoRef.current)
        {
          videoRef.current.srcObject =
            stream;

          videoRef.current
            .onloadedmetadata =
            async () =>
            {
              try
              {
                await videoRef
                  .current
                  ?.play();

                setIsCameraReady(true);

                setResultMessage(
                  "Face detection started"
                );

                setStatusColor(
                  "#22c55e"
                );
              }
              catch
              {
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
      catch (err: any)
      {
        console.log(err);

        setResultMessage(
          "Unable to access camera"
        );

        setStatusColor("#ef4444");
      }
    };

    startVideo();

    return () => {

      if (stream)
      {
        stream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );
      }

    };

  }, [cameraMode]);

  //--------------------------------------------------
  // AUTO SCAN
  //--------------------------------------------------

  useEffect(() => {

    const handleAutoCapture =
      async () =>
      {

        //--------------------------------------------
        // PREVENT MULTIPLE CALLS
        //--------------------------------------------

        if (
          scanSuccess ||
          isProcessing ||
          !videoRef.current ||
          !isCameraReady ||
          !locationReady
        )
        {
          return;
        }

        try
        {
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

          //--------------------------------------------
          // API CALL
          //--------------------------------------------

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
                    longitude
                }),
              }
            );

          const data =
            await response.json();

          console.log(data);

          //--------------------------------------------
          // INVALID LOCATION
          //--------------------------------------------

          if (data.invalidLocation)
          {
            setStatusColor("#ef4444");

            setResultMessage(
              "⛔ You are not in office location"
            );

            const utterance =
              new SpeechSynthesisUtterance(
                "You are not in office location"
              );

            window.speechSynthesis
              .cancel();

            window.speechSynthesis
              .speak(
                utterance
              );

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

          if (data.invalidTime)
          {
            setStatusColor("#ef4444");

            setResultMessage(
              `⛔ ${data.message}`
            );

            const utterance =
              new SpeechSynthesisUtterance(
                data.message
              );

            window.speechSynthesis
              .cancel();

            window.speechSynthesis
              .speak(
                utterance
              );

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

          if (data.alreadyMarked)
          {
            setStatusColor("#f59e0b");

            setResultMessage(
              `⚠️ ${data.message}`
            );

            const utterance =
              new SpeechSynthesisUtterance(
                data.message
              );

            window.speechSynthesis
              .cancel();

            window.speechSynthesis
              .speak(
                utterance
              );

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
          )
          {
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

            const utterance =
              new SpeechSynthesisUtterance(
                `${empName} attendance marked successfully`
              );

            utterance.rate = 1;

            window.speechSynthesis
              .cancel();

            window.speechSynthesis
              .speak(
                utterance
              );

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
          else
          {
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
        catch (error)
        {
          console.log(error);

          setResultMessage(
            "Connection Error"
          );

          setStatusColor("#ef4444");
        }
        finally
        {
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

  }, [
    isProcessing,
    isCameraReady,
    userData,
    scanSuccess,
    locationReady
  ]);

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