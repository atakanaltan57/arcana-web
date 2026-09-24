import { BOOKS } from "@/lib/books";
import { en } from "@/lib/i18n/messages/en";
import { tr, type Messages } from "@/lib/i18n/messages/tr";
import type { Locale } from "@/lib/i18n/locale-store";

export const SHARED_QUESTION_MAX = 90;

const MESSAGES: Record<Locale, Messages> = { tr, en };

export type SharedAnswer = {
  locale: Locale;
  bookId: string;
  index: number;
  text: string;
  question: string;
  bookTitle: string;
  messages: Messages;
};

type AnswerLinkInput = {
  locale: string;
  bookId: string;
  index: number;
  question?: string;
};

function isLocale(value: string): value is Locale {
  return value === "tr" || value === "en";
}

const BLOCKED_WORDS = new Set([
  "amk", "aq", "amq", "sik", "sikik", "sikim", "göt", "götveren", "piç", "ibne", "gavat", "kahpe", "şerefsiz", "yavşak", "oç",
  "fuck", "fucking", "shit", "bitch", "cunt", "whore", "slut", "faggot", "nigger", "nigga", "retard",
]);
const BLOCKED_STEMS = ["orospu", "siktir", "sikey", "amına", "amcık", "yarrak", "pezevenk", "fucker", "motherfuck"];

function isOffensive(text: string) {
  const tokens = text.toLocaleLowerCase("tr-TR").split(/[^\p{L}]+/u).filter(Boolean);
  return tokens.some((token) => BLOCKED_WORDS.has(token) || BLOCKED_STEMS.some((stem) => token.startsWith(stem)));
}

export function cleanQuestion(value: string | null | undefined) {
  const question = (value ?? "").replace(/\s+/g, " ").trim().slice(0, SHARED_QUESTION_MAX);
  return isOffensive(question) ? "" : question;
}

export function answerPath({ locale, bookId, index, question }: AnswerLinkInput) {
  const path = `/a/${encodeURIComponent(locale)}/${encodeURIComponent(bookId)}/${index}`;
  const q = cleanQuestion(question);
  return q ? `${path}?q=${encodeURIComponent(q)}` : path;
}

export async function resolveSharedAnswer(locale: string, bookId: string, rawIndex: string, rawQuestion?: string | null): Promise<SharedAnswer | null> {
  if (!isLocale(locale) || !/^\d{1,4}$/.test(rawIndex)) return null;
  const book = BOOKS.find((item) => item.id === bookId);
  if (!book) return null;
  const index = Number(rawIndex);
  let answers: string[];
  try {
    answers = await book.loadAnswers(locale);
  } catch (error) {
    console.error(`Answers for "${bookId}" could not be loaded`, error);
    return null;
  }
  const text = answers[index];
  if (!text) return null;
  const messages = MESSAGES[locale];
  return {
    locale,
    bookId,
    index,
    text,
    question: cleanQuestion(rawQuestion),
    bookTitle: messages.books[bookId].title,
    messages,
  };
}
