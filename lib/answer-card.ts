import { BRAND_NAME_UPPER, siteUrl } from "@/lib/brand";
import { getMessages } from "@/lib/i18n/locale-store";
import { traceBrandSymbol } from "@/lib/textures/brand-symbol";
import { ensureFonts, getSerifFamily, wrapText } from "@/lib/textures/page-textures";
import { fillSpacedText } from "@/lib/textures/procedural";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

type AnswerCardInput = {
  answer: string;
  question: string;
  bookTitle: string;
  golden: boolean;
};

function fitLines(ctx: CanvasRenderingContext2D, text: string, family: string, style: string, maxSize: number, minSize: number, maxWidth: number, maxLines: number) {
  let size = maxSize;
  let lines: string[] = [];
  do {
    ctx.font = `${style} ${size}px ${family}`;
    lines = wrapText(ctx, text, maxWidth);
    size -= 4;
  } while (lines.length > maxLines && size >= minSize);
  return { size: size + 4, lines: lines.slice(0, maxLines) };
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const base = ctx.createRadialGradient(CARD_WIDTH / 2, CARD_HEIGHT * 0.45, 80, CARD_WIDTH / 2, CARD_HEIGHT * 0.45, CARD_HEIGHT * 0.75);
  base.addColorStop(0, "#3a2412");
  base.addColorStop(0.45, "#1a1009");
  base.addColorStop(1, "#060505");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.strokeStyle = "rgba(201,162,75,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, CARD_WIDTH - 112, CARD_HEIGHT - 112);
  ctx.strokeStyle = "rgba(201,162,75,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(72, 72, CARD_WIDTH - 144, CARD_HEIGHT - 144);
}

function drawDivider(ctx: CanvasRenderingContext2D, y: number) {
  const line = ctx.createLinearGradient(CARD_WIDTH / 2 - 160, 0, CARD_WIDTH / 2 + 160, 0);
  line.addColorStop(0, "rgba(236,208,138,0)");
  line.addColorStop(0.5, "rgba(236,208,138,0.9)");
  line.addColorStop(1, "rgba(236,208,138,0)");
  ctx.fillStyle = line;
  ctx.fillRect(CARD_WIDTH / 2 - 160, y - 1, 320, 2);
  ctx.save();
  ctx.translate(CARD_WIDTH / 2, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#ecd08a";
  ctx.fillRect(-7, -7, 14, 14);
  ctx.restore();
}

export async function createAnswerCard({ answer, question, bookTitle, golden }: AnswerCardInput): Promise<Blob> {
  const family = getSerifFamily();
  await ensureFonts(family);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available");

  drawBackground(ctx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const gold = ctx.createLinearGradient(0, 180, 0, 360);
  gold.addColorStop(0, "#f1d792");
  gold.addColorStop(1, "#a9812f");
  ctx.fillStyle = gold;
  ctx.strokeStyle = gold;
  traceBrandSymbol(ctx, CARD_WIDTH / 2, 270, 150);

  ctx.font = `500 44px ${family}`;
  fillSpacedText(ctx, BRAND_NAME_UPPER, CARD_WIDTH / 2, 410, 18);
  ctx.fillStyle = "rgba(239,227,200,0.8)";
  ctx.font = `italic 500 38px ${family}`;
  ctx.fillText(bookTitle, CARD_WIDTH / 2, 470);
  if (golden) {
    ctx.fillStyle = "#ecd08a";
    ctx.font = `600 34px ${family}`;
    fillSpacedText(ctx, getMessages().golden.cardBadge.toLocaleUpperCase(getMessages().locale), CARD_WIDTH / 2, 540, 8);
  }

  const answerFit = fitLines(ctx, answer, family, "italic 500", 128, 64, 880, 5);
  const answerLineHeight = answerFit.size * 1.2;
  const answerHeight = answerFit.lines.length * answerLineHeight;

  let questionFit: { size: number; lines: string[] } | null = null;
  if (question) questionFit = fitLines(ctx, `“${question}”`, family, "italic 500", 64, 44, 880, 3);
  const questionLineHeight = questionFit ? questionFit.size * 1.25 : 0;
  const questionHeight = questionFit ? questionFit.lines.length * questionLineHeight + 110 : 0;

  const blockTop = CARD_HEIGHT * 0.53 - (answerHeight + questionHeight) / 2;

  if (questionFit) {
    ctx.fillStyle = "rgba(239,227,200,0.92)";
    ctx.font = `italic 500 ${questionFit.size}px ${family}`;
    questionFit.lines.forEach((line, index) => {
      ctx.fillText(line, CARD_WIDTH / 2, blockTop + questionLineHeight * (index + 0.5));
    });
    drawDivider(ctx, blockTop + questionFit.lines.length * questionLineHeight + 55);
  }

  const answerTop = blockTop + questionHeight;
  if (golden) {
    const shine = ctx.createLinearGradient(0, answerTop, 0, answerTop + answerHeight);
    shine.addColorStop(0, "#fff0c2");
    shine.addColorStop(0.5, "#e8c060");
    shine.addColorStop(1, "#b8862c");
    ctx.fillStyle = shine;
  } else {
    ctx.fillStyle = "#f4e2b4";
  }
  ctx.shadowColor = golden ? "rgba(255,210,120,0.6)" : "rgba(236,208,138,0.35)";
  ctx.shadowBlur = golden ? 40 : 24;
  ctx.font = `italic 500 ${answerFit.size}px ${family}`;
  answerFit.lines.forEach((line, index) => {
    ctx.fillText(line, CARD_WIDTH / 2, answerTop + answerLineHeight * (index + 0.5));
  });
  ctx.shadowBlur = 0;

  const messages = getMessages();
  ctx.fillStyle = "rgba(239,227,200,0.85)";
  ctx.font = `italic 500 48px ${family}`;
  ctx.fillText(messages.share.cardCta, CARD_WIDTH / 2, CARD_HEIGHT - 260);
  const site = siteUrl().replace(/^https?:\/\//, "");
  if (site) {
    ctx.fillStyle = "#c9a24b";
    ctx.font = `600 36px ${family}`;
    fillSpacedText(ctx, site, CARD_WIDTH / 2, CARD_HEIGHT - 190, 4);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Answer card could not be encoded"));
    }, "image/png");
  });
}
