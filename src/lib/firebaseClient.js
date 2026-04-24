import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { firebaseClientConfig } from '@/lib/firebaseConfig';

const app = initializeApp(firebaseClientConfig);
const messaging = getMessaging(app);

export { messaging, getToken, onMessage };
