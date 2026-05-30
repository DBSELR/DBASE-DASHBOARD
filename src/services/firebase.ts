import { initializeApp, getApps } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from "firebase/messaging";

import { API_BASE } from "../config";

/* Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyAxbahDANKCJWylY9gHrNXfYM3olBnxKEE",
  authDomain: "bbs-notifications-2d51c.firebaseapp.com",
  projectId: "bbs-notifications-2d51c",
  storageBucket: "bbs-notifications-2d51c.firebasestorage.app",
  messagingSenderId: "656709531884",
  appId: "1:656709531884:web:9ebcecca5e82a6df6b4dc9",
  measurementId: "G-Y9VWEH2W7H",
};

const VAPID_KEY =
  "BD7X_0fm0eL8JFSg3dFrk8m4SCfST3FUcK7L6RlT8tQshFlOmt0tGPHBBIqJ0pNRAYWqIbcA2I7b-N24995C7KU";

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const registerWebPush = async (p0: any): Promise<string | null> => {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    if (!("serviceWorker" in navigator)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = localStorage.getItem("token");
    if (!token) return null;

    let empCode = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      empCode = payload?.empCode;
    } catch {
      return null;
    }

    if (!empCode) return null;

    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    const messaging = getMessaging(app);

    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!fcmToken) return null;

    console.log("[FCM] Token:", fcmToken);

    /* =========================
       SAVE TOKEN TO BACKEND
    ========================= */
    await fetch(`${API_BASE}/Notifications/SavePushToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        EmpCode: empCode,
        FCMToken: fcmToken,
        DeviceInfo: navigator.userAgent,
      }),
    });

    /* =========================
       🔥 ADDED: TEST SEND PUSH
    ========================= */
    await fetch(`${API_BASE}/Notifications/SendPush`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        empCode: empCode,
        title: "Login Successful",
        body: "You are now connected to notifications",
        url: "/",
      }),
    });

    /* Foreground messages */
    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground:", payload);

      const title =
        payload.notification?.title ||
        payload.data?.title ||
        "Notification";

      const body =
        payload.notification?.body ||
        payload.data?.body ||
        "";

      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/logo192.png",
          data: payload.data,
        });
      }
    });

    return fcmToken;
  } catch (error) {
    console.error("[FCM] Error:", error);
    return null;
  }
};