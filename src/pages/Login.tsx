import { useState, useEffect, useRef } from "react";
import { IonPage, IonContent } from "@ionic/react";
import EnterKeyHandler from "../components/EnterKeyHandler";
import { API_BASE } from "../config";
import "./Login.css";

const Login: React.FC = () => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastActive, setToastActive] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Stage 1: Splash Screen duration
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

  const handleLogin = async () => {
    const uname = usernameRef.current?.value || "";
    const pwd = passwordRef.current?.value || "";

    if (!uname || !pwd) {
      showToast("Please enter both username and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}Login/UserLogin?Username=${uname}&Password=${pwd}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        showToast("Invalid username or password!");
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
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
          {/* Custom Validation Toast */}
          <div className={`db-validation-toast ${toastActive ? "active" : ""}`}>
            <span className="db-toast-icon">⚠️</span>
            <span className="db-toast-msg">{errorMsg}</span>
          </div>

          {/* Background Animated Elements */}
          <div className="db-login-bg-shapes">
            <div className="db-shape db-shape-1"></div>
            <div className="db-shape db-shape-2"></div>
          </div>

          {/* Step Handlers for Keyboard */}
          {step === 2 && <EnterKeyHandler onEnter={handleGetStarted} />}
          {step === 3 && <EnterKeyHandler onEnter={handleLogin} />}

          {/* STEP 1: SPLASH SCREEN */}
          {step === 1 && (
            <div className="db-splash-screen">
              <img src="./images/dbase.png" alt="Logo" className="db-animated-logo-large" />
            </div>
          )}

          {/* STEP 2: WELCOME SCREEN */}
          {step === 2 && (
            <div className="db-welcome-screen">
              <img src="./images/dbase.png" alt="Logo" className="db-animated-logo-large" />
              <h1 className="db-welcome-title">WELCOME</h1>
              <p className="db-welcome-subtitle">Your gateway to a smarter workflow. Experience the power of data.</p>
              <button className="db-get-started-btn" onClick={handleGetStarted}>
                Get Started
              </button>
            </div>
          )}

          {/* STEP 3: LOGIN FORM */}
          {step === 3 && (
            <div className="db-login-screen">
              <div className="db-login-header">
                <img src="./images/dbs-logo-short.png" alt="Logo" />
              </div>

              <div className="db-login-card">
                {/* <h2 className="db-login-title">Sign In</h2>
                <p className="db-login-subtitle">Secure access to your dashboard</p> */}

                <div className="db-input-group">
                  <label className="db-input-label">Username</label>
                  <div className="db-input-wrapper">
                    <input
                      type="text"
                      ref={usernameRef}
                      className="db-input-field"
                      placeholder="Username"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="db-input-group">
                  <label className="db-input-label">Password</label>
                  <div className="db-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      ref={passwordRef}
                      className="db-input-field"
                      placeholder="Password"
                      autoComplete="current-password"
                    />
                    <button
                      className="db-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      {showPassword ? "👁️" : "🙈"}
                    </button>
                  </div>
                </div>

                <button
                  className="db-login-button"
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Login"}
                </button>
              </div>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
