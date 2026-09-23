import {
  classicTheme,
  fateTheme,
  loveTheme,
  moonTheme,
  pathTheme,
  shadowTheme,
  type BookTheme,
} from "@/lib/themes";

export type Book = {
  id: string;
  title: string;
  subtitle: string;
  theme: BookTheme;
  premium: boolean;
  loadAnswers: () => Promise<string[]>;
};

export const BOOKS: Book[] = [
  {
    id: "genel",
    title: "Cevaplar Kitabı",
    subtitle: "Her soruya",
    theme: classicTheme,
    premium: false,
    loadAnswers: () => import("@/lib/answers/genel.json").then((module) => module.default),
  },
  {
    id: "ask",
    title: "Aşk Kitabı",
    subtitle: "Kalbin soruları",
    theme: loveTheme,
    premium: false,
    loadAnswers: () => import("@/lib/answers/ask.json").then((module) => module.default),
  },
  {
    id: "yol",
    title: "Yol Kitabı",
    subtitle: "İş ve kararlar",
    theme: pathTheme,
    premium: false,
    loadAnswers: () => import("@/lib/answers/yol.json").then((module) => module.default),
  },
  {
    id: "kader",
    title: "Kader Kitabı",
    subtitle: "Yazgı ve işaretler",
    theme: fateTheme,
    premium: false,
    loadAnswers: () => import("@/lib/answers/kader.json").then((module) => module.default),
  },
  {
    id: "ay",
    title: "Ay Kitabı",
    subtitle: "Gecenin bilgeliği",
    theme: moonTheme,
    premium: true,
    loadAnswers: () => import("@/lib/answers/ay.json").then((module) => module.default),
  },
  {
    id: "golge",
    title: "Gölge Kitabı",
    subtitle: "İçindeki karanlık",
    theme: shadowTheme,
    premium: true,
    loadAnswers: () => import("@/lib/answers/golge.json").then((module) => module.default),
  },
];

export const DEFAULT_BOOK = BOOKS[0];

export function findBook(id: string | null | undefined) {
  return BOOKS.find((book) => book.id === id) ?? DEFAULT_BOOK;
}
