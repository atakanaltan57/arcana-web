export type NativeShareResult = "shared" | "cancelled";
export type NativeSaveResult = "saved" | "denied";

type NativeRequests = {
  "share-file": { payload: { base64: string; mimeType: string; fileName: string; text: string }; result: NativeShareResult };
  "share-text": { payload: { text: string; url: string }; result: NativeShareResult };
  "save-file": { payload: { base64: string; mimeType: string; fileName: string }; result: NativeSaveResult };
};

type NativeEvents = {
  haptic: { pattern: number[] };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
};

type NativeReceiver = {
  settle: (id: string, ok: boolean, value: unknown) => void;
};

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    __arcanaNative?: NativeReceiver;
  }
}

const REQUEST_TIMEOUT_MS = 120_000;
const pending = new Map<string, Pending>();
let counter = 0;

export function isNativeApp() {
  return typeof window !== "undefined" && typeof window.ReactNativeWebView?.postMessage === "function";
}

function ensureReceiver() {
  if (window.__arcanaNative) return;
  window.__arcanaNative = {
    settle(id, ok, value) {
      const entry = pending.get(id);
      if (!entry) {
        console.error(`Native reply for unknown request ${id}`);
        return;
      }
      pending.delete(id);
      window.clearTimeout(entry.timer);
      if (ok) entry.resolve(value);
      else entry.reject(new Error(typeof value === "string" ? value : "Native request failed"));
    },
  };
}

function post(message: object) {
  const bridge = window.ReactNativeWebView;
  if (!bridge) throw new Error("Native bridge is not available");
  bridge.postMessage(JSON.stringify(message));
}

export function callNative<K extends keyof NativeRequests>(type: K, payload: NativeRequests[K]["payload"]): Promise<NativeRequests[K]["result"]> {
  ensureReceiver();
  const id = `${Date.now().toString(36)}-${(counter++).toString(36)}`;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Native request "${type}" timed out`));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
    try {
      post({ id, type, payload });
    } catch (error) {
      pending.delete(id);
      window.clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function notifyNative<K extends keyof NativeEvents>(type: K, payload: NativeEvents[K]) {
  try {
    post({ type, payload });
  } catch (error) {
    console.error(`Native event "${type}" could not be sent`, error);
  }
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      if (comma < 0) reject(new Error("Blob could not be encoded"));
      else resolve(result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Blob could not be read"));
    reader.readAsDataURL(blob);
  });
}
