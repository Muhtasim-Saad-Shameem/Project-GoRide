importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAHL6TG03VgVang6kjelJOW6wA-u5ZhPIY",
  authDomain: "project-goride.firebaseapp.com",
  projectId: "project-goride",
  storageBucket: "project-goride.firebasestorage.app",
  messagingSenderId: "590931565516",
  appId: "1:590931565516:web:bc7f1e6a5f5f90cc445b69",
  measurementId: "G-KDHKG9HW2B",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'Ride Update';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});