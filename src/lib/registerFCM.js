import { firebaseClientConfig, firebaseVapidKey } from "@/lib/firebaseConfig";

export async function registerFCM(onMessageCallback) {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    console.log("FCM not supported in this browser");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission was not granted");
      return null;
    }

    const firebaseAppModule = await import("firebase/app");
    const firebaseMessagingModule = await import("firebase/messaging");
    const app = firebaseAppModule.getApps().length
      ? firebaseAppModule.getApps()[0]
      : firebaseAppModule.initializeApp(firebaseClientConfig);
    const messaging = firebaseMessagingModule.getMessaging(app);

    const token = await firebaseMessagingModule.getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await fetch("/api/auth/fcm-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcmToken: token }),
      });
    }

    if (onMessageCallback) {
      firebaseMessagingModule.onMessage(messaging, onMessageCallback);
    }

    return token;
  } catch (error) {
    console.error("FCM registration error:", error);
    return null;
  }
}
