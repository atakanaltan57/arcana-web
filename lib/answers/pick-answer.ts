export type PickedAnswer = {
  text: string;
  index: number;
  page: number;
  bookId: string;
  bookTitle: string;
  question: string;
  golden: boolean;
  locale: string;
};

const HISTORY_PREFIX = "ck-recent-answers:";
const HISTORY_RATIO = 0.3;
export const GOLDEN_ODDS = 100;

function randomInt(max: number) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function readHistory(bookId: string): number[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_PREFIX + bookId);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : [];
  } catch (error) {
    console.error("Answer history could not be read", error);
    return [];
  }
}

function writeHistory(bookId: string, history: number[], size: number) {
  try {
    window.localStorage.setItem(HISTORY_PREFIX + bookId, JSON.stringify(history.slice(-size)));
  } catch (error) {
    console.error("Answer history could not be saved", error);
  }
}

type PickSource = {
  locale: string;
  bookId: string;
  bookTitle: string;
  answers: string[];
  question?: string;
};

export function pickAnswer({ locale, bookId, bookTitle, answers, question = "" }: PickSource): PickedAnswer {
  if (answers.length === 0) {
    throw new Error(`Book "${bookId}" has no answers`);
  }
  const historySize = Math.max(1, Math.floor(answers.length * HISTORY_RATIO));
  const historyKey = `${locale}:${bookId}`;
  const recent = new Set(readHistory(historyKey));
  const pool = answers.map((_, index) => index).filter((index) => !recent.has(index));
  const candidates = pool.length > 0 ? pool : answers.map((_, index) => index);
  const index = candidates[randomInt(candidates.length)];
  writeHistory(historyKey, [...recent, index], historySize);
  return {
    text: answers[index],
    index,
    page: 12 + randomInt(460),
    bookId,
    bookTitle,
    question,
    locale,
    golden: randomInt(GOLDEN_ODDS) === 0,
  };
}
