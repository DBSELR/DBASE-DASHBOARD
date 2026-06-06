import { initializeApp, getApps } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from "firebase/messaging";

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

const VAPID_KEY =
  "BD7X_0fm0eL8JFSg3dFrk8m4SCfST3FUcK7L6RlT8tQshFlOmt0tGPHBBIqJ0pNRAYWqIbcA2I7b-N24995C7KU";

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let listenerRegistered = false;

export const registerWebPush = async (
  empCodeFromLogin: string
): Promise<string | null> => {
  try {
    console.log("🚀 [FCM] registerWebPush called");

    const supported = await isSupported();
    console.log("✅ [FCM] Supported:", supported);

    if (!supported) {
      console.log("❌ [FCM] Firebase Messaging not supported");
      return null;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("❌ [FCM] Service Worker not supported");
      return null;
    }

    if (!("Notification" in window)) {
      console.log("❌ [FCM] Notification API not supported");
      return null;
    }

    const permission = await Notification.requestPermission();
    console.log("✅ [FCM] Notification Permission:", permission);

    if (permission !== "granted") {
      console.log("❌ [FCM] Notification permission denied");
      return null;
    }

    const empCode = empCodeFromLogin?.toString().trim();

    console.log("👤 [FCM] EmpCode:", empCode);

    if (!empCode) {
      console.log("❌ [FCM] EmpCode missing");
      return null;
    }

    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    console.log("✅ [FCM] Service Worker Registered");

    const messaging = getMessaging(app);

    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!fcmToken) {
      console.log("❌ [FCM] Token not generated");
      return null;
    }

    console.log("✅ [FCM] Token Generated:", fcmToken);

    const jwtToken = localStorage.getItem("token");

    console.log("🔐 [FCM] JWT Present:", !!jwtToken);

    const saveUrl = `${API_BASE}Notifications/SavePushToken`;

    console.log("📡 [FCM] Calling:", saveUrl);

    const saveRes = await fetch(saveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        EmpCode: empCode,
        FCMToken: fcmToken,
        DeviceInfo: navigator.userAgent,
      }),
    });

    console.log("📡 [FCM] Save Status:", saveRes.status);

    const responseText = await saveRes.text();

    console.log("📡 [FCM] Save Response:", responseText);

    if (!saveRes.ok) {
      console.log("❌ [FCM] SavePushToken failed");
      return null;
    }

    if (!listenerRegistered) {
      listenerRegistered = true;

      onMessage(messaging, (payload) => {
        console.log("📩 [FCM] Foreground Message:", payload);

        const title =
          payload.notification?.title ||
          payload.data?.title ||
          "Notification";

        const body =
          payload.notification?.body ||
          payload.data?.body ||
          "";

        if (Notification.permission === "granted") {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              body,
              icon: "/logo192.png",
              data: payload.data,
            });
          });
        }
      });
    }

    console.log("🎉 [FCM] Registration Complete");

    return fcmToken;
  } catch (error) {
    console.error("❌ [FCM] Error:", error);
    return null;
  }
};