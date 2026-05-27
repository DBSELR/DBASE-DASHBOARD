import { initializeApp, getApps } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from "firebase/messaging";

import { API_BASE } from "../config";

/* =========================
   🔥 FIREBASE CONFIG (NEW)
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyAxbahDANKCJWylY9gHrNXfYM3olBnxKEE",
  authDomain: "bbs-notifications-2d51c.firebaseapp.com",
  projectId: "bbs-notifications-2d51c",
  storageBucket: "bbs-notifications-2d51c.firebasestorage.app",
  messagingSenderId: "656709531884",
  appId: "1:656709531884:web:9ebcecca5e82a6df6b4dc9",
  measurementId: "G-Y9VWEH2W7H",
};

/* =========================
   🔑 VAPID KEY (NEW)
========================= */
const VAPID_KEY =
  "BD7X_0fm0eL8JFSg3dFrk8m4SCfST3FUcK7L6RlT8tQshFlOmt0tGPHBBIqJ0pNRAYWqIbcA2I7b-N24995C7KU";

/* =========================
   INIT FIREBASE APP (SAFE)
========================= */
const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

/* =========================
   REGISTER PUSH NOTIFICATIONS
========================= */
export const registerWebPush = async (
  empCode: string
): Promise<string | null> => {
  try {
    const supported = await isSupported();

    if (!supported) {
      console.warn("[FCM] Not supported in this browser");
      return null;
    }

    if (!("serviceWorker" in navigator)) {
      console.warn("[FCM] Service Worker not supported");
      return null;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("[FCM] Permission denied");
      return null;
    }

    /* =========================
       REGISTER SERVICE WORKER
    ========================= */
    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    console.log("[FCM] Service Worker Registered");

    const messaging = getMessaging(app);

    /* =========================
       GET FCM TOKEN
    ========================= */
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!currentToken) {
      console.warn("[FCM] Token not generated");
      return null;
    }

    console.log("[FCM] TOKEN:", currentToken);

    /* =========================
       SAVE TOKEN TO BACKEND
    ========================= */
    const deviceInfo = navigator.userAgent;
    await fetch(`${API_BASE}Notifications/SavePushToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({
        EmpCode: empCode,
        FCMToken: currentToken,
        DeviceInfo: deviceInfo
      }),
    });

    console.log("[FCM] Token saved to backend");

    /* =========================
       FOREGROUND NOTIFICATIONS
       (IMPORTANT FIXED FOR MOBILE)
    ========================= */
    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground Message:", payload);

      const title =
        payload.notification?.title || "Office Dashboard";

      if (Notification.permission === "granted") {
        swRegistration.showNotification(title, {
          body:
            payload.notification?.body ||
            "You have a new notification",
          icon: "/logo192.png",
          data: payload.data,
        });
      }
    });

    return currentToken;
  } catch (error) {
    console.error("[FCM] Error:", error);
    return null;
  }
};