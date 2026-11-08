import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { generate } from "./generate.js";

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  storageBucket: process.env.STORAGE_BUCKET
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();
app.use(cors({ origin: (process.env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "10kb" }));

app.get("/", (_, res) => res.send("ClipForge backend is running"));

app.post("/generate", async (req, res) => {
  let uid;
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    uid = (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    return res.status(401).json({ error: "Please log in again." });
  }

  const id = String(req.body.campaignId || "");
  if (!/^[A-Za-z0-9]{10,30}$/.test(id)) return res.status(400).json({ error: "Invalid campaign." });
  const ref = db.doc(`users/${uid}/campaigns/${id}`);

  // Claim the campaign so it can only run once
  const campaign = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists || s.data().status !== "Queued") return null;
    t.update(ref, { status: "Processing" });
    return s.data();
  });
  if (!campaign) return res.status(409).json({ error: "Campaign not found or already started." });

  res.json({ ok: true }); // answer now, keep working in the background

  try {
    const outputs = await generate(campaign, async (name, buf, type) => {
      const file = bucket.file(`users/${uid}/${id}/${name}`);
      await file.save(buf, { contentType: type });
      const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 6 * 24 * 60 * 60 * 1000 });
      return url;
    });
    await ref.update({ status: "Done", outputs });
  } catch (e) {
    console.error(e);
    await ref.update({ status: "Failed", error: String(e.message || e).slice(0, 200) });
  }
});

app.listen(process.env.PORT || 3000);