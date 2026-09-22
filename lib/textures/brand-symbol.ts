import {
  BRAND_SYMBOL_FILL_PATH,
  BRAND_SYMBOL_STROKE_PATH,
  BRAND_SYMBOL_STROKE_WIDTH,
  BRAND_SYMBOL_VIEWBOX,
} from "@/lib/brand";

export function traceBrandSymbol(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  engrave?: () => void,
) {
  const scale = size / BRAND_SYMBOL_VIEWBOX;
  const strokes = new Path2D(BRAND_SYMBOL_STROKE_PATH);
  const gem = new Path2D(BRAND_SYMBOL_FILL_PATH);
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = BRAND_SYMBOL_STROKE_WIDTH;
  ctx.stroke(strokes);
  ctx.fill(gem);
  if (engrave) {
    engrave();
    ctx.lineWidth = BRAND_SYMBOL_STROKE_WIDTH * 0.22;
    ctx.stroke(strokes);
    ctx.beginPath();
    ctx.moveTo(50, 37);
    ctx.lineTo(50, 61);
    ctx.moveTo(45.5, 49);
    ctx.lineTo(54.5, 49);
    ctx.stroke();
  }
  ctx.restore();
}
