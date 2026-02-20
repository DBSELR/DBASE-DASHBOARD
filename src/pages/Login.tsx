import { useState, useEffect, useRef } from "react";
import {
  IonPage,
  IonContent,
  IonButton,
  IonInput,
  IonLabel,
} from "@ionic/react";
import EnterKeyHandler from "../components/EnterKeyHandler";

const Login: React.FC = () => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const usernameRef = useRef<HTMLIonInputElement>(null);
  const passwordRef = useRef<HTMLIonInputElement>(null);

  useEffect(() => {
    setTimeout(() => setStep(2), 3000);
  }, []);

  const handleGetStarted = () => {
    setStep(3);
  };

  const handleLogin = async () => {
    const uname = usernameRef.current?.value?.toString() || "";
    const pwd = passwordRef.current?.value?.toString() || "";

    if (!uname || !pwd) {
      alert("Please enter both username and password.");
      return;
    }

    setUsername(uname);
    setPassword(pwd);

    try {
      const response = await fetch(
        `https://api.dbasesolutions.in/api/Login/UserLogin?Username=${uname}&Password=${pwd}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        alert("Invalid username or password!");
        return;
      }

      const data = await response.json();

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "/home";
      } else {
        alert("Login failed! Please try again.");
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("Something went wrong. Try again later.");
    }
  };

  return (
    <IonPage>
      {step === 2 && <EnterKeyHandler onEnter={handleGetStarted} />}
      {step === 3 && <EnterKeyHandler onEnter={handleLogin} />}

      <IonContent className="auth-container">
        {step === 1 && (
          <div className="splash-screen">
            <img src="./images/dbase.png" alt="Logo" className="animated-logo" />
          </div>
        )}

        {step === 2 && (
          <div className="get-started-screen">
            <h1 style={{ fontWeight: "800", color: "#333" }}>WELCOME</h1>
            <img src="./images/dbase.png" alt="Logo" className="animated-logo" />
            <IonButton
              expand="block"
              onClick={handleGetStarted}
              className="login-btn2"
              style={{ "--box-shadow": "none" }}
              color={"#f57c00"}
            >
              Get Started
            </IonButton>
          </div>
        )}

        {step === 3 && (
          <div className="login-screen">
            <img src="./images/dbase.png" alt="Logo" className="animated-logo" />
            <div className="login-box">
              <h2>Login</h2>
              <div className="input-group">
                <IonLabel>Username</IonLabel>
                <IonInput
                  ref={usernameRef}
                  placeholder="Enter Username"
                  value={username}
                  onIonChange={(e) => setUsername(e.detail.value!)}
                />
              </div>
              <div className="input-group">
                <IonLabel>Password</IonLabel>
                <IonInput
                  ref={passwordRef}
                  type="password"
                  placeholder="Enter Password"
                  value={password}
                  onIonChange={(e) => setPassword(e.detail.value!)}
                />
              </div>
              <IonButton
                expand="block"
                onClick={handleLogin}
                className="login-btn"
                style={{ "--box-shadow": "none" }}
                color={"#f57c00"}
              >
                Login
              </IonButton>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Login;
