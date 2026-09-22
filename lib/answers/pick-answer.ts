import answers from "./genel.json";

export type PickedAnswer = {
  text: string;
  index: number;
  page: number;
};

const HISTORY_KEY = "ck-recent-answers";
const HISTORY_SIZE = 20;

function randomInt(max: number) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function readHistory(): number[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : [];
  } catch (error) {
    console.error("Answer history could not be read", error);
    return [];
  }
}

function writeHistory(history: number[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_SIZE)));
  } catch (error) {
    console.error("Answer history could not be saved", error);
  }
}

export function pickAnswer(): PickedAnswer {
  const list = answers as string[];
  const recent = new Set(readHistory());
  const pool = list.map((_, index) => index).filter((index) => !recent.has(index));
  const candidates = pool.length > 0 ? pool : list.map((_, index) => index);
  const index = candidates[randomInt(candidates.length)];
  writeHistory([...recent, index]);
  return {
    text: list[index],
    index,
    page: 12 + randomInt(460),
  };
}
