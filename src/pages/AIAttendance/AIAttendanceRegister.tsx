import { IonContent, IonPage, IonInput, IonButton, IonSpinner, IonIcon } from '@ionic/react';
import { useState, useEffect } from 'react';
import { useHistory } from 'react-router';
import { API_BASE_URL, AI_API_KEY } from './ai_config';
import { API_BASE } from "../../config";

const AIAttendanceRegister: React.FC = () => {
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [images, setImages] = useState<FileList | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [userData, setUserData] = useState<any>(null);
const [userProfile, setUserProfile] = useState<any>(null);
  const history = useHistory();

  useEffect(() => {

  const storedUser =
    localStorage.getItem("user");

  if (storedUser) {

    const parsed =
      JSON.parse(storedUser);

    setUserData(parsed);

    setUserProfile(parsed);

    // AUTO FILL

    setEmpId(
      parsed?.empCode || ""
    );

    setName(
      parsed?.EmpName ||
      parsed?.empName ||
      ""
    );
  }

}, []);

  const showPopup = (msg: string) => {
    setPopupMessage(msg);
    setTimeout(() => {
        setPopupMessage('');
    }, 4000);
  };



  const handleSubmit = async () => {
    if (!name.trim()) {
      showPopup('Employee name is required.');
      return;
    }
    if (!images || images.length === 0) {
      showPopup('Please attach the facial extraction folder.');
      return;
    }

    

    setIsProcessing(true);

    const formData = new FormData();
    const finalName = empId.trim() ? `${name.trim()} (${empId.trim()})` : name.trim();
    formData.append('name', finalName);
    Array.from(images).forEach((file) => {
      formData.append('images[]', file);
    });

    try {
      const response = await fetch(`${API_BASE}Checkin/UploadModel`, {
        method: 'POST',
        headers: {
          'x-api-key': AI_API_KEY
        },
        body: formData,
      });

      const data = await response.json();

console.log(data);

if (response.ok && data.success) {
    showPopup('Registered Successfully, Thankyou!');
    setTimeout(() => history.push('/ai-attendance-admin-dashboard'), 1500);
} else {
    showPopup(data.message || 'Registration failed.');
    console.error(data);
}
    } catch (error: any) {
   console.error(error);
   showPopup(error.message || 'Server connection failed');
}finally {
      setIsProcessing(false);
    }
  };

  return (
    <IonPage>
  <IonContent
    fullscreen
    style={{
      "--background":
        "linear-gradient(135deg, #0f172a 0%, #111827 50%, #1e293b 100%)",
    }}
  >
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "950px",
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "28px",
          overflow: "hidden",
          backdropFilter: "blur(18px)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
          position: "relative",
        }}
      >
        {/* TOP HEADER */}

        <div
          style={{
            padding: "35px",
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.12))",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "22px",
                background:
                  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "34px",
                boxShadow: "0 10px 25px rgba(99,102,241,0.45)",
              }}
            >
              👤
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  color: "#ffffff",
                  fontSize: "2.4rem",
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                }}
              >
                Face Attendance Registration
              </h1>

              <p
                style={{
                  marginTop: "8px",
                  color: "#94a3b8",
                  fontSize: "1rem",
                  lineHeight: 1.6,
                }}
              >
                Register employee facial data securely for AI-based
                attendance authentication.
              </p>
            </div>
          </div>
        </div>

        {/* BODY */}

        <div
          style={{
            padding: "35px",
          }}
        >
          {/* POPUP */}

          {popupMessage && (
            <div
              style={{
                position: "fixed",
                top: "30px",
                right: "30px",
                background:
                  "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
                padding: "18px 28px",
                borderRadius: "16px",
                zIndex: 99999,
                boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
                fontWeight: 600,
                backdropFilter: "blur(12px)",
              }}
            >
              {popupMessage}
            </div>
          )}

          {/* INFO CARD */}

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "20px",
              padding: "28px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  width: "45px",
                  height: "45px",
                  borderRadius: "14px",
                  background:
                    "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                }}
              >
                📸
              </div>

              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "#ffffff",
                    fontSize: "1.2rem",
                  }}
                >
                  Upload Guidelines
                </h3>

                <span
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.92rem",
                  }}
                >
                  Follow these instructions for better accuracy
                </span>
              </div>
            </div>

            <ul
              style={{
                color: "#cbd5e1",
                lineHeight: 1.9,
                paddingLeft: "22px",
                marginBottom: 0,
              }}
            >
              <li>Upload 3–5 clear employee face images.</li>
              <li>Use proper lighting and front-facing photos.</li>
              <li>Avoid masks, sunglasses, caps, and blurry photos.</li>
              <li>Ensure only one face appears in each image.</li>
              <li>Accepted formats: JPG, PNG, JPEG.</li>
            </ul>
          </div>

          {/* GOOD / BAD */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: "20px",
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "52px",
                  marginBottom: "10px",
                }}
              >
                👤
              </div>

              <h3
                style={{
                  color: "#4ade80",
                  marginBottom: "10px",
                }}
              >
                Recommended
              </h3>

              <p
                style={{
                  color: "#cbd5e1",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Clear face visibility with proper lighting and straight
                angle.
              </p>
            </div>

            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "20px",
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "52px",
                  marginBottom: "10px",
                }}
              >
                🧢🕶️
              </div>

              <h3
                style={{
                  color: "#f87171",
                  marginBottom: "10px",
                }}
              >
                Avoid
              </h3>

              <p
                style={{
                  color: "#cbd5e1",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Covered face, dark lighting, extreme angles, or blurry
                photos.
              </p>
            </div>
          </div>

          {/* REFERENCE IMAGE */}

          <div
            style={{
              marginBottom: "30px",
            }}
          >
            <img
              src="/assets/reference_image.png"
              alt="Reference"
              style={{
                width: "100%",
                maxHeight: "320px",
                objectFit: "cover",
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 15px 40px rgba(0,0,0,0.35)",
              }}
            />
          </div>

          {/* FORM */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "22px",
              marginBottom: "25px",
            }}
          >
            <div>
              <label
                style={{
                  color: "#cbd5e1",
                  fontWeight: 600,
                  marginBottom: "10px",
                  display: "block",
                }}
              >
                Employee Full Name
              </label>

              <input
                type="text"
                value={name}
                readOnly
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#ffffff",
                  fontSize: "1rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  color: "#cbd5e1",
                  fontWeight: 600,
                  marginBottom: "10px",
                  display: "block",
                }}
              >
                Employee ID
              </label>

              <input
                type="text"
                value={empId}
                readOnly
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#ffffff",
                  fontSize: "1rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* FILE UPLOAD */}

          <div
            style={{
              marginBottom: "35px",
            }}
          >
            <label
              style={{
                color: "#cbd5e1",
                fontWeight: 600,
                marginBottom: "10px",
                display: "block",
              }}
            >
              Upload Employee Face Images
            </label>

            <label
              htmlFor="image-upload"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "220px",
                borderRadius: "22px",
                border:
                  images && images.length > 0
                    ? "2px solid #4ade80"
                    : "2px dashed rgba(99,102,241,0.45)",
                background:
                  images && images.length > 0
                    ? "rgba(74,222,128,0.08)"
                    : "rgba(255,255,255,0.03)",
                cursor: "pointer",
                transition: "0.3s",
                textAlign: "center",
                padding: "30px",
              }}
            >
              <div
                style={{
                  fontSize: "4rem",
                  marginBottom: "15px",
                }}
              >
                {images && images.length > 0 ? "✅" : "📂"}
              </div>

              <h3
                style={{
                  color: "#ffffff",
                  marginBottom: "10px",
                }}
              >
                {images && images.length > 0
                  ? `${images.length} Images Selected`
                  : "Select Employee Photo Folder"}
              </h3>

              <p
                style={{
                  color: "#94a3b8",
                  margin: 0,
                }}
              >
                Click here to browse and upload face images
              </p>
            </label>

            <input
              type="file"
              id="image-upload"
              onChange={(e) => setImages(e.target.files)}
              // @ts-ignore
              webkitdirectory="true"
              multiple
              style={{ display: "none" }}
            />
          </div>

          {/* BUTTONS */}

          <div
            style={{
              display: "flex",
              gap: "18px",
            }}
          >
            <IonButton
              expand="block"
              shape="round"
              onClick={handleSubmit}
              disabled={isProcessing}
              style={{
                flex: 1,
                height: "58px",
                fontSize: "1.1rem",
                fontWeight: 700,
                "--background":
                  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                "--box-shadow":
                  "0 15px 35px rgba(99,102,241,0.35)",
              }}
            >
              {isProcessing ? (
                <IonSpinner name="bubbles" />
              ) : (
                "Register Face"
              )}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              shape="round"
              onClick={() =>
                history.push(
                  "/ai-attendance-admin-dashboard"
                )
              }
              style={{
                flex: 1,
                height: "58px",
                fontSize: "1.1rem",
                fontWeight: 700,
                "--border-color": "rgba(255,255,255,0.15)",
                "--color": "#ffffff",
              }}
            >
              Back to Home
            </IonButton>
          </div>
        </div>
      </div>
    </div>
  </IonContent>
</IonPage>
  );
};

export default AIAttendanceRegister;
