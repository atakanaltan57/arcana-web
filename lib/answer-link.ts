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

export function cleanQuestion(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, SHARED_QUESTION_MAX);
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
