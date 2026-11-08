import { auth, db } from "../web/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const msg = (t, ok) => { $("msg").className = "msg" + (ok ? " ok" : ""); $("msg").textContent = t; };
const ids = ["name", "industry", "tone", "audience", "website", "about"];
let ref;

onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = "screen.html"; return; }
  ref = doc(db, "users", u.uid);
  const s = await getDoc(ref);
  const d = s.exists() ? s.data() : {};
  $("who").textContent = [d.fullName || u.displayName, u.email, d.username ? "@" + d.username : ""].filter(Boolean).join(" · ");
  const b = d.brand || {};
  ids.forEach((k) => { if (b[k]) $(k).value = b[k]; });
});

$("f").onsubmit = async (e) => {
  e.preventDefault();
  const brand = {};
  ids.forEach((k) => (brand[k] = $(k).value.trim()));
  try {
    await setDoc(ref, { brand }, { merge: true });
    msg("Profile saved.", true);
  } catch (err) { msg(err.message); }
};

$("logout").onclick = () => signOut(auth).then(() => { location.href = "../index.html"; });