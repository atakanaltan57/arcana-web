import type { Book } from "@/lib/books";

export function hasPremium() {
  return false;
}

export function canOpen(book: Book) {
  return !book.premium || hasPremium();
}
