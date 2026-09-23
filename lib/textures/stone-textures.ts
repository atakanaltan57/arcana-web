import { canvasToTexture, createCanvas, seededRandom, softenCanvas } from "./procedural";
import { traceBrandSymbol } from "./brand-symbol";

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

export function createGemCrackTexture(seed: number) {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  const rand = seededRandom(seed);
  const crack = (x: number, y: number, angle: number, length: number, width: number, depth: number) => {
    let px = x;
    let py = y;
    let heading = angle;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(px, py);
    const steps = Math.max(2, Math.round(length / 9));
    for (let i = 0; i < steps; i++) {
      heading += (rand() - 0.5) * 0.7;
      px += Math.cos(heading) * (length / steps);
      py += Math.sin(heading) * (length / steps);
      ctx.lineTo(px, py);
      if (depth > 0 && rand() < 0.22) {
        ctx.stroke();
        crack(px, py, heading + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.6), length * 0.45, width * 0.6, depth - 1);
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(px, py);
      }
    }
    ctx.stroke();
  };
  const origin = { x: size * (0.45 + rand() * 0.1), y: size * (0.42 + rand() * 0.16) };
  const arms = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < arms; i++) {
    crack(origin.x, origin.y, (i / arms) * Math.PI * 2 + rand() * 0.6, size * (0.3 + rand() * 0.25), 3.2, 2);
  }
  const soft = softenCanvas(canvas, 4);
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(soft, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return canvasToTexture(canvas, false);
}
