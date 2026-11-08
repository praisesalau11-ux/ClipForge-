import { auth, db } from "../web/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API = "https://clipforge-qui6.onrender.com"; // paste your real Render URL
const $ = (id) => document.getElementById(id);
const msg = (t, ok) => { $("msg").className = "msg" + (ok ? " ok" : ""); $("msg").textContent = t; };
let user = null, brand = {};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const safe = (u) => typeof u === "string" && u.startsWith("https://");
const link = (label, href) => {
  const a = el("a", "btn alt", label);
  a.href = href; a.rel = "noopener"; a.setAttribute("download", "");
  return a;
};
const button = (label, fn) => { const b = el("button", "btn alt", label); b.type = "button"; b.onclick = () => fn(b); return b; };

async function copyText(text, b) {
  try { await navigator.clipboard.writeText(text); const old = b.textContent; b.textContent = "Copied"; setTimeout(() => (b.textContent = old), 1500); } catch {}
}
async function share(o) {
  const url = o.videoUrl || o.imageUrl || o.audioUrl;
  try {
    if (navigator.share) await navigator.share({ title: o.headline || "My ad", text: o.caption || "", url });
    else { await navigator.clipboard.writeText((o.caption ? o.caption + "\n" : "") + url); msg("Caption and link copied.", true); }
  } catch {}
}

function card(d) {
  const c = d.data(), o = c.outputs || {};
  const item = el("div", "item");
  if (safe(o.imageUrl)) { const m = el("div", "media"), i = el("img"); i.src = o.imageUrl; i.alt = o.headline || "Generated ad"; m.appendChild(i); item.appendChild(m); }
  if (safe(o.videoUrl)) { const m = el("div", "media"), v = el("video"); v.controls = true; v.playsInline = true; v.src = o.videoUrl; m.appendChild(v); item.appendChild(m); }

  const body = el("div", "body");
  body.appendChild(el("h3", "", o.headline || c.prompt));
  const meta = el("div", "meta", c.type + " · " + c.platform + " · ");
  meta.appendChild(el("span", "badge", c.status));
  body.appendChild(meta);

  if (c.status === "Queued" || c.status === "Processing") {
    const w = el("div", "wait");
    w.append(el("span", "spin"), el("span", "", "Creating your ad. Videos can take a few minutes."));
    body.appendChild(w);
  }
  if (c.status === "Failed") body.appendChild(el("p", "err", c.error || "Something went wrong. Try again."));
  if (o.caption) body.appendChild(el("p", "cap", o.caption));
  if (safe(o.audioUrl)) { const a = el("audio"); a.controls = true; a.src = o.audioUrl; body.appendChild(a); }

  const acts = el("div", "acts");
  if (safe(o.imageDl)) acts.appendChild(link("Download image", o.imageDl));
  if (safe(o.videoDl)) acts.appendChild(link("Download video", o.videoDl));
  if (safe(o.audioDl)) acts.appendChild(link("Download audio", o.audioDl));
  if (o.caption) acts.appendChild(button("Copy caption", (b) => copyText(o.caption, b)));
  if (safe(o.imageUrl) || safe(o.videoUrl) || safe(o.audioUrl)) acts.appendChild(button("Share", () => share(o)));
  if (acts.children.length) body.appendChild(acts);

  item.appendChild(body);
  return item;
}

onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = "screen.html"; return; }
  user = u;
  try {
    const s = await getDoc(doc(db, "users", u.uid));
    brand = (s.exists() && s.data().brand) || {};
  } catch {}
  $("hello").textContent = brand.name ? "Ads for " + brand.name : "Welcome, " + (u.displayName || u.email);
  $("banner").hidden = !!brand.name;

  const q = query(collection(db, "users", u.uid, "campaigns"), orderBy("createdAt", "desc"), limit(20));
  onSnapshot(q, (snap) => {
    $("list").innerHTML = "";
    if (snap.empty) { $("list").appendChild(el("p", "empty", "No ads yet. Create your first one.")); return; }
    snap.forEach((d) => $("list").appendChild(card(d)));
  }, (err) => msg(err.message));
});

$("f").onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  try {
    const ref = await addDoc(collection(db, "users", user.uid, "campaigns"), {
      prompt: $("prompt").value.trim(),
      goal: $("goal").value,
      type: $("type").value,
      platform: $("platform").value,
      brand,
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
    msg("Started. Your ad will appear below.", true);
  } catch (err) {
    msg(err instanceof TypeError ? "Cannot reach the server. Check the API address and try again." : err.message);
  }
  btn.disabled = false;
};

$("logout").onclick = () => signOut(auth).then(() => { location.href = "../index.html"; });