import admin from 'firebase-admin';
import { firebaseServiceAccount } from '@/lib/firebaseConfig';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseServiceAccount),
  });
}

export default admin;