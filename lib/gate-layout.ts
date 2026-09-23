export const GATE = {
  openingHalf: 2.15,
  springY: 4.6,
  archOuter: 3.15,
  keystoneOuter: 3.4,
  depth: 1,
  blocks: 11,
  gap: 0.014,
} as const;

export const DOOR_HEIGHT = GATE.springY + GATE.openingHalf;

export function blockAngles(index: number) {
  const span = Math.PI / GATE.blocks;
  const start = Math.PI - index * span;
  return { start: start - GATE.gap, end: start - span + GATE.gap, mid: start - span / 2 };
}

export function sealPlacement(sealIndex: number) {
  const { mid } = blockAngles(sealIndex + 1);
  const radius = (GATE.openingHalf + GATE.archOuter) / 2;
  return {
    angle: mid,
    position: [Math.cos(mid) * radius, GATE.springY + Math.sin(mid) * radius, GATE.depth / 2 + 0.035] as [number, number, number],
    numeral: [
      Math.cos(mid) * (GATE.openingHalf + 0.17),
      GATE.springY + Math.sin(mid) * (GATE.openingHalf + 0.17),
      GATE.depth / 2 + 0.012,
    ] as [number, number, number],
  };
}
