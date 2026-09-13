import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

// The config will be available via firebase-applet-config.json
const config = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
};

const app = !getApps().length ? initializeApp(config) : getApp();

let authInstance: any = null;
try {
  if (config.apiKey) authInstance = getAuth(app);
} catch (e) { console.warn("Firebase Auth init failed", e); }
export const auth = authInstance;
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
let storageInstance: any = null;
try {
  if (config.projectId) storageInstance = getStorage(app);
} catch (e) { console.warn("Firebase Storage init failed", e); }
export const storage = storageInstance;
export default app;
