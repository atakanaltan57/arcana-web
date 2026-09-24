export function getSerifFamily() {
  if (typeof document === "undefined") return "Georgia, serif";
  const value = getComputedStyle(document.body).getPropertyValue("--font-cormorant").trim();
  return value ? `${value}, Georgia, serif` : "Georgia, serif";
}

export function getSansFamily() {
  if (typeof document === "undefined") return "system-ui, sans-serif";
  const value = getComputedStyle(document.body).getPropertyValue("--font-manrope").trim();
  return value ? `${value}, system-ui, sans-serif` : "system-ui, sans-serif";
}

const GLYPH_SAMPLE = "AaşŞğĞıİçÇöÖüÜ—“”%1";

export async function ensureFonts(family: string, sans?: string) {
  if (!document.fonts) return;
  const faces = [`italic 500 80px ${family}`, `500 40px ${family}`, `600 40px ${family}`];
  if (sans) faces.push(`600 32px ${sans}`);
  try {
    await Promise.all(faces.map((face) => document.fonts.load(face, GLYPH_SAMPLE)));
  } catch (error) {
    console.error("Font could not be loaded for page text", error);
  }
}

export function keepDashWithNextWord(text: string) {
  return text.replace(/ ([—–]) /g, " $1\u00A0");
}

export function balanceLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const greedy = wrapText(ctx, text, maxWidth);
  if (greedy.length < 2) return greedy;
  let low = maxWidth * 0.45;
  let high = maxWidth;
  let best = greedy;
  for (let step = 0; step < 12; step++) {
    const mid = (low + high) / 2;
    const lines = wrapText(ctx, text, mid);
    if (lines.length <= greedy.length) {
      best = lines;
      high = mid;
    } else {
      low = mid;
    }
  }
  return best;
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/[ \t\n\r]+/).filter(Boolean);
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

export function fillSpacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const align = ctx.textAlign;
  const centered = align === "center";
  const supportsSpacing = typeof (ctx as { letterSpacing?: unknown }).letterSpacing === "string";
  if (supportsSpacing) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, centered ? x + spacing / 2 : x, y);
    ctx.letterSpacing = "0px";
    return;
  }
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + spacing * (chars.length - 1);
  let cursor = centered ? x - total / 2 : align === "right" || align === "end" ? x - total : x;
  ctx.textAlign = "left";
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[index] + spacing;
  });
  ctx.textAlign = align;
}
