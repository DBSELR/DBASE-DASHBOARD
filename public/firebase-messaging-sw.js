console.log("🔥 SW START");

try {
  importScripts(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
  );

  importScripts(
    "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
  );

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

    self.registration.showNotification(
      payload.notification?.title || "Office Dashboard",
      {
        body:
          payload.notification?.body ||
          "You have received a new notification",
        icon: "/logo192.png",
        badge: "/logo192.png",
      }
    );
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = event.notification?.data?.url || "/";

    event.waitUntil(clients.openWindow(targetUrl));
  });

} catch (err) {
  console.error("❌ SW ERROR:", err);
}