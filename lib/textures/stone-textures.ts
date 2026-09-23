import { alphaField, canvasToTexture, createCanvas, heightToNormalCanvas, seededRandom, softenCanvas } from "./procedural";
import { traceBrandSymbol } from "./brand-symbol";

export function createWaxSealEmboss() {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  traceBrandSymbol(ctx, size / 2, size / 2, size * 0.8);
  const texture = canvasToTexture(canvas, false);
  return texture;
}

export function createNumeralTexture(text: string) {
  const { canvas, ctx } = createCanvas(128, 64);
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = "#fff";
  ctx.font = "600 40px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 34);
  return canvasToTexture(canvas, true);
}

export function createSymbolMask(size: number, ring: boolean) {
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  traceBrandSymbol(ctx, size / 2, size / 2, size * (ring ? 0.78 : 0.9));
  if (ring) {
    ctx.lineWidth = size * 0.018;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.47, 0, Math.PI * 2);
    ctx.stroke();
  }
  return canvasToTexture(canvas, false);
}

export function createWaxSealNormal(discFraction: number) {
  const size = 512;
  const symbolCanvas = createCanvas(size, size);
  symbolCanvas.ctx.fillStyle = "#fff";
  symbolCanvas.ctx.strokeStyle = "#fff";
  traceBrandSymbol(symbolCanvas.ctx, size / 2, size / 2, size * discFraction * 1.25);
  const symbol = alphaField(softenCanvas(symbolCanvas.canvas, 3));
  const rand = seededRandom(313);
  const heightField = new Float32Array(size * size);
  const discRadius = size * discFraction;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const r = Math.hypot(x - size / 2, y - size / 2) / discRadius;
      const dome = Math.sqrt(Math.max(0, 1 - Math.min(1, r) ** 2)) * 0.35;
      const pressed = r < 0.74 ? -0.25 : 0;
      const rim = Math.max(0, 1 - Math.abs(r - 0.82) / 0.1) * 0.3;
      const wobble = (rand() - 0.5) * 0.015;
      heightField[i] = dome + pressed + rim + symbol[i] * 0.32 * (r < 0.74 ? 1 : 0) + wobble;
    }
  }
  const texture = canvasToTexture(heightToNormalCanvas(heightField, size, size, 6), false);
  return texture;
}
