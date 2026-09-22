import { BRAND_NAME_UPPER, BRAND_TAGLINE } from "@/lib/brand";
import { getSoundStream } from "@/lib/sound";
import { traceBrandSymbol } from "@/lib/textures/brand-symbol";
import { getSerifFamily } from "@/lib/textures/page-textures";

export type StoryVideo = {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
};

const STORY_WIDTH = 720;
const STORY_HEIGHT = 1280;
const MAX_SECONDS = 40;
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

type ActiveRecording = {
  recorder: MediaRecorder;
  chunks: Blob[];
  mimeType: string;
  frame: number;
  timeout: number;
};

let active: ActiveRecording | null = null;

export function isStoryRecordingSupported() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function pickMimeType() {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function createOverlay() {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");
  const family = getSerifFamily();

  const top = ctx.createLinearGradient(0, 0, 0, 260);
  top.addColorStop(0, "rgba(5,6,8,0.85)");
  top.addColorStop(1, "rgba(5,6,8,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, STORY_WIDTH, 260);

  const bottom = ctx.createLinearGradient(0, STORY_HEIGHT - 280, 0, STORY_HEIGHT);
  bottom.addColorStop(0, "rgba(5,6,8,0)");
  bottom.addColorStop(1, "rgba(5,6,8,0.9)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, STORY_HEIGHT - 280, STORY_WIDTH, 280);

  const gold = ctx.createLinearGradient(0, 40, 0, 200);
  gold.addColorStop(0, "#f1d792");
  gold.addColorStop(1, "#a9812f");
  ctx.fillStyle = gold;
  ctx.strokeStyle = gold;
  traceBrandSymbol(ctx, STORY_WIDTH / 2, 100, 96);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 34px ${family}`;
  ctx.letterSpacing = "14px";
  ctx.fillText(BRAND_NAME_UPPER, STORY_WIDTH / 2 + 7, 186);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "rgba(239,227,200,0.85)";
  ctx.font = `italic 500 30px ${family}`;
  ctx.fillText(BRAND_TAGLINE, STORY_WIDTH / 2, STORY_HEIGHT - 110);
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    ctx.fillStyle = "rgba(201,162,75,0.9)";
    ctx.font = `500 22px ${family}`;
    ctx.letterSpacing = "4px";
    ctx.fillText(site.replace(/^https?:\/\//, ""), STORY_WIDTH / 2, STORY_HEIGHT - 62);
    ctx.letterSpacing = "0px";
  }
  return canvas;
}

export function cancelStoryRecording() {
  if (!active) return;
  const recording = active;
  active = null;
  cancelAnimationFrame(recording.frame);
  window.clearTimeout(recording.timeout);
  recording.recorder.ondataavailable = null;
  try {
    if (recording.recorder.state !== "inactive") recording.recorder.stop();
  } catch (error) {
    console.error("Story recording could not be cancelled", error);
  }
  recording.recorder.stream.getVideoTracks().forEach((track) => track.stop());
}

export function startStoryRecording(source: HTMLCanvasElement) {
  if (!isStoryRecordingSupported()) return false;
  cancelStoryRecording();
  try {
    const canvas = document.createElement("canvas");
    canvas.width = STORY_WIDTH;
    canvas.height = STORY_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const overlay = createOverlay();

    const stream = canvas.captureStream(30);
    const audio = getSoundStream();
    audio?.getAudioTracks().forEach((track) => stream.addTrack(track));

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 5_000_000,
    });
    const recording: ActiveRecording = {
      recorder,
      chunks: [],
      mimeType: recorder.mimeType || mimeType || "video/webm",
      frame: 0,
      timeout: 0,
    };

    const draw = () => {
      const sw = source.width;
      const sh = source.height;
      if (sw > 0 && sh > 0) {
        const scale = Math.max(STORY_WIDTH / sw, STORY_HEIGHT / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        ctx.fillStyle = "#050608";
        ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
        ctx.drawImage(source, (STORY_WIDTH - dw) / 2, (STORY_HEIGHT - dh) / 2, dw, dh);
        ctx.drawImage(overlay, 0, 0);
      }
      recording.frame = requestAnimationFrame(draw);
    };
    draw();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recording.chunks.push(event.data);
    };
    recorder.start(500);
    recording.timeout = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
      cancelAnimationFrame(recording.frame);
    }, MAX_SECONDS * 1000);
    active = recording;
    return true;
  } catch (error) {
    console.error("Story recording could not start", error);
    return false;
  }
}

export function stopStoryRecording(): Promise<StoryVideo | null> {
  if (!active) return Promise.resolve(null);
  const recording = active;
  active = null;
  window.clearTimeout(recording.timeout);

  return new Promise((resolve, reject) => {
    const finish = () => {
      cancelAnimationFrame(recording.frame);
      recording.recorder.stream.getVideoTracks().forEach((track) => track.stop());
      if (recording.chunks.length === 0) {
        resolve(null);
        return;
      }
      const type = recording.mimeType.split(";")[0];
      resolve({
        blob: new Blob(recording.chunks, { type }),
        mimeType: type,
        extension: type.includes("mp4") ? "mp4" : "webm",
      });
    };
    recording.recorder.onerror = () => reject(new Error("Story recording failed"));
    if (recording.recorder.state === "inactive") {
      finish();
      return;
    }
    recording.recorder.onstop = finish;
    try {
      recording.recorder.stop();
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Story recording could not stop"));
    }
  });
}
