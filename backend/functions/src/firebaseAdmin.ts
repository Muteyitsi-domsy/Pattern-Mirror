import * as admin from 'firebase-admin';

export const storageBucketName =
  process.env.FIREBASE_STORAGE_BUCKET ?? process.env.STORAGE_BUCKET_NAME;

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    // FIREBASE_* is a reserved prefix inside the Cloud Functions runtime's
    // own .env loading (breaks it entirely if used there — see
    // backend/functions/.env), so the deployed/emulated-functions path sets
    // STORAGE_BUCKET_NAME instead; the plain root-level dev server doesn't
    // have that restriction and keeps using FIREBASE_STORAGE_BUCKET.
    storageBucket: storageBucketName,
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export default admin;
