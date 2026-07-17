import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDJSZiuSDw5_pf-UQbK_x0pInH-1dWUo6M",
  authDomain: "aura-51283.firebaseapp.com",
  projectId: "aura-51283",
  storageBucket: "aura-51283.firebasestorage.app",
  messagingSenderId: "755274750519",
  appId: "1:755274750519:web:0a1f6871196943c4d9fdb2",
  measurementId: "G-1K2QT0FRP8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
