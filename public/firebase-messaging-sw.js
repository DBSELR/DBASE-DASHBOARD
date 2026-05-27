importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

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

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

/* =========================
   BACKGROUND NOTIFICATION
========================= */
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Background Message:", payload);

  const title =
    payload.notification?.title || "Office Dashboard";

  const options = {
    body:
      payload.notification?.body ||
      "You have received a new notification",
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: {
      url: payload?.data?.url || "/",
    },
  };

  self.registration.showNotification(title, options);
});

/* =========================
   NOTIFICATION CLICK HANDLER
========================= */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});