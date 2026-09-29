import { traceBrandGem } from "./brand-symbol";
import { seededRandom } from "./procedural";

export type GoldTool = {
  ctx: CanvasRenderingContext2D;
  gold: () => void;
  cut: () => void;
};

type Layout = {
  w: number;
  h: number;
  gemSize: number;
};

type Design = {
  border: (tool: GoldTool, x: number, y: number, inward: number, index: number) => void;
  borderStep: number;
  corner: (tool: GoldTool) => void;
  emblem: (tool: GoldTool, cx: number, cy: number, layout: Layout) => void;
};

function star(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, points: number, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation + (i * Math.PI) / points;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.35, cy + s * 0.05, cx - s * 0.95, cy - s * 1.0, cx, cy - s * 0.42);
  ctx.bezierCurveTo(cx + s * 0.95, cy - s * 1.0, cx + s * 1.35, cy + s * 0.05, cx, cy + s * 0.9);
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function ring(tool: GoldTool, x: number, y: number, outer: number, inner: number) {
  tool.gold();
  circle(tool.ctx, x, y, outer);
  tool.ctx.fill();
  tool.cut();
  circle(tool.ctx, x, y, inner);
  tool.ctx.fill();
  tool.gold();
}

function crescent(tool: GoldTool, x: number, y: number, r: number, offset: number, angle: number) {
  tool.gold();
  circle(tool.ctx, x, y, r);
  tool.ctx.fill();
  tool.cut();
  circle(tool.ctx, x + Math.cos(angle) * offset, y + Math.sin(angle) * offset, r * 0.92);
  tool.ctx.fill();
  tool.gold();
}

function setGem(tool: GoldTool, cx: number, cy: number, layout: Layout, clearance: number) {
  tool.cut();
  circle(tool.ctx, cx, cy, clearance);
  tool.ctx.fill();
  tool.gold();
  tool.ctx.lineWidth = 3;
  circle(tool.ctx, cx, cy, clearance - 8);
  tool.ctx.stroke();
  traceBrandGem(tool.ctx, cx, cy, layout.gemSize);
}

function withCorner(tool: GoldTool, draw: (ctx: CanvasRenderingContext2D) => void, w: number, h: number) {
  const { ctx } = tool;
  for (const [x, y, sx, sy] of [
    [66, 66, 1, 1],
    [w - 66, 66, -1, 1],
    [66, h - 66, 1, -1],
    [w - 66, h - 66, -1, -1],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    draw(ctx);
    ctx.restore();
  }
}

function cornerArc(tool: GoldTool, radius: number) {
  const { ctx } = tool;
  tool.gold();
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI / 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 14, 0, Math.PI / 2);
  ctx.stroke();
}

const love: Design = {
  borderStep: 30,
  border: ({ ctx }, x, y, inward, index) => {
    if (index % 2 === 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(inward - Math.PI / 2);
      heart(ctx, 0, 0, 6);
      ctx.fill();
      ctx.restore();
    } else {
      circle(ctx, x, y, 2.2);
      ctx.fill();
    }
  },
  corner: (tool) => {
    cornerArc(tool, 150);
    const { ctx } = tool;
    tool.gold();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.bezierCurveTo(90, 50, 110, 90, 128, 60);
    ctx.moveTo(40, 40);
    ctx.bezierCurveTo(50, 90, 90, 110, 60, 128);
    ctx.stroke();
    for (const [lx, ly, a] of [
      [96, 66, -0.5],
      [66, 96, 2.07],
      [120, 88, 0.3],
      [88, 120, 1.27],
    ]) {
      ctx.beginPath();
      ctx.ellipse(lx, ly, 13, 5.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    circle(ctx, 40, 40, 24);
    ctx.fill();
    tool.cut();
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const a = t * Math.PI * 5;
      const r = 20 * (1 - t);
      if (i === 0) ctx.moveTo(40 + Math.cos(a) * r, 40 + Math.sin(a) * r);
      else ctx.lineTo(40 + Math.cos(a) * r, 40 + Math.sin(a) * r);
    }
    ctx.stroke();
    tool.gold();
  },
  emblem: (tool, cx, cy, layout) => {
    const { ctx } = tool;
    const s = 290;
    const top = cy + 12;
    tool.gold();
    heart(ctx, cx, top, s);
    ctx.fill();
    tool.cut();
    heart(ctx, cx, top, s * 0.92);
    ctx.fill();
    tool.gold();
    heart(ctx, cx, top, s * 0.87);
    ctx.fill();
    tool.cut();
    heart(ctx, cx, top, s * 0.8);
    ctx.fill();
    tool.gold();
    ctx.lineWidth = 2;
    heart(ctx, cx, top, s * 0.74);
    ctx.stroke();
    ctx.lineWidth = 11;
    heart(ctx, cx - 62, cy + 6, 118);
    ctx.stroke();
    heart(ctx, cx + 62, cy + 6, 118);
    ctx.stroke();
    tool.cut();
    ctx.lineWidth = 3;
    heart(ctx, cx - 62, cy + 6, 118);
    ctx.stroke();
    heart(ctx, cx + 62, cy + 6, 118);
    ctx.stroke();
    tool.gold();
    setGem(tool, cx, cy, layout, 58);
    for (const direction of [-1, 1]) {
      const py = cy + direction * 330;
      heart(ctx, cx, py, 26);
      ctx.fill();
      circle(ctx, cx, py + direction * 44, 6);
      ctx.fill();
    }
  },
};

const path: Design = {
  borderStep: 18,
  border: ({ ctx }, x, y, inward, index) => {
    const nx = Math.cos(inward) * 5;
    const ny = Math.sin(inward) * 5;
    const sign = index % 2 === 0 ? 1 : -1;
    ctx.fillRect(x + nx * sign - 2, y + ny * sign - 2, 4, 4);
  },
  corner: (tool) => {
    const { ctx } = tool;
    tool.gold();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 150);
    ctx.lineTo(0, 0);
    ctx.lineTo(150, 0);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 132);
    ctx.lineTo(22, 22);
    ctx.lineTo(132, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(34, 34);
    ctx.lineTo(96, 96);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(108, 108);
    ctx.lineTo(86, 100);
    ctx.lineTo(100, 86);
    ctx.closePath();
    ctx.fill();
    star(ctx, 56, 56, 22, 5, 4, 0);
  },
  emblem: (tool, cx, cy, layout) => {
    const { ctx } = tool;
    ring(tool, cx, cy, 300, 286);
    ctx.lineWidth = 2.5;
    circle(ctx, cx, cy, 270);
    ctx.stroke();
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const inner = i % 8 === 0 ? 236 : i % 2 === 0 ? 250 : 258;
      ctx.lineWidth = i % 8 === 0 ? 5 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * 268, cy + Math.sin(a) * 268);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const tip = i % 2 === 0 ? 232 : 150;
      const side = i % 2 === 0 ? 46 : 34;
      const left = a - Math.PI / 4;
      const right = a + Math.PI / 4;
      const tx = cx + Math.cos(a) * tip;
      const ty = cy + Math.sin(a) * tip;
      tool.gold();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(left) * side, cy + Math.sin(left) * side);
      ctx.lineTo(tx, ty);
      ctx.lineTo(cx + Math.cos(right) * side, cy + Math.sin(right) * side);
      ctx.closePath();
      ctx.fill();
      tool.cut();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.lineTo(cx + Math.cos(right) * side * 0.72, cy + Math.sin(right) * side * 0.72);
      ctx.closePath();
      ctx.fill();
    }
    tool.gold();
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const tip = i % 2 === 0 ? 232 : 150;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * tip, cy + Math.sin(a) * tip);
    }
    ctx.stroke();
    setGem(tool, cx, cy, layout, 56);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 372);
    ctx.lineTo(cx + 26, cy - 322);
    ctx.lineTo(cx, cy - 334);
    ctx.lineTo(cx - 26, cy - 322);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      circle(ctx, cx, cy + 324 + i * 18, 5 - i);
      ctx.fill();
    }
  },
};

const fate: Design = {
  borderStep: 34,
  border: ({ ctx }, x, y, _inward, index) => {
    if (index % 2 === 0) star(ctx, x, y, 7, 3, 5);
    else {
      circle(ctx, x, y, 2);
      ctx.fill();
    }
  },
  corner: (tool) => {
    cornerArc(tool, 150);
    const { ctx } = tool;
    star(ctx, 52, 52, 40, 9, 8, 0);
    tool.cut();
    circle(ctx, 52, 52, 8);
    ctx.fill();
    tool.gold();
    for (let i = 0; i < 5; i++) {
      const a = ((i + 0.5) / 5) * (Math.PI / 2);
      star(ctx, Math.cos(a) * 118, Math.sin(a) * 118, 7, 3, 5);
    }
  },
  emblem: (tool, cx, cy, layout) => {
    const { ctx } = tool;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const length = i % 3 === 0 ? 48 : 24;
      const half = 0.03;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - half) * 304, cy + Math.sin(a - half) * 304);
      ctx.lineTo(cx + Math.cos(a) * (304 + length), cy + Math.sin(a) * (304 + length));
      ctx.lineTo(cx + Math.cos(a + half) * 304, cy + Math.sin(a + half) * 304);
      ctx.closePath();
      ctx.fill();
    }
    ring(tool, cx, cy, 300, 288);
    ring(tool, cx, cy, 276, 226);
    tool.cut();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      circle(ctx, cx + Math.cos(a) * 251, cy + Math.sin(a) * 251, 14);
      ctx.fill();
    }
    tool.gold();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      star(ctx, cx + Math.cos(a) * 251, cy + Math.sin(a) * 251, 8, 3, i % 2 === 0 ? 5 : 4);
      const b = a + Math.PI / 12;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(b) * 82, cy + Math.sin(b) * 82);
      ctx.lineTo(cx + Math.cos(b) * 226, cy + Math.sin(b) * 226);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    circle(ctx, cx, cy, 160);
    ctx.stroke();
    ring(tool, cx, cy, 82, 70);
    setGem(tool, cx, cy, layout, 62);
    star(ctx, cx, cy - 396, 30, 9, 8, 0);
    star(ctx, cx, cy + 396, 30, 9, 8, 0);
  },
};

const moon: Design = {
  borderStep: 22,
  border: (tool, x, y, inward, index) => {
    if (index % 6 === 3) crescent(tool, x, y, 7, 4, inward);
    else {
      circle(tool.ctx, x, y, 1.8);
      tool.ctx.fill();
    }
  },
  corner: (tool) => {
    cornerArc(tool, 150);
    crescent(tool, 60, 60, 38, 16, -Math.PI * 0.75);
    const { ctx } = tool;
    star(ctx, 116, 44, 9, 2.5, 4, 0);
    star(ctx, 44, 116, 9, 2.5, 4, 0);
    star(ctx, 104, 104, 6, 2, 4, 0);
  },
  emblem: (tool, cx, cy, layout) => {
    const { ctx } = tool;
    tool.gold();
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 12]);
    circle(ctx, cx, cy, 336);
    ctx.stroke();
    ctx.setLineDash([]);
    tool.gold();
    circle(ctx, cx - 36, cy, 262);
    ctx.fill();
    tool.cut();
    circle(ctx, cx + 44, cy - 8, 236);
    ctx.fill();
    tool.gold();
    ctx.lineWidth = 3;
    circle(ctx, cx + 44, cy - 8, 222);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = -1.05 + (i / 6) * 2.1;
      star(ctx, cx + 30 + Math.cos(a) * 150, cy + Math.sin(a) * 150, i % 2 === 0 ? 11 : 7, 2.6, 4, 0);
    }
    setGem(tool, cx, cy, layout, 56);
    const phases = [26, 14, 0, -14, -26];
    for (const row of [-1, 1]) {
      phases.forEach((offset, index) => {
        const x = cx + (index - 2) * 70;
        const y = cy + row * 392;
        tool.gold();
        circle(ctx, x, y, 20);
        ctx.fill();
        if (offset !== 0) {
          tool.cut();
          circle(ctx, x + offset, y, 19);
          ctx.fill();
          tool.gold();
          ctx.lineWidth = 1.5;
          circle(ctx, x, y, 20);
          ctx.stroke();
        }
      });
    }
  },
};

const shadow: Design = {
  borderStep: 24,
  border: ({ ctx }, x, y, inward) => {
    const tipX = x + Math.cos(inward) * 11;
    const tipY = y + Math.sin(inward) * 11;
    const px = Math.cos(inward + Math.PI / 2) * 4.5;
    const py = Math.sin(inward + Math.PI / 2) * 4.5;
    ctx.beginPath();
    ctx.moveTo(x + px - Math.cos(inward) * 4, y + py - Math.sin(inward) * 4);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(x - px - Math.cos(inward) * 4, y - py - Math.sin(inward) * 4);
    ctx.closePath();
    ctx.fill();
  },
  corner: (tool) => {
    const { ctx } = tool;
    tool.gold();
    ctx.lineWidth = 5;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(46, 34);
    ctx.lineTo(70, 88);
    ctx.lineTo(118, 112);
    ctx.lineTo(150, 162);
    ctx.stroke();
    for (const [x, y, a] of [
      [46, 34, -0.9],
      [70, 88, 2.4],
      [118, 112, -0.6],
      [30, 70, 2.1],
      [96, 58, -1.2],
    ]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(0, -26);
      ctx.lineTo(5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(34, 46);
    ctx.lineTo(88, 70);
    ctx.lineTo(112, 118);
    ctx.lineTo(162, 150);
    ctx.stroke();
  },
  emblem: (tool, cx, cy, layout) => {
    const { ctx } = tool;
    const rand = seededRandom(66);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2 + (rand() - 0.5) * 0.02;
      const length = i % 6 === 0 ? 150 : i % 2 === 0 ? 70 + rand() * 40 : 30 + rand() * 30;
      const half = i % 6 === 0 ? 0.035 : 0.018;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - half) * 212, cy + Math.sin(a - half) * 212);
      ctx.lineTo(cx + Math.cos(a) * (212 + length), cy + Math.sin(a) * (212 + length));
      ctx.lineTo(cx + Math.cos(a + half) * 212, cy + Math.sin(a + half) * 212);
      ctx.closePath();
      ctx.fill();
    }
    ring(tool, cx, cy, 216, 196);
    ctx.lineWidth = 2;
    circle(ctx, cx, cy, 176);
    ctx.stroke();
    ctx.setLineDash([3, 9]);
    circle(ctx, cx, cy, 150);
    ctx.stroke();
    ctx.setLineDash([]);
    setGem(tool, cx, cy, layout, 58);
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + direction * 402);
      ctx.lineTo(cx + 12, cy + direction * 372);
      ctx.lineTo(cx, cy + direction * 382);
      ctx.lineTo(cx - 12, cy + direction * 372);
      ctx.closePath();
      ctx.fill();
    }
  },
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function almond(ctx: CanvasRenderingContext2D, cx: number, cy: number, halfWidth: number, halfHeight: number) {
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, cy);
  ctx.quadraticCurveTo(cx, cy - halfHeight * 2, cx + halfWidth, cy);
  ctx.quadraticCurveTo(cx, cy + halfHeight * 2, cx - halfWidth, cy);
  ctx.closePath();
}

const mystery: Design = {
  borderStep: 28,
  border: ({ ctx }, x, y, _inward, index) => {
    if (index % 3 === 0) star(ctx, x, y, 7, 2.2, 4, 0);
    else {
      circle(ctx, x, y, 1.8);
      ctx.fill();
    }
  },
  corner: (tool) => {
    cornerArc(tool, 150);
    crescent(tool, 54, 54, 30, 12, Math.PI / 4);
    const { ctx } = tool;
    star(ctx, 112, 40, 11, 3, 4, 0);
    star(ctx, 40, 112, 11, 3, 4, 0);
  },
  emblem: (tool, cx, cy, layout) => {
    const { ctx } = tool;
    const cardW = 330;
    const cardH = 540;
    const left = cx - cardW / 2;
    const top = cy - cardH / 2;
    tool.gold();
    roundedRect(ctx, left, top, cardW, cardH, 26);
    ctx.fill();
    tool.cut();
    roundedRect(ctx, left + 12, top + 12, cardW - 24, cardH - 24, 18);
    ctx.fill();
    tool.gold();
    ctx.lineWidth = 2.5;
    roundedRect(ctx, left + 24, top + 24, cardW - 48, cardH - 48, 12);
    ctx.stroke();

    for (let i = 0; i < 13; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      const inner = 92;
      const outer = i % 2 === 0 ? 170 : 138;
      ctx.lineWidth = i % 2 === 0 ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy - 20 + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy - 20 + Math.sin(a) * outer);
      ctx.stroke();
    }

    tool.gold();
    almond(ctx, cx, cy, 120, 58);
    ctx.fill();
    tool.cut();
    almond(ctx, cx, cy, 106, 48);
    ctx.fill();
    tool.gold();
    ring(tool, cx, cy, 52, 44);
    setGem(tool, cx, cy, layout, 40);

    for (const direction of [-1, 1]) {
      crescent(tool, cx + direction * 250, cy, 44, 16, direction > 0 ? 0 : Math.PI);
      star(ctx, cx, cy + direction * 196, 24, 6, 4, 0);
      star(ctx, cx - 70, cy + direction * 206, 8, 2.5, 4, 0);
      star(ctx, cx + 70, cy + direction * 206, 8, 2.5, 4, 0);
      ctx.beginPath();
      ctx.moveTo(cx, cy + direction * 322);
      ctx.lineTo(cx + 14, cy + direction * 350);
      ctx.lineTo(cx, cy + direction * 366);
      ctx.lineTo(cx - 14, cy + direction * 350);
      ctx.closePath();
      ctx.fill();
    }
  },
};

const DESIGNS: Record<string, Design> = { ask: love, yol: path, kader: fate, gizem: mystery, ay: moon, golge: shadow };

export function hasThemedDesign(id: string) {
  return id in DESIGNS;
}

export function drawThemedTooling(tool: GoldTool, id: string, layout: Layout) {
  const design = DESIGNS[id];
  if (!design) return false;
  const { ctx } = tool;
  const { w, h } = layout;

  tool.gold();
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, w - 80, h - 80);
  ctx.lineWidth = 1.6;
  ctx.strokeRect(66, 66, w - 132, h - 132);

  let index = 0;
  for (let x = 90; x <= w - 90; x += design.borderStep) {
    design.border(tool, x, 53, Math.PI / 2, index++);
    tool.gold();
    design.border(tool, x, h - 53, -Math.PI / 2, index++);
    tool.gold();
  }
  for (let y = 90; y <= h - 90; y += design.borderStep) {
    design.border(tool, 53, y, 0, index++);
    tool.gold();
    design.border(tool, w - 53, y, Math.PI, index++);
    tool.gold();
  }

  withCorner(tool, () => design.corner(tool), w, h);
  tool.gold();
  design.emblem(tool, w / 2, h / 2, layout);
  ctx.globalCompositeOperation = "source-over";
  return true;
}
