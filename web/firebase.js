import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAoSRZzaOk-w05fPDGSCXJA90nwvntZb2w",
  authDomain: "clipforge-66a7f.firebaseapp.com",
  projectId: "clipforge-66a7f",
  storageBucket: "clipforge-66a7f.firebasestorage.app",
  messagingSenderId: "809008033945",
  appId: "1:809008033945:web:2de164cbb96932da428808"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);