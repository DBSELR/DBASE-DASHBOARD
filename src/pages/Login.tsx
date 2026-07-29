import { useState, useEffect, useRef, useCallback } from "react";
import { IonPage, IonContent } from "@ionic/react";
import { useHistory } from "react-router-dom";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import type { Engine } from "tsparticles-engine";
import EnterKeyHandler from "../components/EnterKeyHandler";
import { API_BASE } from "../config";
import { registerNativePush } from "../services/pushNotification";
import { User, Lock, Eye, EyeOff, Bot } from "lucide-react";

import "./Login.css";

const Login: React.FC = () => {
  const history = useHistory();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastActive, setToastActive] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [themeColors, setThemeColors] = useState<string[]>(["#f57c00", "#ffab40", "#fb923c"]);
  const [primaryColor, setPrimaryColor] = useState<string>("#f57c00");

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  useEffect(() => {
    const getThemeColors = () => {
      const style = getComputedStyle(document.documentElement);
      const primary = style.getPropertyValue('--ion-color-primary').trim() || "#f57c00";
      const secondary = style.getPropertyValue('--ion-color-secondary').trim() || "#ffab40";
      const tertiary = style.getPropertyValue('--ion-color-tertiary').trim() || "#fb923c";
      
      setPrimaryColor(primary);
      setThemeColors([primary, secondary, tertiary]);
    };

    getThemeColors();
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

  // Trigger door animation and delay routing
  setIsAuthenticating(true);
  setTimeout(() => {
    window.location.href = "/home";
  }, 1200);

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
        <div className={`db-login-page ${isAuthenticating ? 'door-portal-zoom' : ''}`}>

          {/* Background */}
          <div className="db-login-bg-shapes">
            <Particles
              id="tsparticles"
              init={particlesInit}
              options={{
                fullScreen: { enable: false, zIndex: 0 },
                particles: {
                  number: { value: 60, density: { enable: true, value_area: 800 } },
                  color: { value: themeColors },
                  shape: { type: "circle" },
                  opacity: { value: 0.6, random: true },
                  size: { value: 4, random: true },
                  move: {
                    enable: true,
                    speed: 1.5,
                    direction: "none",
                    random: true,
                    straight: false,
                    outModes: { default: "bounce" },
                    bounce: false,
                  },
                  links: {
                    enable: true,
                    distance: 120,
                    color: primaryColor,
                    opacity: 0.2,
                    width: 1,
                  },
                },
                interactivity: {
                  events: {
                    onHover: { enable: true, mode: "grab" },
                    onClick: { enable: true, mode: "push" },
                    resize: true,
                  },
                  modes: {
                    grab: { distance: 140, links: { opacity: 0.5 } },
                    push: { quantity: 3 },
                  },
                },
                detectRetina: true,
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
            />
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
              <div className={`db-login-card-wrapper ${isAuthenticating ? 'door-open' : ''} ${toastActive ? 'shake-error' : ''}`}>
                
                {/* 3D Error Avatar Peek */}
                <div className={`db-error-peek-container ${toastActive ? "active" : ""}`}>
                  <div className="db-error-avatar-3d">
                    <Bot size={28} color="#fff" />
                  </div>
                  <div className="db-error-speech-bubble">
                    {errorMsg === "Invalid username or password!" ? "Please Check your Login Credentials" : errorMsg}
                  </div>
                </div>

                <div className="db-login-card-glow"></div>
                <form
                  className="db-login-card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLogin();
                  }}
                >
                  
                  <div className="db-login-card-header">
                    <h2 className="db-login-title">Welcome Back</h2>
                    <p className="db-login-subtitle">Sign in to continue to Dbase</p>
                  </div>
                {/* Username */}
                <div className="db-input-group">
                  <label className="db-input-label">Username</label>
                  <div className="db-input-wrapper">
                    <User className="db-input-icon" size={20} />
                    <input
                      type="text"
                      ref={usernameRef}
                      className="db-input-field with-icon"
                      placeholder="Enter your username"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="db-input-group">
                  <label className="db-input-label">Password</label>
                  <div className="db-input-wrapper">
                    <Lock className="db-input-icon" size={20} />
                    <input
                      type={showPassword ? "text" : "password"}
                      ref={passwordRef}
                      className="db-input-field with-icon"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="db-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
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