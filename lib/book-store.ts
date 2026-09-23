import { BOOKS, DEFAULT_BOOK, findBook, type Book } from "@/lib/books";

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
  const cached = cache.get(book.id);
  if (cached) {
    emit({ book, answers: cached, error: false });
    return;
  }
  emit({ book, answers: null, error: false });
  try {
    const answers = await book.loadAnswers();
    cache.set(book.id, answers);
    if (snapshot.book.id === book.id) emit({ book, answers, error: false });
  } catch (error) {
    console.error(`Answers for "${book.id}" could not be loaded`, error);
    if (snapshot.book.id === book.id) emit({ book, answers: null, error: true });
  }
}

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
