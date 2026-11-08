import { auth, db } from "../web/firebase.js";
import * as C from "../data/countries.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const msg = (t, ok) => { $("msg").className = "msg" + (ok ? " ok" : ""); $("msg").textContent = t; };

// Adjust the field names below if your countries.js uses different ones
const raw = C.countries || C.default || Object.values(C)[0] || [];
const list = raw.map((c) => {
  let d = String(c.dial_code || c.dialCode || c.dial || c.phone_code || c.callingCode || "");
  if (d && !d.startsWith("+")) d = "+" + d;
  return { name: c.name, flag: c.flag || c.emoji || "", dial: d };
}).sort((a, b) => a.name.localeCompare(b.name));

list.forEach((c, i) => {
  const o = document.createElement("option");
  o.value = i;
  o.textContent = `${c.flag} ${c.name}`.trim();
  $("country").appendChild(o);
});
$("country").onchange = () => { const c = list[$("country").value]; $("dial").value = c ? c.dial : ""; };

function calcAge(v) {
  if (!v) return "";
  const b = new Date(v), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}
$("dob").max = new Date().toISOString().split("T")[0];
$("dob").onchange = () => { $("age").value = calcAge($("dob").value); };

$("f").onsubmit = async (e) => {
  e.preventDefault();
  const age = calcAge($("dob").value);
  const username = $("username").value.trim();
  if (age < 18) return msg("You must be 18 or older to create an account.");
  if (!/^[a-z0-9_.]{3,20}$/i.test(username)) return msg("Username must be 3 to 20 letters, numbers, dots or underscores.");
  const c = list[$("country").value];
  try {
    const { user } = await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    await updateProfile(user, { displayName: $("fullName").value.trim() });
    await setDoc(doc(db, "users", user.uid), {
      fullName: $("fullName").value.trim(), username, email: user.email,
      dob: $("dob").value, age, gender: $("gender").value,
      country: c.name, dialCode: c.dial, phone: $("phone").value.trim(),
      accountType: $("accountType").value, business: $("business").value.trim(),
      createdAt: serverTimestamp()
    });
    msg("Account created. Redirecting...", true);
location.href = "dashboard.html";
  } catch (err) {
    msg(err.code === "auth/email-already-in-use" ? "That email already has an account. Try logging in." : err.message);
  }
};