import * as THREE from "three";
import { CIPHER_ALPHABET, CIPHER_CORPUS, CIPHER_CRIB_TOKENS, CIPHER_HEADER_TOKENS, toRoman } from "@/lib/cipher";
import { drawCipherBlock, drawGlyph, drawGlyphRow } from "./cipher-text";
import { BRAND_NAME_UPPER } from "@/lib/brand";
import { getMessages } from "@/lib/i18n/locale-store";
import { traceBrandSymbol } from "./brand-symbol";
import { canvasToTexture, createCanvas, heightToNormalCanvas, seededRandom, smoothNoiseField } from "./procedural";
import { balanceLines, ensureFonts, fillSpacedText, getSerifFamily, keepDashWithNextWord, wrapText } from "./canvas-text";

export { getSerifFamily };

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
  const width = 64;
  const height = 256;
  const { canvas, ctx } = createCanvas(width, height);
  const rand = seededRandom(21);
  ctx.fillStyle = "rgb(226,204,152)";
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  while (y < height) {
    const leaf = 3 + Math.floor(rand() * 3);
    const tone = 0.9 + rand() * 0.14;
    ctx.fillStyle = `rgb(${Math.min(255, Math.round(236 * tone))},${Math.min(255, Math.round(212 * tone))},${Math.round(160 * tone)})`;
    ctx.fillRect(0, y, width, leaf - 1);
    ctx.fillStyle = `rgba(120,86,44,${0.35 + rand() * 0.25})`;
    ctx.fillRect(0, y + leaf - 1, width, 1);
    y += leaf;
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(70,45,20,${rand() * 0.25})`;
    ctx.fillRect(rand() * width, rand() * height, 1 + rand() * 6, 1 + rand() * 2);
  }
  const tint = ctx.createLinearGradient(0, 0, 0, height);
  tint.addColorStop(0, "rgba(80,50,20,0.35)");
  tint.addColorStop(0.5, "rgba(80,50,20,0)");
  tint.addColorStop(1, "rgba(80,50,20,0.35)");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, width, height);
  const texture = canvasToTexture(canvas, true);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function wordStart(offset: number) {
  const length = CIPHER_CORPUS.length;
  for (let i = 0; i < length; i++) {
    const index = (offset + i) % length;
    if (CIPHER_CORPUS[index].kind === "space") return (index + 1) % length;
  }
  return 0;
}

function drawRules(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  for (const d of [0, width * 3]) {
    ctx.strokeRect(inset + d, inset + d, w - (inset + d) * 2, h - (inset + d) * 2);
  }
}

function drawDropCap(ctx: CanvasRenderingContext2D, glyph: number, x: number, y: number, size: number, rand: () => number) {
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
  ctx.strokeRect(x + 5, y + 5, size - 10, size - 10);
  for (const [cx, cy] of [
    [x, y],
    [x + size, y],
    [x, y + size],
    [x + size, y + size],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  drawGlyph(ctx, glyph, x + size * 0.27, y + size * 0.14, size * 0.72, rand);
}

function drawMarginNote(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number) {
  const count = 2 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    drawGlyph(ctx, Math.floor(rand() * CIPHER_ALPHABET.length), x, y + i * 16, 12, rand);
  }
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 6);
  ctx.quadraticCurveTo(x - 16, y + count * 8, x - 8, y + count * 16 + 4);
  ctx.stroke();
}

export const PRINTED_LAYOUT = {
  width: 768,
  height: 1075,
  bodyX: 92,
  bodyTop: 96,
  glyphHeight: 17,
  lineGap: 9,
} as const;

export const PRINTED_DROP_CAP = {
  x: PRINTED_LAYOUT.bodyX,
  y: PRINTED_LAYOUT.bodyTop,
  size: (PRINTED_LAYOUT.glyphHeight + PRINTED_LAYOUT.lineGap) * 3 - PRINTED_LAYOUT.lineGap,
} as const;

export function createPrintedPageTexture(seed: number) {
  const w = PRINTED_LAYOUT.width;
  const h = PRINTED_LAYOUT.height;
  const rand = seededRandom(seed);
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = "rgb(232,218,186)";
  ctx.fillRect(0, 0, w, h);
  const stains = smoothNoiseField(w, h, rand, [
    { size: 180, weight: 1 },
    { size: 50, weight: 0.4 },
  ]);
  const image = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) {
    const tone = 0.9 + stains[i] * 0.12;
    image.data[i * 4] *= tone;
    image.data[i * 4 + 1] *= tone * (0.98 + stains[i] * 0.02);
    image.data[i * 4 + 2] *= tone * (0.94 + stains[i] * 0.04);
  }
  ctx.putImageData(image, 0, 0);
  const age = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.72);
  age.addColorStop(0, "rgba(130,90,40,0)");
  age.addColorStop(1, "rgba(130,90,40,0.3)");
  ctx.fillStyle = age;
  ctx.fillRect(0, 0, w, h);

  const rubric = "rgba(128,32,22,0.72)";
  const ink = "rgb(40,24,14)";
  drawRules(ctx, w, h, 52, "rgba(128,32,22,0.35)", 1.2);

  ctx.fillStyle = rubric;
  ctx.strokeStyle = rubric;
  drawGlyphRow(ctx, CIPHER_HEADER_TOKENS, w / 2, 20, 18, rand);
  ctx.font = `600 17px ${getSerifFamily()}`;
  ctx.textAlign = "center";
  ctx.fillText(toRoman(12 + (seed % 90)), w - 88, 34);

  const bodyX = PRINTED_LAYOUT.bodyX;
  const bodyRight = w - 150;
  const { glyphHeight, lineGap } = PRINTED_LAYOUT;
  const dropSize = PRINTED_DROP_CAP.size;
  const start = wordStart(Math.floor(seed * 37) % CIPHER_CORPUS.length);
  const firstGlyph = CIPHER_CORPUS.find((token, index) => index >= start && token.kind === "glyph");

  ctx.fillStyle = rubric;
  ctx.strokeStyle = rubric;
  if (firstGlyph?.kind === "glyph") drawDropCap(ctx, firstGlyph.index, PRINTED_DROP_CAP.x, PRINTED_DROP_CAP.y, dropSize, rand);

  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  drawCipherBlock(
    ctx,
    CIPHER_CORPUS,
    start + 1,
    {
      x: bodyX,
      y: PRINTED_LAYOUT.bodyTop,
      width: bodyRight - bodyX,
      bottom: h - 100,
      glyphHeight,
      lineGap,
      indentFirst: dropSize + 14,
      indentLines: 3,
    },
    rand,
  );

  ctx.fillStyle = rubric;
  ctx.strokeStyle = rubric;
  ctx.lineWidth = 1.2;
  drawMarginNote(ctx, w - 118, 200 + rand() * 180, rand);
  drawMarginNote(ctx, w - 118, 620 + rand() * 200, rand);
  return canvasToTexture(canvas, true);
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

export const TAROT_FRAME = { x: 367, y: 268, width: 290, height: 500 };

export type TarotLabel = { numeral: string; name: string };

export function tarotFrameUv() {
  const { x, y, width, height } = TAROT_FRAME;
  return new THREE.Vector4(
    x / PAGE_TEXTURE_WIDTH,
    1 - (y + height) / PAGE_TEXTURE_HEIGHT,
    (x + width) / PAGE_TEXTURE_WIDTH,
    1 - y / PAGE_TEXTURE_HEIGHT,
  );
}

function drawFooter(ctx: CanvasRenderingContext2D, family: string, w: number, h: number, label: string, pageNumber: number) {
  ctx.fillStyle = "rgba(255,0,0,0.7)";
  ctx.font = `italic 500 40px ${family}`;
  ctx.fillText(`— ${label} · ${toRoman(pageNumber)} —`, w / 2, h - 96);
}

function drawTarotAnswer(ctx: CanvasRenderingContext2D, family: string, w: number, answer: string, question: string, card: TarotLabel) {
  ctx.fillStyle = RUBRIC;
  ctx.font = `600 40px ${family}`;
  fillSpacedText(ctx, BRAND_NAME_UPPER, w / 2, 116, 16);

  if (question) {
    ctx.font = `italic 600 38px ${family}`;
    const questionLines = wrapText(ctx, `“${question}”`, 780).slice(0, 2);
    const firstY = questionLines.length > 1 ? 172 : 192;
    questionLines.forEach((line, index) => ctx.fillText(line, w / 2, firstY + index * 42));
  }

  const { x, y, width, height } = TAROT_FRAME;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.strokeRect(x - 14, y - 14, width + 28, height + 28);
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 26, y - 26, width + 52, height + 52);
  ctx.fillStyle = GOLD;
  for (const [cx, cy] of [[x - 20, y - 20], [x + width + 20, y - 20], [x - 20, y + height + 20], [x + width + 20, y + height + 20]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }

  const nameY = 1214;
  ctx.fillStyle = RUBRIC;
  ctx.font = `600 44px ${family}`;
  fillSpacedText(ctx, `${card.numeral} · ${card.name}`, w / 2, nameY, 6);

  let size = 46;
  let lines: string[] = [];
  do {
    ctx.font = `italic 500 ${size}px ${family}`;
    lines = balanceLines(ctx, keepDashWithNextWord(answer), 820);
    size -= 2;
  } while (lines.length > 2 && size > 32);
  size += 2;
  const lineHeight = size * 1.12;
  ctx.fillStyle = INK;
  ctx.font = `italic 500 ${size}px ${family}`;
  lines.slice(0, 2).forEach((line, index) => ctx.fillText(line, w / 2, nameY + 60 + lineHeight * index));
}

export async function createAnswerTexture(
  answer: string,
  pageNumber: number,
  bookTitle: string,
  question = "",
  golden = false,
  card: TarotLabel | null = null,
) {
  const family = getSerifFamily();
  await ensureFonts(family);
  const w = PAGE_TEXTURE_WIDTH;
  const h = PAGE_TEXTURE_HEIGHT;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const decorRand = seededRandom(pageNumber);
  drawRules(ctx, w, h, 64, golden ? "rgba(0,0,255,0.9)" : "rgba(0,255,0,0.5)", golden ? 3 : 1.6);
  if (golden) {
    drawRules(ctx, w, h, 34, "rgba(0,0,255,1)", 7);
    ctx.fillStyle = GOLD;
    for (const [cx, cy] of [[34, 34], [w - 34, 34], [34, h - 34], [w - 34, h - 34]]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-16, -16, 32, 32);
      ctx.restore();
    }
  }
  ctx.fillStyle = golden ? GOLD : "rgba(0,255,0,0.6)";
  for (const [cx, cy, sx, sy] of [
    [64, 64, 1, 1],
    [w - 64, 64, -1, 1],
    [64, h - 64, 1, -1],
    [w - 64, h - 64, -1, -1],
  ]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.bezierCurveTo(40, 8, 58, 26, 52, 44);
    ctx.bezierCurveTo(46, 30, 30, 22, 8, 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(14, 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (card) {
    drawTarotAnswer(ctx, family, w, answer, question, card);
    return canvasToTexture(canvas, false);
  }

  ctx.fillStyle = GOLD;
  ctx.strokeStyle = GOLD;
  drawGlyphRow(ctx, CIPHER_CRIB_TOKENS, w / 2, 166, 22, decorRand);

  ctx.fillStyle = RUBRIC;
  ctx.font = `600 40px ${family}`;
  fillSpacedText(ctx, BRAND_NAME_UPPER, w / 2, 116, 16);

  const footerLabel = golden ? getMessages().golden.label : bookTitle;

  let size = 100;
  let lines: string[] = [];
  do {
    ctx.font = `italic 500 ${size}px ${family}`;
    lines = balanceLines(ctx, keepDashWithNextWord(answer), 780);
    size -= 4;
  } while (lines.length > 3 && size > 56);
  size += 4;

  const lineHeight = size * 1.22;
  const blockHeight = lines.length * lineHeight;
  const top = h * 0.42 - blockHeight / 2;

  let questionBottom = 0;
  if (question) {
    ctx.fillStyle = RUBRIC;
    ctx.font = `italic 600 48px ${family}`;
    const questionLines = wrapText(ctx, `“${question}”`, 740).slice(0, 2);
    questionLines.forEach((line, index) => {
      ctx.fillText(line, w / 2, 262 + index * 58);
    });
    questionBottom = 262 + (questionLines.length - 1) * 58 + 36;
  }

  const symbolY = Math.max(260, top - 130);
  if (!question || symbolY - 80 > questionBottom + 20) {
    ctx.fillStyle = GOLD;
    ctx.strokeStyle = GOLD;
    traceBrandSymbol(ctx, w / 2, question ? Math.max(symbolY, questionBottom + 100) : symbolY, question ? 110 : 150);
  }

  if (golden) {
    ctx.fillStyle = GOLD;
    ctx.fillRect(w / 2 - 220, top - 34, 440, 5);
    ctx.fillRect(w / 2 - 220, top + blockHeight + 30, 440, 5);
    for (const x of [w / 2 - 240, w / 2 + 240]) {
      for (const y of [top - 32, top + blockHeight + 32]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-9, -9, 18, 18);
        ctx.restore();
      }
    }
  }

  ctx.fillStyle = INK;
  ctx.font = `italic 500 ${size}px ${family}`;
  lines.forEach((line, index) => {
    ctx.fillText(line, w / 2, top + lineHeight * (index + 0.5));
  });

  ctx.fillStyle = RUBRIC;
  ctx.beginPath();
  ctx.arc(w / 2, top + blockHeight + 70, 5, 0, Math.PI * 2);
  ctx.fill();

  drawFooter(ctx, family, w, h, footerLabel, pageNumber);

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
  const [first, second] = getMessages().epigraph;
  ctx.fillText(first, w / 2, h * 0.45);
  ctx.fillText(second, w / 2, h * 0.45 + 62);

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
