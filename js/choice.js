import { auth, db } from "../web/firebase.js";
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const msg = document.getElementById("msg");
document.getElementById("google").onclick = async () => {
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    const ref = doc(db, "users", user.uid);
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, { fullName: user.displayName, email: user.email, createdAt: serverTimestamp() });
    }
    location.href = html/"dashboard.html";
  } catch (e) { msg.className = "msg"; msg.textContent = e.message; }
};