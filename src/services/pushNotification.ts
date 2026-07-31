import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { API_BASE } from "../config";

const firebaseConfig = {
  apiKey: "AIzaSyAxbahDANKCJWylY9gHrNXfYM3olBnxKEE",
  authDomain: "bbs-notifications-2d51c.firebaseapp.com",
  projectId: "bbs-notifications-2d51c",
  storageBucket: "bbs-notifications-2d51c.firebasestorage.app",
  messagingSenderId: "656709531884",
  appId: "1:656709531884:web:9ebcecca5e82a6df6b4dc9",
  measurementId: "G-Y9VWEH2W7H",
};

const VAPID_KEY = "BD7X_0fm0eL8JFSg3dFrk8m4SCfST3FUcK7L6RlT8tQshFlOmt0tGPHBBIqJ0pNRAYWqIbcA2I7b-N24995C7KU";

let nativeListenersRegistered = false;
let webListenerRegistered = false;

// POST token to backend
const savePushTokenToBackend = async (empCode: string, token: string, isNative: boolean) => {
  if (empCode === "anonymous") {
    console.log("ℹ️ [Push] Anonymous registration, skipping backend token upload.");
    return true;
  }

  const jwtToken = localStorage.getItem("token");
  const saveUrl = `${API_BASE}Notifications/SavePushToken`;

  console.log(`📡 [Push] Saving ${isNative ? "native" : "web"} push token to backend:`, saveUrl);
  try {
    const res = await fetch(saveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken?.replace(/"/g, "") || ""}`,
      },
      body: JSON.stringify({
        EmpCode: empCode,
        FCMToken: token,
        DeviceInfo: isNative ? `${Capacitor.getPlatform().toUpperCase()} Native - ${navigator.userAgent}` : `Web Browser - ${navigator.userAgent}`,
      }),
    });

    console.log("📡 [Push] Save Status:", res.status);
    const responseText = await res.text();
    console.log("📡 [Push] Save Response:", responseText);
    return res.ok;
  } catch (error) {
    console.error("❌ [Push] Error posting token to backend:", error);
    return false;
  }
};

// Register Native Push Notifications (Capacitor)
const registerNative = async (empCode: string) => {
  try {
    console.log("🚀 [Push] Registering Native Push for:", empCode);

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt") {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== "granted") {
      console.warn("❌ [Push] Native permission denied");
      return;
    }

    // Create Android High Importance Channel for Heads-up floating notifications
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'work_report_high_importance',
          name: 'Work Report High Importance Alerts',
          description: 'Heads-up banner alerts for daily work report reminders',
          importance: 5, // 5 = IMPORTANCE_HIGH (Floating Heads-Up Banner on Android)
          visibility: 1, // PUBLIC (Show on lockscreen)
          sound: 'default',
          vibration: true,
          lights: true,
          lightColor: '#DC2626'
        });
        console.log("✅ [Push] Android High Importance Channel Created");
      } catch (channelErr) {
        console.warn("⚠️ [Push] Error creating native channel:", channelErr);
      }
    }

    if (!nativeListenersRegistered) {
      nativeListenersRegistered = true;

      await PushNotifications.addListener("registration", async (token) => {
        console.log("✅ [Push] Native APNs/FCM Token:", token.value);
        await savePushTokenToBackend(empCode, token.value, true);
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.error("❌ [Push] Native registration error:", error);
      });

      await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("📩 [Push] Foreground Push Received:", notification);
      });

      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("📩 [Push] Tap action performed:", action);
        const data = action.notification?.data;
        const targetUrl = data?.url || data?.targetUrl || "/workreport";
        window.location.href = targetUrl;
      });
    }

    await PushNotifications.register();
  } catch (error) {
    console.error("❌ [Push] Native registration failed:", error);
  }
};

// Register Web Push Notifications (FCM Web SDK)
const registerWeb = async (empCode: string) => {
  try {
    console.log("🚀 [Push] Registering Web Push for:", empCode);

    const supported = await isSupported();
    if (!supported) {
      console.log("❌ [Push] Web Push not supported in this browser");
      return;
    }

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      console.log("❌ [Push] ServiceWorker/Notification API not supported");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("❌ [Push] Browser permission denied");
      return;
    }

    const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    console.log("✅ [Push] Service Worker Registered for Web");

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const messaging = getMessaging(app);

    const webToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!webToken) {
      console.log("❌ [Push] Web token not generated");
      return;
    }

    console.log("✅ [Push] Web Token Generated:", webToken);
    await savePushTokenToBackend(empCode, webToken, false);

    if (!webListenerRegistered) {
      webListenerRegistered = true;

      onMessage(messaging, (payload) => {
        console.log("📩 [Push] Foreground Web Message:", payload);

        // Safeguard: verify empCode if present in payload data
        try {
          const u = JSON.parse(localStorage.getItem("user") ?? "{}");
          const myEmpCode = (u?.empCode || u?.EmpCode) ? String(u.empCode || u.EmpCode) : null;
          const targetEmpCode = payload.data?.empCode || payload.data?.EmpCode;
          if (targetEmpCode && myEmpCode && String(targetEmpCode).trim() !== String(myEmpCode).trim()) {
            console.log("[Push] Ignored web push message intended for user:", targetEmpCode);
            return;
          }
        } catch (e) {
          console.warn("[Push] Error checking user code in onMessage:", e);
        }

        const type = payload.data?.type || payload.data?.tID || "work_report_reminder";
        const todayStr = new Date().toISOString().split("T")[0];

        // Check if work report reminder was already dismissed or submitted today
        if (type === "work_report_reminder" || type === "WORK_REPORT_REMINDER") {
          const now = new Date();
          const slot = (now.getHours() > 18 || (now.getHours() === 18 && now.getMinutes() >= 20)) ? "18_20" : "18_00";
          const dismissed = localStorage.getItem("work_report_dismissed_time") === `${todayStr}_${slot}`;
          const submitted = localStorage.getItem(`work_report_submitted_${todayStr}`) === "true";
          if (dismissed || submitted) {
            console.log("ℹ️ [Push] Suppressing push notification, already dismissed or submitted today.");
            return;
          }
        }

        const slot = payload.data?.slot || ((new Date().getHours() > 18 || (new Date().getHours() === 18 && new Date().getMinutes() >= 20)) ? "18_20" : "18_00");
        const title = payload.notification?.title || payload.data?.title || "Notification";
        const body = payload.notification?.body || payload.data?.body || "";
        const tag = `${type}_${todayStr}_${slot}`;

        if (Notification.permission === "granted") {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon: "/images/dbase.png",
              badge: "/images/dbs-logo-short.png",
              tag,
              renotify: false,
              data: payload.data,
            } as any);
          });
        }
      });
    }
  } catch (error) {
    console.error("❌ [Push] Web registration failed:", error);
  }
};

export const registerNativePush = async (empCode: string): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    await registerNative(empCode);
  } else {
    await registerWeb(empCode);
  }
};
