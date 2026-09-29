import {
  classicTheme,
  fateTheme,
  loveTheme,
  moonTheme,
  mysteryTheme,
  pathTheme,
  shadowTheme,
  type BookTheme,
} from "@/lib/themes";
import type { Locale } from "@/lib/i18n/locale-store";

type AnswerModule = { default: string[] };
type AnswerLoaders = Record<Locale, () => Promise<AnswerModule>>;

export type Book = {
  id: string;
  theme: BookTheme;
  premium: boolean;
  loadAnswers: (locale: Locale) => Promise<string[]>;
};

function book(id: string, theme: BookTheme, premium: boolean, loaders: AnswerLoaders): Book {
  return {
    id,
    theme,
    premium,
    loadAnswers: (locale) => loaders[locale]().then((module) => module.default),
  };
}

export const BOOKS: Book[] = [
  book("genel", classicTheme, false, {
    tr: () => import("@/lib/answers/genel.json"),
    en: () => import("@/lib/answers/en/genel.json"),
  }),
  book("ask", loveTheme, false, {
    tr: () => import("@/lib/answers/ask.json"),
    en: () => import("@/lib/answers/en/ask.json"),
  }),
  book("yol", pathTheme, false, {
    tr: () => import("@/lib/answers/yol.json"),
    en: () => import("@/lib/answers/en/yol.json"),
  }),
  book("kader", fateTheme, false, {
    tr: () => import("@/lib/answers/kader.json"),
    en: () => import("@/lib/answers/en/kader.json"),
  }),
  book("gizem", mysteryTheme, false, {
    tr: () => import("@/lib/answers/gizem.json"),
    en: () => import("@/lib/answers/en/gizem.json"),
  }),
  book("ay", moonTheme, true, {
    tr: () => import("@/lib/answers/ay.json"),
    en: () => import("@/lib/answers/en/ay.json"),
  }),
  book("golge", shadowTheme, true, {
    tr: () => import("@/lib/answers/golge.json"),
    en: () => import("@/lib/answers/en/golge.json"),
  }),
];

export const DEFAULT_BOOK = BOOKS[0];

export function findBook(id: string | null | undefined) {
  return BOOKS.find((item) => item.id === id) ?? DEFAULT_BOOK;
}
