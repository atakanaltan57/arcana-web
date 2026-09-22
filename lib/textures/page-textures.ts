import * as THREE from "three";
import answers from "@/lib/answers/genel.json";
import { BRAND_NAME_UPPER, BRAND_TAGLINE } from "@/lib/brand";
import { traceBrandSymbol } from "./brand-symbol";
import { canvasToTexture, createCanvas, heightToNormalCanvas, seededRandom, smoothNoiseField } from "./procedural";

export const PAGE_TEXTURE_WIDTH = 1024;
export const PAGE_TEXTURE_HEIGHT = 1434;

const PAPER_BASE: [number, number, number] = [236, 224, 196];

export function createPaperTexture(seed = 3) {
  const w = PAGE_TEXTURE_WIDTH;
  const h = PAGE_TEXTURE_HEIGHT;
  const rand = seededRandom(seed);
  const stains = smoothNoiseField(w, h, rand, [
    { size: 260, weight: 1 },
    { size: 90, weight: 0.45 },
    { size: 30, weight: 0.2 },
  ]);
  const fibers = smoothNoiseField(w, h, rand, [
    { size: 3, weight: 1 },
    { size: 9, weight: 0.5, stretchX: 4 },
  ]);
  const { canvas, ctx } = createCanvas(w, h);
  const image = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y) / 90;
      const age = Math.min(1, edge);
      const tone = (0.9 + fibers[i] * 0.07) * (0.94 + stains[i] * 0.08) * (0.86 + age * 0.14);
      const warm = 1 - (1 - age) * 0.06 - (stains[i] > 0.82 ? (stains[i] - 0.82) * 0.5 : 0);
      image.data[i * 4] = PAPER_BASE[0] * tone;
      image.data[i * 4 + 1] = PAPER_BASE[1] * tone * warm;
      image.data[i * 4 + 2] = PAPER_BASE[2] * tone * warm * warm;
      image.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  for (let k = 0; k < 14; k++) {
    const r = 2 + rand() * 7;
    ctx.fillStyle = `rgba(150,105,55,${0.05 + rand() * 0.08})`;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasToTexture(canvas, true);
}

export function createPaperNormalTexture() {
  const size = 512;
  const rand = seededRandom(77);
  const fibers = smoothNoiseField(size, size, rand, [
    { size: 2, weight: 1 },
    { size: 6, weight: 0.6, stretchX: 5 },
    { size: 40, weight: 0.5 },
  ]);
  const texture = canvasToTexture(heightToNormalCanvas(fibers, size, size, 1.4), false);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  return texture;
}

export function createPageEdgeTexture() {
  const { canvas, ctx } = createCanvas(64, 512);
  const rand = seededRandom(21);
  ctx.fillStyle = "rgb(222,206,172)";
  ctx.fillRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 1) {
    const shade = rand();
    if (shade > 0.45) {
      ctx.fillStyle = `rgba(110,82,48,${(shade - 0.45) * 0.55})`;
      ctx.fillRect(0, y, 64, 1);
    }
  }
  const tint = ctx.createLinearGradient(0, 0, 0, 512);
  tint.addColorStop(0, "rgba(120,85,40,0.25)");
  tint.addColorStop(0.5, "rgba(120,85,40,0)");
  tint.addColorStop(1, "rgba(120,85,40,0.25)");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 64, 512);
  const texture = canvasToTexture(canvas, true);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function createPrintedPageTexture(seed: number) {
  const w = 512;
  const h = 717;
  const rand = seededRandom(seed);
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = "rgb(234,222,194)";
  ctx.fillRect(0, 0, w, h);
  const age = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.72);
  age.addColorStop(0, "rgba(140,100,50,0)");
  age.addColorStop(1, "rgba(140,100,50,0.22)");
  ctx.fillStyle = age;
  ctx.fillRect(0, 0, w, h);

  const words = (answers as string[]).join(" ").replace(/[.,;:—]/g, "").split(/\s+/);
  ctx.fillStyle = "rgba(38,24,16,0.78)";
  ctx.font = "15px Georgia, 'Times New Roman', serif";
  ctx.textBaseline = "alphabetic";
  const marginX = 64;
  const lineHeight = 19;
  let cursor = Math.floor(rand() * words.length);
  for (let y = 104; y < h - 84; y += lineHeight) {
    if (rand() < 0.05) continue;
    let line = "";
    const maxWidth = y > h - 110 && rand() < 0.5 ? w * 0.45 : w - marginX * 2;
    while (true) {
      const word = words[cursor % words.length];
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth) break;
      line = candidate;
      cursor++;
    }
    ctx.fillText(line, marginX, y);
  }
  ctx.fillStyle = "rgba(130,30,25,0.6)";
  ctx.fillRect(w / 2 - 26, 58, 52, 4);
  return canvasToTexture(canvas, true);
}

export function getSerifFamily() {
  if (typeof document === "undefined") return "Georgia, serif";
  const value = getComputedStyle(document.body).getPropertyValue("--font-cormorant").trim();
  return value ? `${value}, Georgia, serif` : "Georgia, serif";
}

async function ensureFonts(family: string) {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`italic 500 80px ${family}`),
      document.fonts.load(`500 40px ${family}`),
    ]);
  } catch (error) {
    console.error("Font could not be loaded for page text", error);
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const INK = "rgb(255,0,0)";
const RUBRIC = "rgb(0,255,0)";
const GOLD = "rgb(0,0,255)";

function drawFleuron(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.bezierCurveTo(12, -8, 12, 8, 0, 16);
  ctx.bezierCurveTo(-12, 8, -12, -8, 0, -16);
  ctx.fill();
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 18, 0);
    ctx.bezierCurveTo(dir * 40, -14, dir * 70, -10, dir * 96, 0);
    ctx.bezierCurveTo(dir * 70, -3, dir * 40, -5, dir * 18, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dir * 106, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export async function createAnswerTexture(answer: string, pageNumber: number) {
  const family = getSerifFamily();
  await ensureFonts(family);
  const w = PAGE_TEXTURE_WIDTH;
  const h = PAGE_TEXTURE_HEIGHT;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = GOLD;
  ctx.font = `600 38px ${family}`;
  ctx.letterSpacing = "18px";
  ctx.fillText(BRAND_NAME_UPPER, w / 2 + 8, 118);
  ctx.letterSpacing = "0px";

  let size = 92;
  let lines: string[] = [];
  do {
    ctx.font = `italic 500 ${size}px ${family}`;
    lines = wrapText(ctx, answer, 720);
    size -= 4;
  } while (lines.length > 5 && size > 52);
  size += 4;

  const lineHeight = size * 1.22;
  const blockHeight = lines.length * lineHeight;
  const top = h * 0.48 - blockHeight / 2;

  ctx.fillStyle = GOLD;
  ctx.strokeStyle = GOLD;
  traceBrandSymbol(ctx, w / 2, Math.max(260, top - 130), 150);

  ctx.fillStyle = INK;
  ctx.font = `italic 500 ${size}px ${family}`;
  lines.forEach((line, index) => {
    ctx.fillText(line, w / 2, top + lineHeight * (index + 0.5));
  });

  ctx.fillStyle = RUBRIC;
  ctx.beginPath();
  ctx.arc(w / 2, top + blockHeight + 70, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,0,0,0.55)";
  ctx.font = `italic 500 30px ${family}`;
  ctx.fillText(BRAND_TAGLINE, w / 2, h - 190);

  ctx.fillStyle = "rgba(255,0,0,0.7)";
  ctx.font = `500 34px ${family}`;
  ctx.fillText(`— ${pageNumber} —`, w / 2, h - 120);

  return canvasToTexture(canvas, false);
}

export async function createEpigraphTexture() {
  const family = getSerifFamily();
  await ensureFonts(family);
  const w = PAGE_TEXTURE_WIDTH;
  const h = PAGE_TEXTURE_HEIGHT;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = RUBRIC;
  drawFleuron(ctx, w / 2, h * 0.36, 0.8);

  ctx.fillStyle = "rgba(255,0,0,0.8)";
  ctx.font = `italic 500 50px ${family}`;
  ctx.fillText("Bilinmezin sesi,", w / 2, h * 0.45);
  ctx.fillText("sırrın mührü.", w / 2, h * 0.45 + 62);

  ctx.fillStyle = RUBRIC;
  drawFleuron(ctx, w / 2, h * 0.6, 0.55);
  return canvasToTexture(canvas, false);
}

export function createBlankTextTexture() {
  const data = new Uint8Array([0, 0, 0, 255]);
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.needsUpdate = true;
  return texture;
}
