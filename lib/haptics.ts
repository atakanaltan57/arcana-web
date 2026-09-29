import { isNativeApp, notifyNative } from "@/lib/native-bridge";

export function vibrate(pattern: number | number[]) {
  const steps = Array.isArray(pattern) ? pattern : [pattern];
  if (isNativeApp()) {
    notifyNative("haptic", { pattern: steps });
    return;
  }
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(steps);
  } catch (error) {
    console.error("Vibration failed", error);
  }
}
