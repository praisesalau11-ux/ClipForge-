import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const M = {
  text: process.env.TEXT_MODEL || "gemini-3.5-flash-lite",
  image: process.env.IMAGE_MODEL || "gemini-3.1-flash-image",
  tts: process.env.TTS_MODEL || "gemini-3.8-flash-tts",
  video: process.env.VIDEO_MODEL || "veo-3.1-generate-preview"
};

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
const firstData = (r) => r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;

async function plan(c) {
  const b = c.brand || {};
  const r = await ai.models.generateContent({
    model: M.text,
    contents: `You are a senior advertising copywriter and art director.
Brand: ${b.name || "the business"} (${b.industry || "general business"}). Tone: ${b.tone || "friendly and confident"}. Audience: ${b.audience || "general customers"}. About: ${b.about || "n/a"}. Website: ${b.website || "n/a"}.
Platform: ${c.platform}. Goal: ${c.goal || "Sales"}. Offer or idea: ${c.prompt}
Write a real, ready-to-post ad. Return JSON with keys:
headline (max 8 words, punchy),
caption (a hook first line, two short benefit lines, a clear call to action, then 4 hashtags),
script (voiceover of 28 to 35 words: hook, benefit, call to action, brand name),
imagePrompt (a professional vertical 4:5 advertising poster or product photo, studio lighting, clean layout, with the exact headline text and the brand name as readable text),
videoPrompt (an 8 second vertical ad: strong hook shot, close-ups of the product or service, upbeat music, one short spoken line in quotes, ending on the brand name and call to action).`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(r.text);
}

async function image(prompt) {
  const r = await ai.models.generateContent({
    model: M.image,
    contents: prompt,
    config: { responseModalities: ["TEXT", "IMAGE"] }
  });
  const d = firstData(r);
  if (!d) throw new Error("No image returned. The prompt may have been blocked.");
  return { buf: Buffer.from(d.data, "base64"), type: d.mimeType || "image/png" };
}

async function speech(text) {
  const r = await ai.models.generateContent({
    model: M.tts,
    contents: [{ parts: [{ text: `Say in a warm, confident advertising tone: ${text}` }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
    }
  });
  const d = firstData(r);
  if (!d) throw new Error("No audio returned.");
  return wav(Buffer.from(d.data, "base64"));
}

async function video(prompt) {
  let op = await ai.models.generateVideos({ model: M.video, prompt, config: { aspectRatio: "9:16" } });
  while (!op.done) {
    await new Promise((r) => setTimeout(r, 10000));
    op = await ai.operations.getVideosOperation({ operation: op });
  }
  const v = op.response?.generatedVideos?.[0]?.video;
  if (!v) throw new Error("No video returned. The prompt may have been blocked.");
  const tmp = path.join(os.tmpdir(), `clip-${Date.now()}.mp4`);
  await ai.files.download({ file: v, downloadPath: tmp });
  const buf = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  return buf;
}

// save(name, buffer, type) returns { url, dl }
export async function generate(c, save) {
  const p = await plan(c);
  const out = { headline: p.headline, caption: p.caption, script: p.script };
  const t = c.type;

  if (t === "Images and caption" || t === "Full post pack") {
    const i = await image(p.imagePrompt);
    const f = await save(`image.${i.type.split("/")[1] || "png"}`, i.buf, i.type);
    out.imageUrl = f.url; out.imageDl = f.dl;
  }
  if (t === "Voiceover" || t === "Full post pack") {
    const f = await save("voiceover.wav", await speech(p.script), "audio/wav");
    out.audioUrl = f.url; out.audioDl = f.dl;
  }
  if (t === "Short video") {
    const f = await save("video.mp4", await video(p.videoPrompt), "video/mp4");
    out.videoUrl = f.url; out.videoDl = f.dl;
  }
  return out;
}
export async function videoModels() {
  const out = [];
  const pager = await ai.models.list();
  for await (const m of pager) {
    if (/veo/i.test(m.name)) out.push({ name: m.name, actions: m.supportedActions });
  }
  return out;
}