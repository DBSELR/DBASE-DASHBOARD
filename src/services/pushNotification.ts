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

let nativeListenersRegistered = false;
let webListenerRegistered = false;
let currentActiveEmpCode = "";

// Helper to determine slot based on time
const getNotificationSlot = (now: Date = new Date()): string => {
  const h = now.getHours();
  const m = now.getMinutes();
  if (h > 20 || (h === 20 && m >= 30)) return "20_30";
  if (h > 19 || (h === 19 && m >= 30)) return "19_30";
  return "18_30";
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

// Schedule Local Notifications across Android, iOS & Web
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

      // Schedule alarms for 6:30 PM, 7:30 PM, and 8:30 PM
      await LocalNotifications.cancel({ notifications: [{ id: 1829 }, { id: 1830 }, { id: 1930 }, { id: 2030 }] }).catch(() => {});

      const now = new Date();

      const getScheduleDate = (hour: number, minute: number) => {
        const target = new Date();
        target.setHours(hour, minute, 0, 0);
        if (target.getTime() <= now.getTime()) {
          target.setDate(target.getDate() + 1);
        }
        return target;
      };

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1830,
            title: "📝 DAILY WORK REPORT: Submissions Open!",
            body: "It's 6:30 PM! Submissions are now open. Review your activities and submit your work report.",
            schedule: { at: getScheduleDate(18, 30), repeats: true, every: "day" },
            channelId: "work_report_high_importance",
            sound: "default",
            smallIcon: "notification_icon",
            extra: { url: "/workreport", slot: "18_30" }
          },
          {
            id: 1930,
            title: "⚠️ REMINDER: Submit Your Work Report!",
            body: "It's 7:30 PM! You have not submitted today's work report yet. Please submit now.",
            schedule: { at: getScheduleDate(19, 30), repeats: true, every: "day" },
            channelId: "work_report_high_importance",
            sound: "default",
            smallIcon: "notification_icon",
            extra: { url: "/workreport", slot: "19_30" }
          },
          {
            id: 2030,
            title: "🚨 URGENT FINAL REMINDER: Daily Work Report Pending!",
            body: "It's 8:30 PM! Final call to submit your daily work report before day close.",
            schedule: { at: getScheduleDate(20, 30), repeats: true, every: "day" },
            channelId: "work_report_high_importance",
            sound: "default",
            smallIcon: "notification_icon",
            extra: { url: "/workreport", slot: "20_30" }
          }
        ]
      });

      console.log("✅ [LocalNotifications] Daily 6:30 PM, 7:30 PM, 8:30 PM alarms scheduled successfully.");
    }
  } catch (e) {
    console.warn("⚠️ [LocalNotifications] Failed to schedule daily alarms:", e);
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

    // Schedule local notifications for guaranteed alarms
    await scheduleDailyWorkReportAlarms();

    // Create Android High Importance Channel for Heads-up floating notifications
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'work_report_high_importance',
          name: 'Work Report High Importance Alerts',
          description: 'Heads-up banner alerts for daily work report reminders',
          importance: 5,
          visibility: 1,
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
        console.log("✅ [Push] Native APNs/FCM Token Received:", token.value);
        await savePushTokenToBackend(currentActiveEmpCode || empCode, token.value, true);
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.error("❌ [Push] Native registration error:", error);
      });

      // Handle Foreground Push
      await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
        console.log("📩 [Push] Foreground Push Received:", notification);
        // Show heads-up floating banner via Local Notifications when in foreground
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Math.random() * 100000),
                title: notification.title || "Notification",
                body: notification.body || "",
                channelId: "work_report_high_importance",
                sound: "default",
                smallIcon: "notification_icon",
                extra: notification.data
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
          const slot = getNotificationSlot(now);
          const dismissed = localStorage.getItem("work_report_dismissed_time") === `${todayStr}_${slot}`;
          const submitted = localStorage.getItem(`work_report_submitted_${todayStr}`) === "true";
          if (dismissed || submitted) {
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
