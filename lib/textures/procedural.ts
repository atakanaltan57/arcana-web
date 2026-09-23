import * as THREE from "three";

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Canvas 2D context is not available");
  }
  return { canvas, ctx };
}

export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function worleyField(width: number, height: number, cell: number, rand: () => number) {
  const gx = Math.ceil(width / cell) + 2;
  const gy = Math.ceil(height / cell) + 2;
  const px = new Float32Array(gx * gy);
  const py = new Float32Array(gx * gy);
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      px[j * gx + i] = (i + rand()) * cell;
      py[j * gx + i] = (j + rand()) * cell;
    }
  }
  const out = new Float32Array(width * height);
  const cellSq = cell * cell;
  for (let y = 0; y < height; y++) {
    const cy = Math.floor(y / cell);
    for (let x = 0; x < width; x++) {
      const cx = Math.floor(x / cell);
      let best = Infinity;
      for (let j = Math.max(0, cy - 1); j <= Math.min(gy - 1, cy + 1); j++) {
        for (let i = Math.max(0, cx - 1); i <= Math.min(gx - 1, cx + 1); i++) {
          const k = j * gx + i;
          const dx = px[k] - x;
          const dy = py[k] - y;
          const d = dx * dx + dy * dy;
          if (d < best) best = d;
        }
      }
      out[y * width + x] = Math.min(1, Math.sqrt(best / cellSq));
    }
  }
  return out;
}

export function smoothNoiseField(
  width: number,
  height: number,
  rand: () => number,
  octaves: { size: number; weight: number; stretchX?: number }[],
) {
  const { ctx } = createCanvas(width, height);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (const octave of octaves) {
    const stretch = octave.stretchX ?? 1;
    const sw = Math.max(2, Math.round(width / (octave.size * stretch)));
    const sh = Math.max(2, Math.round(height / octave.size));
    const small = createCanvas(sw, sh);
    const data = small.ctx.createImageData(sw, sh);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.floor(rand() * 255);
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    small.ctx.putImageData(data, 0, 0);
    ctx.globalAlpha = octave.weight;
    ctx.drawImage(small.canvas, 0, 0, width, height);
  }
  ctx.globalAlpha = 1;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const out = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < out.length; i++) {
    const v = pixels[i * 4];
    out[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < out.length; i++) {
    out[i] = (out[i] - min) / range;
  }
  return out;
}

export function softenCanvas(source: HTMLCanvasElement, factor: number) {
  const w = source.width;
  const h = source.height;
  const small = createCanvas(Math.max(1, Math.round(w / factor)), Math.max(1, Math.round(h / factor)));
  small.ctx.imageSmoothingQuality = "high";
  small.ctx.drawImage(source, 0, 0, small.canvas.width, small.canvas.height);
  const out = createCanvas(w, h);
  out.ctx.imageSmoothingQuality = "high";
  out.ctx.drawImage(small.canvas, 0, 0, w, h);
  return out.canvas;
}

export function alphaField(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is not available");
  }
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const out = new Float32Array(canvas.width * canvas.height);
  for (let i = 0; i < out.length; i++) {
    out[i] = pixels[i * 4 + 3] / 255;
  }
  return out;
}

export function heightToNormalCanvas(heightField: Float32Array, width: number, height: number, strength: number) {
  const { canvas, ctx } = createCanvas(width, height);
  const image = ctx.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(width - 1, x + 1);
      const dx = (heightField[y * width + x1] - heightField[y * width + x0]) * strength;
      const dy = (heightField[y1 * width + x] - heightField[y0 * width + x]) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * width + x) * 4;
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function canvasToTexture(canvas: HTMLCanvasElement, srgb: boolean) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

