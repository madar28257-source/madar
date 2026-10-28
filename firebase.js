// ============================================
// مدار — إعداد Firebase
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA73OgCUyX9Vwc91Ulk1xEgdF74e_k8ZiE",
  authDomain: "madar-a2fd7.firebaseapp.com",
  projectId: "madar-a2fd7",
  storageBucket: "madar-a2fd7.firebasestorage.app",
  messagingSenderId: "790178291833",
  appId: "1:790178291833:web:69c273b5db8bcafe8ef4a8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };