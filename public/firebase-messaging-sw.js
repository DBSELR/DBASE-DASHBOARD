console.log("🔥 SW START");

try {
  importScripts("/firebase-app-compat.js");
  importScripts("/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyAxbahDANKCJWylY9gHrNXfYM3olBnxKEE",
    authDomain: "bbs-notifications-2d51c.firebaseapp.com",
    projectId: "bbs-notifications-2d51c",
    storageBucket: "bbs-notifications-2d51c.firebasestorage.app",
    messagingSenderId: "656709531884",
    appId: "1:656709531884:web:9ebcecca5e82a6df6b4dc9",
  });

  const messaging = firebase.messaging();

  console.log("✅ Firebase Messaging Loaded");

  messaging.onBackgroundMessage((payload) => {
    console.log("📩 Background Message", payload);

    // If FCM Webpush payload has notification object, Web SDK displays it natively.
    // Skip manual showNotification to prevent double popups.
    if (payload.notification) {
      console.log("ℹ️ SW: FCM Webpush notification present, relying on native SDK display.");
      return;
    }

    const slot = payload.data?.slot || ((new Date().getHours() > 18 || (new Date().getHours() === 18 && new Date().getMinutes() >= 20)) ? "18_20" : "18_00");
    const todayStr = new Date().toISOString().split("T")[0];
    const type = payload.data?.type || "work_report_reminder";
    const tag = `${type}_${todayStr}_${slot}`;

    const title = payload.data?.title || "🚨 Daily Work Report Reminder";
    const body = payload.data?.body || "Please submit your daily work report for today.";
    const image = payload.data?.image || null;
    const targetUrl = payload.data?.url || "/workreport";

    const notificationOptions = {
      body: body,
      icon: "/images/dbase.png",
      badge: "/images/dbs-logo-short.png",
      image: image,
      vibrate: [300, 100, 300, 100, 300],
      tag: tag,
      renotify: false,
      requireInteraction: true,
      data: {
        url: targetUrl
      },
      actions: [
        { action: "submit", title: "📝 Submit Work Report" },
        { action: "dismiss", title: "✖ Dismiss" }
      ]
    };

    self.registration.showNotification(title, notificationOptions);
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "dismiss") {
      return;
    }

    const targetUrl = event.notification?.data?.url || "/workreport";

    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (clientList.length > 0) {
          const firstClient = clientList[0];
          if ("navigate" in firstClient) {
            firstClient.focus();
            return firstClient.navigate(targetUrl);
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  });

} catch (err) {
  console.error("❌ SW ERROR:", err);
}
