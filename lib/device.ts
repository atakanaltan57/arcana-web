type NavigatorWithMemory = Navigator & { deviceMemory?: number };

export function isCompactDevice() {
  if (typeof window === "undefined") return false;
  const shortest = Math.min(window.screen?.width ?? window.innerWidth, window.screen?.height ?? window.innerHeight);
  return shortest <= 900 || window.matchMedia?.("(pointer: coarse)").matches === true;
}

export function initialPixelRatio() {
  if (typeof window === "undefined") return 1.5;
  const cap = isLowEndDevice() ? 1.5 : 2;
  return Math.min(cap, Math.max(1, window.devicePixelRatio || 1));
}

export function isLowEndDevice() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithMemory;
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  return memory <= 4 || cores <= 4;
}
