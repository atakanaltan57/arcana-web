const fract = (value: number) => value - Math.floor(value);

function hash(x: number, y: number) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

export function valueNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

export function fbm(x: number, y: number) {
  let value = 0;
  let amplitude = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < 4; i++) {
    value += amplitude * valueNoise(px, py);
    px *= 2.03;
    py *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

export const BURN_ASPECT = 1.4;
export const BURN_REACH = 1.95;

export function burnKey(u: number, v: number, originU: number, originV: number) {
  const dx = u - originU;
  const dy = (v - originV) * BURN_ASPECT;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance * 0.75 + fbm(u * 6 + 3.1, v * 8.4 + 3.1) * 0.45;
}
