import * as THREE from "three";
import type { BookTheme } from "@/lib/themes";
import {
  alphaField,
  canvasToTexture,
  createCanvas,
  heightToNormalCanvas,
  seededRandom,
  smoothNoiseField,
  softenCanvas,
  worleyField,
} from "./procedural";

const WIDTH = 1024;
const HEIGHT = 1420;

export type CoverTextures = {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  surface: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
  dispose: () => void;
};

export type LeatherTextures = {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  dispose: () => void;
};

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

type Tool = {
  ctx: CanvasRenderingContext2D;
  gold: () => void;
  cut: () => void;
};

function makeTool(ctx: CanvasRenderingContext2D): Tool {
  return {
    ctx,
    gold: () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#fff";
    },
    cut: () => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#fff";
    },
  };
}

function scallopedPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  lobes: number,
  depth: number,
) {
  const steps = 480;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const wave = 1 + depth * Math.pow(Math.abs(Math.cos((theta * lobes) / 2)), 0.55);
    const x = cx + Math.cos(theta) * rx * wave;
    const y = cy + Math.sin(theta) * ry * wave;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function spiral(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rotation: number,
  direction: 1 | -1,
  lineWidth: number,
) {
  const turns = 1.35;
  const steps = 60;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(direction, 1);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * Math.PI * 2 * turns;
    const r = radius * (1 - t * 0.82);
    const px = Math.cos(theta) * r;
    const py = Math.sin(theta) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(radius * 1.05, -radius * 0.45, radius * 0.42, radius * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function spiralRing(
  tool: Tool,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  radius: number,
  lineWidth: number,
  phase: number,
) {
  for (let i = 0; i < count; i++) {
    const angle = ((i + phase) / count) * Math.PI * 2;
    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);
    const gap = radius * 0.9;
    spiral(tool.ctx, x + tangentX * gap, y + tangentY * gap, radius, angle - Math.PI / 2, 1, lineWidth);
    spiral(tool.ctx, x - tangentX * gap, y - tangentY * gap, radius, angle - Math.PI / 2, -1, lineWidth);
  }
}

function rosette(tool: Tool, cx: number, cy: number, radius: number, petals: number) {
  const { ctx } = tool;
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius * 0.55, cy + Math.sin(angle) * radius * 0.55);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.5, radius * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function corner(tool: Tool, x: number, y: number, sx: number, sy: number) {
  const { ctx } = tool;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  const steps = 160;

  tool.gold();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * (Math.PI / 2);
    const r = 176 + 16 * Math.pow(Math.abs(Math.cos(theta * 7)), 0.6);
    ctx.lineTo(Math.cos(theta) * r, Math.sin(theta) * r);
  }
  ctx.closePath();
  ctx.fill();

  tool.cut();
  ctx.beginPath();
  ctx.moveTo(10, 10);
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * (Math.PI / 2);
    const r = 156 + 10 * Math.pow(Math.abs(Math.cos(theta * 7)), 0.6);
    ctx.lineTo(10 + Math.cos(theta) * r, 10 + Math.sin(theta) * r);
  }
  ctx.closePath();
  ctx.fill();

  tool.gold();
  ctx.beginPath();
  ctx.moveTo(16, 16);
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * (Math.PI / 2);
    const r = 142 + 8 * Math.pow(Math.abs(Math.cos(theta * 5)), 0.6);
    ctx.lineTo(16 + Math.cos(theta) * r, 16 + Math.sin(theta) * r);
  }
  ctx.closePath();
  ctx.fill();

  tool.cut();
  for (let i = 0; i < 5; i++) {
    const theta = ((i + 0.5) / 5) * (Math.PI / 2);
    spiral(ctx, 16 + Math.cos(theta) * 92, 16 + Math.sin(theta) * 92, 20, theta + Math.PI / 2, i % 2 === 0 ? 1 : -1, 3);
  }
  for (let i = 0; i < 3; i++) {
    const theta = ((i + 0.5) / 3) * (Math.PI / 2);
    spiral(ctx, 16 + Math.cos(theta) * 44, 16 + Math.sin(theta) * 44, 13, theta, i % 2 === 0 ? -1 : 1, 2.5);
  }
  ctx.restore();
}

function pendant(tool: Tool, cx: number, cy: number, direction: 1 | -1) {
  const { ctx } = tool;
  tool.gold();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx + 40, cy + direction * 26, cx + 30, cy + direction * 70, cx, cy + direction * 96);
  ctx.bezierCurveTo(cx - 30, cy + direction * 70, cx - 40, cy + direction * 26, cx, cy);
  ctx.fill();
  tool.cut();
  spiral(ctx, cx - 10, cy + direction * 40, 11, direction === 1 ? 0 : Math.PI, 1, 2.2);
  spiral(ctx, cx + 10, cy + direction * 40, 11, direction === 1 ? 0 : Math.PI, -1, 2.2);
  tool.gold();
  ctx.beginPath();
  ctx.moveTo(cx, cy + direction * 104);
  ctx.lineTo(cx + 9, cy + direction * 118);
  ctx.lineTo(cx, cy + direction * 132);
  ctx.lineTo(cx - 9, cy + direction * 118);
  ctx.closePath();
  ctx.fill();
}

function drawGoldTooling(tool: Tool) {
  const { ctx } = tool;
  const w = WIDTH;
  const h = HEIGHT;

  tool.gold();
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, w - 80, h - 80);
  ctx.lineWidth = 1.6;
  ctx.strokeRect(66, 66, w - 132, h - 132);

  const chain = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
  };
  for (let x = 72; x <= w - 72; x += 18) {
    chain(x, 53);
    chain(x, h - 53);
  }
  for (let y = 72; y <= h - 72; y += 18) {
    chain(53, y);
    chain(w - 53, y);
  }

  corner(tool, 66, 66, 1, 1);
  corner(tool, w - 66, 66, -1, 1);
  corner(tool, 66, h - 66, 1, -1);
  corner(tool, w - 66, h - 66, -1, -1);

  const cx = w / 2;
  const cy = h / 2;
  const rx = 200;
  const ry = 318;

  tool.gold();
  scallopedPath(ctx, cx, cy, rx, ry, 20, 0.075);
  ctx.fill();
  tool.cut();
  scallopedPath(ctx, cx, cy, rx * 0.9, ry * 0.915, 20, 0.06);
  ctx.fill();
  tool.gold();
  scallopedPath(ctx, cx, cy, rx * 0.85, ry * 0.87, 16, 0.055);
  ctx.fill();

  tool.cut();
  spiralRing(tool, cx, cy, rx * 0.6, ry * 0.64, 8, 19, 3, 0.5);
  spiralRing(tool, cx, cy, rx * 0.36, ry * 0.4, 6, 13, 2.5, 0);
  ctx.lineWidth = 2.4;
  scallopedPath(ctx, cx, cy, rx * 0.78, ry * 0.81, 16, 0.05);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, 46, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  tool.gold();
  rosette(tool, cx, cy, 40, 8);

  pendant(tool, cx, cy - ry * 1.08, -1);
  pendant(tool, cx, cy + ry * 1.08, 1);
  ctx.globalCompositeOperation = "source-over";
}

function drawBlindTooling(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(94, 94, WIDTH - 188, HEIGHT - 188);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(102, 102, WIDTH - 204, HEIGHT - 204);
}

function leatherFields(width: number, height: number, seed: number) {
  const rand = seededRandom(seed);
  const grain = worleyField(width, height, 6, rand);
  const blotch = smoothNoiseField(width, height, rand, [
    { size: 220, weight: 1 },
    { size: 70, weight: 0.5 },
    { size: 22, weight: 0.25 },
  ]);
  return { grain, blotch, rand };
}

export function createCoverTextures(theme: BookTheme): CoverTextures {
  const w = WIDTH;
  const h = HEIGHT;
  const { grain, blotch, rand } = leatherFields(w, h, 7);
  const fine = smoothNoiseField(w, h, rand, [
    { size: 14, weight: 1 },
    { size: 5, weight: 0.4 },
  ]);

  const goldCanvas = createCanvas(w, h);
  drawGoldTooling(makeTool(goldCanvas.ctx));
  const blindCanvas = createCanvas(w, h);
  drawBlindTooling(blindCanvas.ctx);

  const goldRaw = alphaField(goldCanvas.canvas);
  const goldSoft = alphaField(softenCanvas(goldCanvas.canvas, 5));
  const blindSoft = alphaField(softenCanvas(blindCanvas.canvas, 3));

  const cover = hexToRgb(theme.cover);
  const goldLight = hexToRgb(theme.goldLight);
  const goldDeep = hexToRgb(theme.goldDeep);

  const color = createCanvas(w, h);
  const surface = createCanvas(w, h);
  const glow = createCanvas(w, h);
  const colorImage = color.ctx.createImageData(w, h);
  const surfaceImage = surface.ctx.createImageData(w, h);
  const glowImage = glow.ctx.createImageData(w, h);
  const heightField = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const g = grain[i];
      const b = blotch[i];
      const f = fine[i];

      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const edgeShade = 0.72 + 0.28 * Math.min(1, edge / 70);
      const scuff = edge < 26 && f > 0.62 ? 1.25 : 1;

      const wear = Math.max(0, Math.min(1, (b - 0.7) * 4));
      const goldAlpha = goldRaw[i] * (1 - wear * 0.75) * (f < 0.1 ? 0.3 : 1);

      const shadowIndex = Math.max(0, y - 3) * w + Math.max(0, x - 2);
      const deboss = goldSoft[shadowIndex] * (1 - goldRaw[i]) * 0.5;
      const blind = blindSoft[i];

      const leatherTone = (0.78 + b * 0.34) * (0.82 + g * 0.22) * edgeShade * scuff * (1 - deboss) * (1 - blind * 0.4);
      const lr = cover[0] * leatherTone;
      const lg = cover[1] * leatherTone;
      const lb = cover[2] * leatherTone;

      const goldMix = Math.min(1, Math.max(0, 0.25 + f * 0.55 + (x + y) / (w + h) * 0.3 - wear * 0.3));
      const gr = goldDeep[0] + (goldLight[0] - goldDeep[0]) * goldMix;
      const gg = goldDeep[1] + (goldLight[1] - goldDeep[1]) * goldMix;
      const gb = goldDeep[2] + (goldLight[2] - goldDeep[2]) * goldMix;

      colorImage.data[p] = lr + (gr - lr) * goldAlpha;
      colorImage.data[p + 1] = lg + (gg - lg) * goldAlpha;
      colorImage.data[p + 2] = lb + (gb - lb) * goldAlpha;
      colorImage.data[p + 3] = 255;

      const leatherRough = 0.52 + g * 0.18 + b * 0.12;
      const goldRough = 0.24 + f * 0.2 + wear * 0.2;
      surfaceImage.data[p] = 0;
      surfaceImage.data[p + 1] = (leatherRough + (goldRough - leatherRough) * goldAlpha) * 255;
      surfaceImage.data[p + 2] = goldAlpha * 255;
      surfaceImage.data[p + 3] = 255;

      glowImage.data[p] = goldAlpha * 255;
      glowImage.data[p + 1] = goldAlpha * 255;
      glowImage.data[p + 2] = goldAlpha * 255;
      glowImage.data[p + 3] = 255;

      const leatherHeight = g * 0.55 + b * 0.35;
      heightField[i] = leatherHeight * (1 - goldSoft[i]) - goldSoft[i] * 0.9 - blind * 0.8;
    }
  }

  color.ctx.putImageData(colorImage, 0, 0);
  surface.ctx.putImageData(surfaceImage, 0, 0);
  glow.ctx.putImageData(glowImage, 0, 0);
  const normalCanvas = heightToNormalCanvas(heightField, w, h, 2.2);

  const map = canvasToTexture(color.canvas, true);
  const normalMap = canvasToTexture(normalCanvas, false);
  const surfaceTexture = canvasToTexture(surface.canvas, false);
  const glowTexture = canvasToTexture(glow.canvas, false);

  return {
    map,
    normalMap,
    surface: surfaceTexture,
    glow: glowTexture,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      surfaceTexture.dispose();
      glowTexture.dispose();
    },
  };
}

export function createLeatherTextures(theme: BookTheme): LeatherTextures {
  const size = 512;
  const { grain, blotch } = leatherFields(size, size, 13);
  const cover = hexToRgb(theme.cover);
  const color = createCanvas(size, size);
  const image = color.ctx.createImageData(size, size);
  const heightField = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const tone = (0.74 + blotch[i] * 0.3) * (0.82 + grain[i] * 0.22);
    image.data[i * 4] = cover[0] * tone;
    image.data[i * 4 + 1] = cover[1] * tone;
    image.data[i * 4 + 2] = cover[2] * tone;
    image.data[i * 4 + 3] = 255;
    heightField[i] = grain[i] * 0.55 + blotch[i] * 0.35;
  }
  color.ctx.putImageData(image, 0, 0);
  const map = canvasToTexture(color.canvas, true);
  const normalMap = canvasToTexture(heightToNormalCanvas(heightField, size, size, 2.2), false);
  for (const texture of [map, normalMap]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return {
    map,
    normalMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
    },
  };
}
