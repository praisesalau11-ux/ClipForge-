import { auth, db } from "../web/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API = "https://YOUR-SERVICE.onrender.com";
const $ = (id) => document.getElementById(id);
const msg = (t, ok) => { $("msg").className = "msg" + (ok ? " ok" : ""); $("msg").textContent = t; };
let user = null;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const safe = (u) => typeof u === "string" && u.startsWith("https://");

onAuthStateChanged(auth, (u) => {
  if (!u) { location.href = html/"screen.html"; return; }
  user = u;
  $("hello").textContent = "Welcome, " + (u.displayName || u.email);
  $("name").textContent = u.email;

  const q = query(collection(db, "users", u.uid, "campaigns"), orderBy("createdAt", "desc"), limit(10));
  onSnapshot(q, (snap) => {
    if (snap.empty) return;
    $("list").innerHTML = "";
    snap.forEach((d) => {
      const c = d.data(), o = c.outputs || {};
      const item = el("div", "item");
      item.appendChild(el("p", "", c.prompt));
      const s = el("small", "", c.type + " for " + c.platform);
      s.appendChild(el("span", "badge", c.status));
      item.appendChild(s);
      if (c.status === "Failed") item.appendChild(el("p", "err", c.error || "Something went wrong. Try again."));
      if (o.caption) item.appendChild(el("p", "cap", o.caption));
      if (safe(o.imageUrl)) { const i = el("img"); i.src = o.imageUrl; i.alt = "Generated image"; item.appendChild(i); }
      if (safe(o.audioUrl)) { const a = el("audio"); a.controls = true; a.src = o.audioUrl; item.appendChild(a); }
      if (safe(o.videoUrl)) { const v = el("video"); v.controls = true; v.src = o.videoUrl; item.appendChild(v); }
      $("list").appendChild(item);
    });
  }, (err) => msg(err.message));
});

$("f").onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  try {
    const ref = await addDoc(collection(db, "users", user.uid, "campaigns"), {
      prompt: $("prompt").value.trim(),
      type: $("type").value,
      platform: $("platform").value,
      status: "Queued",
      createdAt: serverTimestamp()
    });
    const res = await fetch(API + "/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await user.getIdToken()) },
      body: JSON.stringify({ campaignId: ref.id })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Could not start generation.");
    $("prompt").value = "";
    msg("Started. Your content will appear below when it is ready.", true);
  } catch (err) { msg(err.message); }
  btn.disabled = false;
};

$("logout").onclick = () => signOut(auth).then(() => { location.href = "../index.html"; });