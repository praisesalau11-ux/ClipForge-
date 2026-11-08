import { auth, db } from "../web/firebase.js";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const show = (t) => { $("msg").className = "msg"; $("msg").textContent = t; };

$("f").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    location.href = "dashboard.html";
  } catch (err) {
    show(["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(err.code) ? "Email or password is incorrect." : err.message);
  }
};

$("google").onclick = async () => {
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    const ref = doc(db, "users", user.uid);
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, { fullName: user.displayName, email: user.email, createdAt: serverTimestamp() });
    }
    location.href = "dashboard.html";
  } catch (err) { show(err.message); }
};