import { seededRandom } from "@/lib/textures/procedural";
import { CIPHER_CRIB, CIPHER_HEADER, CIPHER_TEXT } from "@/lib/cipher-data";

export const CIPHER_ALPHABET = "abcçdefgğhıijklmnoöprsştuüvyz";
export type CipherToken = { kind: "glyph"; index: number } | { kind: "space" } | { kind: "stop" } | { kind: "pause" };

function decodeTokens(encoded: string): CipherToken[] {
  return [...encoded].map((char) => {
    if (char === " ") return { kind: "space" };
    if (char === ".") return { kind: "stop" };
    if (char === ",") return { kind: "pause" };
    return { kind: "glyph", index: char.charCodeAt(0) - 65 };
  });
}

export const CIPHER_CORPUS = decodeTokens(CIPHER_TEXT);
export const CIPHER_HEADER_TOKENS = decodeTokens(CIPHER_HEADER);
export const CIPHER_CRIB_TOKENS = decodeTokens(CIPHER_CRIB);

const PRIMITIVES: Record<string, string> = {
  stemL: "M 15 25 L 15 120",
  stemM: "M 35 20 L 35 125",
  stemR: "M 55 25 L 55 120",
  barT: "M 8 40 L 62 40",
  barM: "M 12 72 L 58 72",
  barB: "M 8 105 L 62 105",
  diagUp: "M 10 120 L 60 28",
  diagDown: "M 10 28 L 60 120",
  bowlR: "M 18 32 Q 78 55 18 84",
  bowlL: "M 52 32 Q -8 55 52 84",
  cup: "M 12 70 Q 35 135 58 70",
  arch: "M 12 78 Q 35 8 58 78",
  hook: "M 38 22 L 38 98 Q 38 126 12 118",
  tail: "M 30 96 Q 48 132 66 112",
  loop: "M 47 42 A 12 12 0 1 0 23 42 A 12 12 0 1 0 47 42",
  chevron: "M 8 62 L 35 34 L 62 62",
  vee: "M 8 40 L 35 90 L 62 40",
  dot: "M 38 8 A 3 3 0 1 0 32 8 A 3 3 0 1 0 38 8",
};

const MAIN = ["stemL", "stemM", "stemR", "diagUp", "diagDown", "bowlR", "bowlL", "cup", "arch", "hook", "vee"];
const ACCENT = ["barT", "barM", "barB", "tail", "loop", "chevron", "dot", "bowlR", "bowlL", "stemM"];

function buildGlyphs() {
  const rand = seededRandom(1453);
  const seen = new Set<string>();
  const glyphs: string[] = [];
  while (glyphs.length < CIPHER_ALPHABET.length) {
    const main = MAIN[Math.floor(rand() * MAIN.length)];
    const parts = new Set([main]);
    const extra = rand() < 0.45 ? 2 : 1;
    while (parts.size < 1 + extra) {
      parts.add(ACCENT[Math.floor(rand() * ACCENT.length)]);
    }
    const signature = [...parts].sort().join("+");
    if (seen.has(signature)) continue;
    seen.add(signature);
    glyphs.push([...parts].map((part) => PRIMITIVES[part]).join(" "));
  }
  return glyphs;
}

export const CIPHER_GLYPHS = buildGlyphs();

export const GLYPH_BOX = { width: 70, height: 140 };

export function toRoman(value: number) {
  const table: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Math.max(1, Math.floor(value));
  let result = "";
  for (const [amount, symbol] of table) {
    while (rest >= amount) {
      result += symbol;
      rest -= amount;
    }
  }
  return result;
}
