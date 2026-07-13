import { useState, useEffect, useRef } from "react";
import { IonPage, IonContent } from "@ionic/react";
import { useHistory } from "react-router-dom";
import EnterKeyHandler from "../components/EnterKeyHandler";
import { API_BASE } from "../config";
import { registerNativePush } from "../services/pushNotification";

import "./Login.css";

const Login: React.FC = () => {
  const history = useHistory();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastActive, setToastActive] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setStep(2), 2500);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (msg: string) => {
    setErrorMsg(msg);
    setToastActive(true);
    setTimeout(() => setToastActive(false), 3500);
  };

  const handleGetStarted = () => {
    setStep(3);
  };

  // 🔥 LOGIN FUNCTION (FIXED)
  const handleLogin = async () => {
    const uname = usernameRef.current?.value || "";
    const pwd = passwordRef.current?.value || "";

    if (!uname || !pwd) {
      showToast("Please enter both username and password.");
      return;
    }

    setLoading(true);

    try {
      console.log("🔥 LOGIN CLICKED");

      const response = await fetch(
        `${API_BASE}Login/UserLogin?Username=${uname}&Password=${pwd}`,
        {
          method: "GET",
        }
      );

      console.log("📡 API CALLED");

      if (!response.ok) {
        showToast("Invalid username or password!");
        setLoading(false);
        return;
      }

      const data = await response.json();

     if (data.token) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));

  const empCode =
    data.user?.EmpCode || data.user?.empCode || uname;

  console.log("👤 EmpCode:", empCode);

  try {
    console.log("🚀 Calling registerNativePush");
    await registerNativePush(empCode);
  } catch (err) {
    console.error("❌ registerNativePush failed:", err);
  }

  window.location.href = "/home";


      } else {
        showToast("Login failed! Please try again.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Login Error:", error);
      showToast("Connection error. Try again later.");
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="db-login-page-container" scrollY={true}>
        <div className="db-login-page">

          {/* Toast */}
          <div className={`db-validation-toast ${toastActive ? "active" : ""}`}>
            <span className="db-toast-icon">⚠️</span>
            <span className="db-toast-msg">{errorMsg}</span>
          </div>

          {/* Background */}
          <div className="db-login-bg-shapes">
            <div className="db-shape db-shape-1"></div>
            <div className="db-shape db-shape-2"></div>
          </div>

          {step === 2 && <EnterKeyHandler onEnter={handleGetStarted} />}
          {step === 3 && <EnterKeyHandler onEnter={handleLogin} />}

          {/* Splash */}
          {step === 1 && (
            <div className="db-splash-screen">
              <img src="./images/dbase.png" className="db-animated-logo-large" />
            </div>
          )}

          {/* Welcome */}
          {step === 2 && (
            <div className="db-welcome-screen">
              <img src="./images/dbase.png" className="db-animated-logo-large" />
              <h1 className="db-welcome-title">WELCOME</h1>
              <button className="db-get-started-btn" onClick={handleGetStarted}>
                Get Started
              </button>
            </div>
          )}

          {/* Login */}
          {step === 3 && (
            <div className="db-login-screen">
              <form
                className="db-login-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin();
                }}
              >
                {/* Username */}
                            <div className="db-input-group">
              <label className="db-input-label">Username</label>

              <input
                type="text"
                ref={usernameRef}
                className="db-input-field"
                placeholder="Username"
              />
            </div>

                {/* Password */}
<div className="db-input-group">
  <label className="db-input-label">Password</label>

  <div className="db-input-wrapper">
    <input
      type={showPassword ? "text" : "password"}
      ref={passwordRef}
      className="db-input-field"
      placeholder="Password"
    />

    <button
      type="button"
      className="db-password-toggle"
      onClick={() => setShowPassword(!showPassword)}
    >
      {showPassword ? "👁️" : "🙈"}
    </button>
  </div>
</div>

                {/* IMPORTANT FIX: ONLY SUBMIT BUTTON */}
                <button
                  type="submit"
                  className="db-login-button"
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Login"}
                </button>
              </form>
            </div>
          )}

          {/* Footer Links */}
          <div className="db-login-footer-links-container">
            <button
              type="button"
              className="db-login-footer-link-item"
              onClick={() => history.push("/terms")}
            >
              Terms & Conditions
            </button>
            <button
              type="button"
              className="db-login-footer-link-item"
              onClick={() => history.push("/privacy")}
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;