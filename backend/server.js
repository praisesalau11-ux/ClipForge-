import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { generate } from "./generate.js";
import { generate, videoModels } from "./generate.js";

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
app.get("/models", async (_, res) => {
  try { res.json(await videoModels()); } catch (e) { res.status(500).json({ error: String(e.message) }); }
});

const COST = { "Images and caption": 1, "Voiceover": 1, "Full post pack": 2, "Short video": 10 };
const FREE_CREDITS = 20;

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
    const userRef = db.doc(`users/${uid}`);
  const result = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    const u = await t.get(userRef);
    if (!s.exists || s.data().status !== "Queued") return { err: "Campaign not found or already started.", code: 409 };
    const cost = COST[s.data().type];
    if (!cost) return { err: "Unknown ad type.", code: 400 };
    const credits = u.exists && typeof u.data().credits === "number" ? u.data().credits : FREE_CREDITS;
    if (credits < cost) return { err: `Not enough credits. This needs ${cost} and you have ${credits}.`, code: 402 };
    t.set(userRef, { credits: credits - cost }, { merge: true });
    t.update(ref, { status: "Processing", cost });
    return { data: s.data(), cost };
  });
  if (result.err) return res.status(result.code).json({ error: result.err });

  res.json({ ok: true });

  try {
    const outputs = await generate(result.data, async (name, buf, type) => {
      const file = bucket.file(`users/${uid}/${id}/${name}`);
      await file.save(buf, { contentType: type });
      const expires = Date.now() + 6 * 24 * 60 * 60 * 1000;
      const [url] = await file.getSignedUrl({ action: "read", expires });
      const [dl] = await file.getSignedUrl({
        action: "read", expires,
        responseDisposition: `attachment; filename="clipforge-${name}"`
      });
      return { url, dl };
    });
    await ref.update({ status: "Done", outputs });
  } catch (e) {
    console.error(e);
    const raw = String(e.message || e);
    const friendly = /veo|predictLongRunning/i.test(raw) && /404|not found/i.test(raw)
      ? "Video generation is not enabled for this account yet. Your credits were refunded."
      : raw.slice(0, 200);
    await userRef.set({ credits: admin.firestore.FieldValue.increment(result.cost) }, { merge: true });
    await ref.update({ status: "Failed", error: friendly });
  }
});

app.listen(process.env.PORT || 3000);