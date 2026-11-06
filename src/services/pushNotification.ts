import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
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

const EXCLUDED_WORK_REPORT_EMP_CODES = ["1501", "2001"];
const LEGACY_ALARM_IDS = [1800, 1820, 1829, 1830, 1930, 2030];

let nativeListenersRegistered = false;
let webListenerRegistered = false;
let currentActiveEmpCode = "";

// Helper to get IST Date components and both padded (YYYY-MM-DD) & unpadded (YYYY-M-D) keys
export const getIstDateInfo = (now: Date = new Date()) => {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utcMs + 5.5 * 3600000);
  const year = istDate.getFullYear();
  const month = istDate.getMonth() + 1;
  const day = istDate.getDate();
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();

  const unpaddedKey = `${year}-${month}-${day}`;
  const paddedKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { year, month, day, hours, minutes, unpaddedKey, paddedKey };
};

export const isWorkReportSubmittedToday = (now: Date = new Date()): boolean => {
  try {
    const { unpaddedKey, paddedKey } = getIstDateInfo(now);
    return (
      localStorage.getItem(`work_report_submitted_${unpaddedKey}`) === "true" ||
      localStorage.getItem(`work_report_submitted_${paddedKey}`) === "true"
    );
  } catch {
    return false;
  }
};

export const isWorkReportSlotDismissed = (slot: string, now: Date = new Date()): boolean => {
  try {
    const { unpaddedKey, paddedKey } = getIstDateInfo(now);
    const dismissed = localStorage.getItem("work_report_dismissed_time");
    return dismissed === `${unpaddedKey}_${slot}` || dismissed === `${paddedKey}_${slot}`;
  } catch {
    return false;
  }
};

// Helper to determine slot based on IST time
const getNotificationSlot = (now: Date = new Date()): string => {
  const { hours: h, minutes: m } = getIstDateInfo(now);
  if (h > 20 || (h === 20 && m >= 30)) return "20_30";
  if (h > 19 || (h === 19 && m >= 30)) return "19_30";
  return "18_30";
};

const getLoggedInEmpCode = (): string | null => {
  try {
    const u = JSON.parse(localStorage.getItem("user") ?? "{}");
    const code = u?.empCode || u?.EmpCode || currentActiveEmpCode;
    return code ? String(code).trim() : null;
  } catch {
    return currentActiveEmpCode ? String(currentActiveEmpCode).trim() : null;
  }
};

// POST token to backend
const savePushTokenToBackend = async (empCode: string, token: string, isNative: boolean) => {
  if (!empCode || empCode === "anonymous") {
    console.log("ℹ️ [Push] Anonymous registration, caching token locally until user logs in.");
    try {
      localStorage.setItem("last_native_push_token", token);
    } catch {}
    return true;
  }

  try {
    localStorage.setItem("last_native_push_token", token);
  } catch {}

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

// Clear any legacy local repeating work report alarms on Android & iOS
// (Server-side WorkReportSchedulerService dispatches exact 6:30 PM, 7:30 PM, and 8:30 PM IST pushes
// while filtering out Sundays, holidays, excluded EmpCodes, and already-submitted reports).
export const clearWorkReportLocalAlarms = async (): Promise<void> => {
  try {
    if (!Capacitor.isNativePlatform()) return;

    const notificationsToCancel = LEGACY_ALARM_IDS.map((id) => ({ id }));

    try {
      const pending = await LocalNotifications.getPending();
      if (pending?.notifications && pending.notifications.length > 0) {
        for (const n of pending.notifications) {
          if (typeof n.id === "number" && !LEGACY_ALARM_IDS.includes(n.id)) {
            notificationsToCancel.push({ id: n.id });
          }
        }
      }
    } catch {}

    await LocalNotifications.cancel({ notifications: notificationsToCancel }).catch(() => {});
    console.log("🧹 [LocalNotifications] Cleared legacy repeating local alarms:", notificationsToCancel.map(n => n.id));
  } catch (e) {
    console.warn("⚠️ [LocalNotifications] Error clearing legacy alarms:", e);
  }
};

// Ensure notification channels exist and clear any stuck legacy local repeating alarms
export const scheduleDailyWorkReportAlarms = async (): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        await LocalNotifications.requestPermissions();
      }

      // Create Android channel
      if (Capacitor.getPlatform() === "android") {
        await LocalNotifications.createChannel({
          id: "work_report_high_importance",
          name: "Daily Work Report Reminders",
          description: "High importance alarms for daily work reports",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
          lightColor: "#DC2626"
        });
      }

      // Cancel any previously scheduled local repeating alarms so they never fire at random intervals.
      // Daily reminders at 6:30 PM, 7:30 PM, and 8:30 PM IST are dispatched by backend WorkReportSchedulerService.
      await clearWorkReportLocalAlarms();
    }
  } catch (e) {
    console.warn("⚠️ [LocalNotifications] Failed to initialize local notification channel / clear legacy alarms:", e);
  }
};

// Register Native Push Notifications (Capacitor)
const registerNative = async (empCode: string) => {
  currentActiveEmpCode = empCode;

  try {
    console.log("🚀 [Push] Registering Native Push for:", empCode);

    // If we have a cached native token and a valid empCode, upload immediately
    const cachedToken = localStorage.getItem("last_native_push_token");
    if (cachedToken && empCode && empCode !== "anonymous") {
      console.log("⚡ [Push] Found cached native token, syncing with backend for:", empCode);
      await savePushTokenToBackend(empCode, cachedToken, true);
    }

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt") {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== "granted") {
      console.warn("❌ [Push] Native permission denied");
      return;
    }

    // Initialize local notification channels & purge any legacy repeating local alarms
    await scheduleDailyWorkReportAlarms();

    // Create Android High Importance Channels for Heads-up floating notifications
    if (Capacitor.getPlatform() === "android") {
      try {
        await PushNotifications.createChannel({
          id: "work_report_high_importance",
          name: "Work Report High Importance Alerts",
          description: "Heads-up banner alerts for daily work report and broadcast alerts",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
          lightColor: "#DC2626"
        });
        await PushNotifications.createChannel({
          id: "payment_reminder_channel",
          name: "Payment Reminders",
          description: "Payment collection and reminder notifications",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
          lightColor: "#2563EB"
        });
        await PushNotifications.createChannel({
          id: "penalty_high_importance",
          name: "Penalty Alerts",
          description: "Urgent penalty alerts",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
          lightColor: "#DC2626"
        });
        console.log("✅ [Push] Android Notification Channels Created");
      } catch (channelErr) {
        console.warn("⚠️ [Push] Error creating native channels:", channelErr);
      }
    }

    if (!nativeListenersRegistered) {
      nativeListenersRegistered = true;

      await PushNotifications.addListener("registration", async (token) => {
        console.log("✅ [Push] Native APNs/FCM Token Received:", token.value);
        await savePushTokenToBackend(currentActiveEmpCode || empCode, token.value, true);
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.error("❌ [Push] Native registration error:", error);
      });

      // Handle Foreground Push
      await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
        console.log("📩 [Push] Foreground Push Received:", notification);

        const data = notification.data || {};
        const myEmpCode = getLoggedInEmpCode();
        const targetEmpCode = data?.empCode || data?.EmpCode;

        if (targetEmpCode && myEmpCode && String(targetEmpCode).trim() !== String(myEmpCode).trim()) {
          console.log("[Push] Ignored foreground push intended for another user:", targetEmpCode);
          return;
        }

        const type = data?.type || data?.tID || "";
        const isWorkReportReminder =
          type === "work_report_reminder" || type === "WORK_REPORT_REMINDER";

        if (isWorkReportReminder) {
          if (myEmpCode && EXCLUDED_WORK_REPORT_EMP_CODES.includes(myEmpCode)) {
            console.log("ℹ️ [Push] Suppressing work report push for excluded user:", myEmpCode);
            return;
          }

          const slot = data?.slot || getNotificationSlot();
          if (isWorkReportSubmittedToday() || isWorkReportSlotDismissed(slot)) {
            console.log("ℹ️ [Push] Suppressing foreground work report push — already submitted or dismissed for slot:", slot);
            return;
          }
        }

        // Use deterministic notification ID for work report slots so notifications replace instead of stacking
        const slot = data?.slot || getNotificationSlot();
        const notifId = isWorkReportReminder
          ? slot === "20_30"
            ? 2030
            : slot === "19_30"
              ? 1930
              : 1830
          : Math.floor((Date.now() % 80000) + 10000);

        // Show heads-up floating banner via Local Notifications when in foreground
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: notifId,
                title: notification.title || data?.title || "Notification",
                body: notification.body || data?.body || "",
                channelId: "work_report_high_importance",
                sound: "default",
                smallIcon: "ic_launcher",
                extra: data
              }
            ]
          });
        } catch (localErr) {
          console.warn("Could not display foreground local banner:", localErr);
        }
      });

      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("📩 [Push] Tap action performed:", action);
        const data = action.notification?.data;
        const targetUrl = data?.url || data?.targetUrl || "/workreport";
        window.location.href = targetUrl;
      });

      // Tap on Local Notification
      try {
        LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
          console.log("📩 [LocalNotification] Tap action performed:", action);
          const data = action.notification?.extra;
          const targetUrl = data?.url || data?.targetUrl || "/workreport";
          window.location.href = targetUrl;
        });
      } catch (e) {}
    }

    await PushNotifications.register();
  } catch (error) {
    console.error("❌ [Push] Native registration failed:", error);
  }
};

let webRegistrationInProgress = false;
let webRegistrationAttempted = false;

// Register Web Push Notifications (FCM Web SDK)
const registerWeb = async (empCode: string) => {
  if (webRegistrationInProgress || webRegistrationAttempted) {
    return;
  }
  webRegistrationInProgress = true;

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
    webRegistrationAttempted = true;

    if (!webListenerRegistered) {
      webListenerRegistered = true;

      onMessage(messaging, (payload) => {
        console.log("📩 [Push] Foreground Web Message:", payload);

        const myEmpCode = getLoggedInEmpCode();
        const targetEmpCode = payload.data?.empCode || payload.data?.EmpCode;
        if (targetEmpCode && myEmpCode && String(targetEmpCode).trim() !== String(myEmpCode).trim()) {
          console.log("[Push] Ignored web push message intended for user:", targetEmpCode);
          return;
        }

        const type = payload.data?.type || payload.data?.tID || "work_report_reminder";
        const { paddedKey: todayStr } = getIstDateInfo();

        // Check if work report reminder was already dismissed or submitted today
        if (type === "work_report_reminder" || type === "WORK_REPORT_REMINDER") {
          if (myEmpCode && EXCLUDED_WORK_REPORT_EMP_CODES.includes(myEmpCode)) {
            return;
          }
          const slot = payload.data?.slot || getNotificationSlot();
          if (isWorkReportSubmittedToday() || isWorkReportSlotDismissed(slot)) {
            console.log("ℹ️ [Push] Suppressing push notification, already dismissed or submitted today.");
            return;
          }
        }

        const slot = payload.data?.slot || getNotificationSlot();
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
  } catch (error: any) {
    webRegistrationAttempted = true;
    if (error?.message?.includes("Failed to fetch") || error?.name === "TypeError" || String(error).includes("Failed to fetch")) {
      console.warn("⚠️ [Push] Firebase Installations endpoint is unreachable. Skipping web push.");
    } else {
      console.error("❌ [Push] Web registration failed:", error);
    }
  } finally {
    webRegistrationInProgress = false;
  }
};

export const registerNativePush = async (empCode: string): Promise<void> => {
  currentActiveEmpCode = empCode;

  if (Capacitor.isNativePlatform()) {
    await registerNative(empCode);
  } else {
    await registerWeb(empCode);
  }
};
