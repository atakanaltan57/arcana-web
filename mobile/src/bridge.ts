import { Share } from "react-native";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

type ShareFilePayload = { base64: string; mimeType: string; fileName: string; text: string };
type ShareTextPayload = { text: string; url: string };
type SaveFilePayload = { base64: string; mimeType: string; fileName: string };

export type BridgeMessage =
  | { id: string; type: "share-file"; payload: ShareFilePayload }
  | { id: string; type: "share-text"; payload: ShareTextPayload }
  | { id: string; type: "save-file"; payload: SaveFilePayload }
  | { type: "haptic"; payload: { pattern: number[] } };

const UTI_BY_MIME: Record<string, string> = {
  "image/png": "public.png",
  "image/jpeg": "public.jpeg",
  "video/mp4": "public.mpeg-4",
  "video/webm": "public.movie",
};

function safeFileName(name: string) {
  const cleaned = name.replace(/[^\w.-]/g, "_");
  return `${Date.now()}-${cleaned || "arcana"}`;
}

function writeTemp(base64: string, fileName: string) {
  const file = new File(Paths.cache, safeFileName(fileName));
  file.create();
  file.write(base64, { encoding: "base64" });
  return file;
}

function removeQuietly(file: File) {
  try {
    if (file.exists) file.delete();
  } catch (error) {
    console.error("Temporary file could not be removed", error);
  }
}

async function shareFile({ base64, mimeType, fileName }: ShareFilePayload) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device");
  const file = writeTemp(base64, fileName);
  try {
    await Sharing.shareAsync(file.uri, { mimeType, UTI: UTI_BY_MIME[mimeType], dialogTitle: "Arcana" });
    return "shared";
  } finally {
    removeQuietly(file);
  }
}

async function shareText({ text, url }: ShareTextPayload) {
  const message = url ? `${text}\n${url}` : text;
  const result = await Share.share({ message });
  return result.action === Share.dismissedAction ? "cancelled" : "shared";
}

async function loadMediaLibrary() {
  try {
    return await import("expo-media-library");
  } catch (error) {
    throw new Error(`Saving to the photo library is not available in this build: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function saveFile({ base64, fileName }: SaveFilePayload) {
  const { Asset, requestPermissionsAsync } = await loadMediaLibrary();
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) return "denied";
  const file = writeTemp(base64, fileName);
  try {
    await Asset.create(file.uri);
    return "saved";
  } finally {
    removeQuietly(file);
  }
}

function hapticStyle(duration: number) {
  if (duration < 15) return Haptics.ImpactFeedbackStyle.Light;
  if (duration < 40) return Haptics.ImpactFeedbackStyle.Medium;
  return Haptics.ImpactFeedbackStyle.Heavy;
}

export function playHaptics(pattern: number[]) {
  let offset = 0;
  pattern.forEach((duration, index) => {
    if (index % 2 === 0 && duration > 0) {
      const style = hapticStyle(duration);
      setTimeout(() => {
        Haptics.impactAsync(style).catch((error: unknown) => console.error("Haptic feedback failed", error));
      }, offset);
    }
    offset += Math.max(0, duration);
  });
}

export async function handleRequest(message: Exclude<BridgeMessage, { type: "haptic" }>) {
  switch (message.type) {
    case "share-file":
      return shareFile(message.payload);
    case "share-text":
      return shareText(message.payload);
    case "save-file":
      return saveFile(message.payload);
  }
}

export function parseMessage(raw: string): BridgeMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { type, id, payload } = value as { type?: unknown; id?: unknown; payload?: unknown };
    if (typeof payload !== "object" || payload === null) return null;
    if (type === "haptic") return Array.isArray((payload as { pattern?: unknown }).pattern) ? (value as BridgeMessage) : null;
    if (typeof id !== "string") return null;
    if (type === "share-file" || type === "share-text" || type === "save-file") return value as BridgeMessage;
    return null;
  } catch (error) {
    console.error("Bridge message could not be parsed", error);
    return null;
  }
}

export function replyScript(id: string, ok: boolean, value: unknown) {
  return `window.__arcanaNative && window.__arcanaNative.settle(${JSON.stringify(id)}, ${ok}, ${JSON.stringify(value ?? null)}); true;`;
}
