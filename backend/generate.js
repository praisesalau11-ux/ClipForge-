import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const M = {
  text: process.env.TEXT_MODEL || "gemini-3.5-flash-lite",
  image: process.env.IMAGE_MODEL || "gemini-3.1-flash-image",
  tts: process.env.TTS_MODEL || "gemini-3.8-flash-tts",
  video: process.env.VIDEO_MODEL || "veo-3.1-lite-generate-preview"
};

// Gemini TTS returns raw PCM (24kHz, mono, 16-bit), so wrap it as a WAV file
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
  const r = await ai.models.generateContent({
    model: M.text,
    contents: `You write social media marketing content. Platform: ${c.platform}. Idea: ${c.prompt}
Return JSON with keys: caption (include 3 hashtags), script (voiceover under 40 words), imagePrompt, videoPrompt (one 8 second vertical video scene).`,
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
    contents: [{ parts: [{ text: `Say in a warm, confident marketing tone: ${text}` }] }],
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
  let op = await ai.models.generateVideos({
    model: M.video,
    prompt,
    config: { aspectRatio: "9:16" }
  });
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

// c = campaign data, save(name, buffer, contentType) uploads and returns a URL
export async function generate(c, save) {
  const p = await plan(c);
  const out = { caption: p.caption, script: p.script };
  const t = c.type;

  if (t === "Images and caption" || t === "Full post pack") {
    const i = await image(p.imagePrompt);
    out.imageUrl = await save(`image.${i.type.split("/")[1] || "png"}`, i.buf, i.type);
  }
  if (t === "Voiceover" || t === "Full post pack") {
    out.audioUrl = await save("voiceover.wav", await speech(p.script), "audio/wav");
  }
  if (t === "Short video") {
    out.videoUrl = await save("video.mp4", await video(p.videoPrompt), "video/mp4");
  }
  return out;
}