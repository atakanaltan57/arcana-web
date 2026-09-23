import { BOOKS, DEFAULT_BOOK, findBook, type Book } from "@/lib/books";
import { localeStore } from "@/lib/i18n/locale-store";

const STORAGE_KEY = "arcana-book";

export type BookSnapshot = {
  book: Book;
  answers: string[] | null;
  error: boolean;
};

let snapshot: BookSnapshot = { book: DEFAULT_BOOK, answers: null, error: false };
const serverSnapshot: BookSnapshot = snapshot;
const listeners = new Set<() => void>();
const cache = new Map<string, string[]>();
let hydrated = false;

function emit(next: BookSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function load(book: Book) {
  const locale = localeStore.getSnapshot();
  const key = `${locale}:${book.id}`;
  const current = () => snapshot.book.id === book.id && localeStore.getSnapshot() === locale;
  const cached = cache.get(key);
  if (cached) {
    emit({ book, answers: cached, error: false });
    return;
  }
  emit({ book, answers: null, error: false });
  try {
    const answers = await book.loadAnswers(locale);
    cache.set(key, answers);
    if (current()) emit({ book, answers, error: false });
  } catch (error) {
    console.error(`Answers for "${book.id}" (${locale}) could not be loaded`, error);
    if (current()) emit({ book, answers: null, error: true });
  }
}

localeStore.subscribe(() => {
  if (hydrated) void load(snapshot.book);
});

function persist(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch (error) {
    console.error("Selected book could not be saved", error);
  }
}

function readStored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("Selected book could not be read", error);
    return null;
  }
}

export const bookStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  getServerSnapshot: () => serverSnapshot,
  hydrate() {
    if (hydrated) return;
    hydrated = true;
    void load(findBook(readStored()));
  },
  select(id: string) {
    if (id === snapshot.book.id && snapshot.answers) return;
    const book = findBook(id);
    persist(book.id);
    void load(book);
  },
  step(direction: 1 | -1) {
    const index = BOOKS.findIndex((book) => book.id === snapshot.book.id);
    const next = BOOKS[index + direction];
    if (next) bookStore.select(next.id);
  },
};
