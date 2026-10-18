import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export default admin;
