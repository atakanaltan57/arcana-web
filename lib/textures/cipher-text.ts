import { CIPHER_GLYPHS, GLYPH_BOX, type CipherToken } from "@/lib/cipher";

let glyphPaths: Path2D[] | null = null;

function getGlyphPaths() {
  if (!glyphPaths) glyphPaths = CIPHER_GLYPHS.map((path) => new Path2D(path));
  return glyphPaths;
}

export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  height: number,
  rand: () => number,
) {
  const scale = height / GLYPH_BOX.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rand() - 0.5) * 0.06);
  ctx.scale(scale, scale);
  ctx.lineWidth = 9 + rand() * 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(getGlyphPaths()[index]);
  ctx.restore();
}

function glyphAdvance(height: number) {
  return (GLYPH_BOX.width / GLYPH_BOX.height) * height + height * 0.14;
}

function drawMark(ctx: CanvasRenderingContext2D, token: CipherToken, x: number, y: number, height: number) {
  const r = height * 0.06;
  ctx.beginPath();
  if (token.kind === "stop") {
    ctx.moveTo(x, y + height * 0.55 - r * 2);
    ctx.lineTo(x + r, y + height * 0.55 - r);
    ctx.lineTo(x, y + height * 0.55);
    ctx.lineTo(x - r, y + height * 0.55 - r);
    ctx.closePath();
    ctx.moveTo(x, y + height * 0.85 - r * 2);
    ctx.lineTo(x + r, y + height * 0.85 - r);
    ctx.lineTo(x, y + height * 0.85);
    ctx.lineTo(x - r, y + height * 0.85 - r);
    ctx.closePath();
  } else {
    ctx.arc(x, y + height * 0.82, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

type Word = { tokens: CipherToken[]; width: number };

function collectWords(tokens: CipherToken[], start: number, height: number) {
  const words: Word[] = [];
  let current: Word = { tokens: [], width: 0 };
  const advance = glyphAdvance(height);
  for (let i = 0; i < tokens.length * 3; i++) {
    const token = tokens[(start + i) % tokens.length];
    if (token.kind === "space") {
      if (current.tokens.length) words.push(current);
      current = { tokens: [], width: 0 };
      continue;
    }
    current.tokens.push(token);
    current.width += token.kind === "glyph" ? advance : height * 0.35;
  }
  if (current.tokens.length) words.push(current);
  return words;
}

export type CipherBlock = {
  x: number;
  y: number;
  width: number;
  bottom: number;
  glyphHeight: number;
  lineGap: number;
  indentFirst?: number;
  indentLines?: number;
};

export function drawCipherBlock(
  ctx: CanvasRenderingContext2D,
  tokens: CipherToken[],
  start: number,
  block: CipherBlock,
  rand: () => number,
) {
  const words = collectWords(tokens, start, block.glyphHeight);
  const space = block.glyphHeight * 0.55;
  const advance = glyphAdvance(block.glyphHeight);
  const lineHeight = block.glyphHeight + block.lineGap;
  let wordIndex = 0;
  let line = 0;
  for (let y = block.y; y + block.glyphHeight <= block.bottom && wordIndex < words.length; y += lineHeight, line++) {
    const indent = line < (block.indentLines ?? 0) ? (block.indentFirst ?? 0) : 0;
    const available = block.width - indent;
    const lineWords: Word[] = [];
    let used = 0;
    while (wordIndex < words.length) {
      const word = words[wordIndex];
      const next = used + (lineWords.length ? space : 0) + word.width;
      if (next > available && lineWords.length) break;
      lineWords.push(word);
      used = next;
      wordIndex++;
    }
    const gaps = Math.max(1, lineWords.length - 1);
    const extra = lineWords.length > 1 ? (available - used) / gaps : 0;
    let x = block.x + indent;
    for (const word of lineWords) {
      const alpha = 0.72 + rand() * 0.28;
      ctx.globalAlpha = alpha;
      for (const token of word.tokens) {
        if (token.kind === "glyph") {
          drawGlyph(ctx, token.index, x, y, block.glyphHeight, rand);
          x += advance;
        } else {
          drawMark(ctx, token, x + block.glyphHeight * 0.12, y, block.glyphHeight);
          x += block.glyphHeight * 0.35;
        }
      }
      x += space + extra;
    }
    ctx.globalAlpha = 1;
  }
}

export function drawGlyphRow(
  ctx: CanvasRenderingContext2D,
  tokens: CipherToken[],
  centerX: number,
  y: number,
  height: number,
  rand: () => number,
) {
  const advance = glyphAdvance(height);
  const width = tokens.reduce((sum, token) => sum + (token.kind === "glyph" ? advance : height * 0.55), 0);
  let x = centerX - width / 2;
  for (const token of tokens) {
    if (token.kind === "glyph") {
      drawGlyph(ctx, token.index, x, y, height, rand);
      x += advance;
    } else {
      x += height * 0.55;
    }
  }
}
