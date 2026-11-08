import { auth } from "../web/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const all = (s) => document.querySelectorAll(s);

onAuthStateChanged(auth, (u) => { if (!u) location.href = "screen.html"; });

function mark() {
  const cur = window.cfTheme.get();
  all("#themes .opt").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === cur.theme)));
  all("#accents .swatch").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.accent === cur.accent)));
}
all("#themes .opt").forEach((b) => { b.onclick = () => { window.cfTheme.set(b.dataset.mode, null); mark(); }; });
all("#accents .swatch").forEach((b) => { b.onclick = () => { window.cfTheme.set(null, b.dataset.accent); mark(); }; });
mark();

document.getElementById("logout").onclick = () => signOut(auth).then(() => { location.href = "../index.html"; });