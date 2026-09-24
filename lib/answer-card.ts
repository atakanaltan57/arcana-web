import { BRAND_NAME_UPPER, siteUrl } from "@/lib/brand";
import { getMessages } from "@/lib/i18n/locale-store";
import { traceBrandSymbol } from "@/lib/textures/brand-symbol";
import {
  balanceLines,
  ensureFonts,
  fillSpacedText,
  getSansFamily,
  getSerifFamily,
  keepDashWithNextWord,
} from "@/lib/textures/canvas-text";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const SAFE_TOP = 300;
const SAFE_BOTTOM = 1600;
const TEXT_WIDTH = 860;

type AnswerCardInput = {
  answer: string;
  question: string;
  bookTitle: string;
  golden: boolean;
};

type Fit = { size: number; lines: string[] };

function fitLines(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, maxSize: number, minSize: number, maxLines: number): Fit {
  const prepared = keepDashWithNextWord(text);
  let size = maxSize;
  let lines: string[] = [];
  do {
    ctx.font = font(size);
    lines = balanceLines(ctx, prepared, TEXT_WIDTH);
    size -= 4;
  } while (lines.length > maxLines && size >= minSize);
  return { size: size + 4, lines: lines.slice(0, maxLines) };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, golden: boolean) {
  const base = ctx.createRadialGradient(CARD_WIDTH / 2, CARD_HEIGHT * 0.48, 80, CARD_WIDTH / 2, CARD_HEIGHT * 0.48, CARD_HEIGHT * 0.78);
  if (golden) {
    base.addColorStop(0, "#5a3f16");
    base.addColorStop(0.45, "#2a1c0b");
    base.addColorStop(1, "#0d0905");
  } else {
    base.addColorStop(0, "#3a2412");
    base.addColorStop(0.45, "#1a1009");
    base.addColorStop(1, "#060505");
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  if (golden) {
    const foil = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    foil.addColorStop(0, "#f7e2a4");
    foil.addColorStop(0.35, "#b8862c");
    foil.addColorStop(0.65, "#f1d690");
    foil.addColorStop(1, "#9c6d22");
    ctx.strokeStyle = foil;
    ctx.fillStyle = foil;
    ctx.lineWidth = 10;
    ctx.strokeRect(44, 44, CARD_WIDTH - 88, CARD_HEIGHT - 88);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(70, 70, CARD_WIDTH - 140, CARD_HEIGHT - 140);
    for (const [x, y] of [[44, 44], [CARD_WIDTH - 44, 44], [44, CARD_HEIGHT - 44], [CARD_WIDTH - 44, CARD_HEIGHT - 44]]) {
      diamond(ctx, x, y, 44);
    }
    return;
  }
  ctx.strokeStyle = "rgba(201,162,75,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, CARD_WIDTH - 112, CARD_HEIGHT - 112);
  ctx.strokeStyle = "rgba(201,162,75,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(72, 72, CARD_WIDTH - 144, CARD_HEIGHT - 144);
}

function drawDivider(ctx: CanvasRenderingContext2D, y: number) {
  const line = ctx.createLinearGradient(CARD_WIDTH / 2 - 170, 0, CARD_WIDTH / 2 + 170, 0);
  line.addColorStop(0, "rgba(236,208,138,0)");
  line.addColorStop(0.5, "rgba(236,208,138,0.9)");
  line.addColorStop(1, "rgba(236,208,138,0)");
  ctx.fillStyle = line;
  ctx.fillRect(CARD_WIDTH / 2 - 170, y - 1, 340, 2);
  ctx.fillStyle = "#ecd08a";
  diamond(ctx, CARD_WIDTH / 2, y, 14);
}

function drawPill(ctx: CanvasRenderingContext2D, text: string, y: number, sans: string) {
  ctx.font = `600 34px ${sans}`;
  const width = ctx.measureText(text).width + 96;
  const height = 84;
  const x = (CARD_WIDTH - width) / 2;
  const fill = ctx.createLinearGradient(0, y, 0, y + height);
  fill.addColorStop(0, "#f0d696");
  fill.addColorStop(0.55, "#c9a24b");
  fill.addColorStop(1, "#946b28");
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#2a1806";
  ctx.fillText(text, CARD_WIDTH / 2, y + height / 2 + 2);
}

function drawGoldenBadge(ctx: CanvasRenderingContext2D, y: number, sans: string, label: string) {
  ctx.font = `600 30px ${sans}`;
  const spacing = 5;
  const width = ctx.measureText(label).width + spacing * ([...label].length - 1) + 80;
  const x = (CARD_WIDTH - width) / 2;
  roundRect(ctx, x, y - 30, width, 60, 30);
  ctx.fillStyle = "rgba(20,12,4,0.65)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ecd08a";
  ctx.stroke();
  ctx.fillStyle = "#f4dc9c";
  fillSpacedText(ctx, label, CARD_WIDTH / 2, y + 1, spacing);
}

export async function createAnswerCard({ answer, question, bookTitle, golden }: AnswerCardInput): Promise<Blob> {
  const family = getSerifFamily();
  const sans = getSansFamily();
  await ensureFonts(family, sans);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");
  const messages = getMessages();

  drawBackground(ctx, golden);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const gold = ctx.createLinearGradient(0, SAFE_TOP, 0, SAFE_TOP + 130);
  gold.addColorStop(0, "#f1d792");
  gold.addColorStop(1, "#a9812f");
  ctx.fillStyle = gold;
  ctx.strokeStyle = gold;
  traceBrandSymbol(ctx, CARD_WIDTH / 2, SAFE_TOP + 60, 120);

  ctx.fillStyle = "#ecd08a";
  ctx.font = `500 40px ${family}`;
  fillSpacedText(ctx, BRAND_NAME_UPPER, CARD_WIDTH / 2, SAFE_TOP + 170, 16);
  ctx.fillStyle = "rgba(239,227,200,0.8)";
  ctx.font = `italic 500 36px ${family}`;
  ctx.fillText(bookTitle, CARD_WIDTH / 2, SAFE_TOP + 222);
  let headerBottom = SAFE_TOP + 250;
  if (golden) {
    drawGoldenBadge(ctx, SAFE_TOP + 300, sans, messages.golden.cardBadge.toLocaleUpperCase(messages.locale));
    headerBottom = SAFE_TOP + 340;
  }

  const answerFit = fitLines(ctx, answer, (size) => `italic 500 ${size}px ${family}`, 124, 64, 4);
  const answerLineHeight = answerFit.size * 1.18;
  const answerHeight = answerFit.lines.length * answerLineHeight;
  const questionFit = question ? fitLines(ctx, `“${question}”`, (size) => `italic 500 ${size}px ${family}`, 58, 42, 3) : null;
  const questionLineHeight = questionFit ? questionFit.size * 1.25 : 0;
  const questionHeight = questionFit ? questionFit.lines.length * questionLineHeight + 100 : 0;
  const pillSpace = 170;

  const available = SAFE_BOTTOM - headerBottom;
  const blockHeight = questionHeight + answerHeight + pillSpace;
  const blockTop = headerBottom + Math.max(40, (available - blockHeight) / 2);

  if (questionFit) {
    ctx.fillStyle = "rgba(239,227,200,0.92)";
    ctx.font = `italic 500 ${questionFit.size}px ${family}`;
    questionFit.lines.forEach((line, index) => {
      ctx.fillText(line, CARD_WIDTH / 2, blockTop + questionLineHeight * (index + 0.5));
    });
    drawDivider(ctx, blockTop + questionFit.lines.length * questionLineHeight + 50);
  }

  const answerTop = blockTop + questionHeight;
  if (golden) {
    const shine = ctx.createLinearGradient(0, answerTop, 0, answerTop + answerHeight);
    shine.addColorStop(0, "#fff3cc");
    shine.addColorStop(0.5, "#f0c863");
    shine.addColorStop(1, "#c8922e");
    ctx.fillStyle = shine;
  } else {
    ctx.fillStyle = "#f4e2b4";
  }
  ctx.shadowColor = golden ? "rgba(255,210,120,0.55)" : "rgba(236,208,138,0.3)";
  ctx.shadowBlur = golden ? 36 : 22;
  ctx.font = `italic 500 ${answerFit.size}px ${family}`;
  answerFit.lines.forEach((line, index) => {
    ctx.fillText(line, CARD_WIDTH / 2, answerTop + answerLineHeight * (index + 0.5));
  });
  ctx.shadowBlur = 0;

  const site = siteUrl().replace(/^https?:\/\//, "");
  const cta = site ? `${messages.share.cardCta} · ${site}` : messages.share.cardCta;
  drawPill(ctx, cta, answerTop + answerHeight + 80, sans);

  ctx.fillStyle = "rgba(239,227,200,0.6)";
  ctx.font = `italic 500 32px ${family}`;
  ctx.fillText(messages.tagline, CARD_WIDTH / 2, SAFE_BOTTOM + 40);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Answer card could not be encoded"));
    }, "image/png");
  });
}
