import { CIPHER_ALPHABET } from "@/lib/cipher";
import { SEAL_HASHES } from "@/lib/cipher-data";

const STORAGE_KEY = "arcana-broken-seals";

export const SEAL_COUNT = SEAL_HASHES.length;

export function normalizeSealText(text: string) {
  return [...text.toLocaleLowerCase("tr-TR")]
    .filter((char) => CIPHER_ALPHABET.includes(char) || /\s/.test(char))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function findSeal(text: string) {
  const normalized = normalizeSealText(text);
  if (normalized.length < 8) return null;
  const hash = await sha256Hex(normalized);
  const index = SEAL_HASHES.indexOf(hash);
  return index >= 0 ? index : null;
}

export function readBrokenSeals(): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is number => Number.isInteger(value) && value >= 0 && value < SEAL_COUNT)
      : [];
  } catch (error) {
    console.error("Broken seals could not be read", error);
    return [];
  }
}

export function saveBrokenSeal(index: number) {
  const next = [...new Set([...readBrokenSeals(), index])].sort((a, b) => a - b);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Broken seal could not be saved", error);
  }
  return next;
}
