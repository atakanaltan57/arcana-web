"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BOOKS, type Book } from "@/lib/books";
import { canOpen } from "@/lib/entitlements";
import { useMessages } from "@/lib/i18n/locale-store";

type BookShelfProps = {
  book: Book;
  onSelect: (book: Book) => void;
  onStep: (direction: 1 | -1) => void;
};

const stopPointer = (event: React.PointerEvent) => event.stopPropagation();

function Arrow({ direction, onStep }: { direction: 1 | -1; onStep: (direction: 1 | -1) => void }) {
  const messages = useMessages();
  return (
    <button
      type="button"
      onPointerDown={stopPointer}
      onClick={() => onStep(direction)}
      aria-label={direction === 1 ? messages.shelf.next : messages.shelf.previous}
      className={`focus-ring pointer-events-auto absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-parchment/15 bg-black/30 text-parchment/85 backdrop-blur-sm transition-colors hover:border-gold/50 hover:text-gold-bright ${
        direction === 1 ? "right-3 sm:right-6" : "left-3 sm:left-6"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={direction === 1 ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
      </svg>
    </button>
  );
}

export function BookShelf({ book, onSelect, onStep }: BookShelfProps) {
  const locked = !canOpen(book);
  const messages = useMessages();
  const text = messages.books[book.id];
  const index = BOOKS.findIndex((item) => item.id === book.id);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),1.25rem)+2.6rem)] z-10 flex flex-col items-center gap-0.5 px-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${messages.locale}-${book.id}`}
            initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex flex-col items-center gap-1"
          >
            <h2 className="flex items-center gap-2 font-serif text-2xl text-gold-bright [text-shadow:0_2px_14px_rgba(0,0,0,0.85)] sm:text-3xl">
              {text.title}
              {locked && (
                <svg viewBox="0 0 24 24" className="size-4 text-gold" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-label={messages.shelf.locked}>
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              )}
            </h2>
            <p className="text-micro uppercase text-parchment/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">{text.subtitle}</p>
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-auto flex items-center" role="tablist" aria-label={messages.shelf.books} onPointerDown={stopPointer}>
          {BOOKS.map((item) => {
            const selected = item.id === book.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`${messages.books[item.id].title}${canOpen(item) ? "" : messages.shelf.lockedSuffix}`}
                onClick={() => onSelect(item)}
                className="focus-ring grid h-11 w-7 place-items-center rounded-full"
              >
                <span
                  className={`block rotate-45 rounded-[1px] transition-all duration-300 ${
                    selected ? "size-2.5 shadow-[0_0_8px_rgba(236,208,138,0.9)]" : "size-1.5 opacity-60"
                  }`}
                  style={{ background: canOpen(item) ? item.theme.goldLight : "transparent", boxShadow: canOpen(item) ? undefined : `inset 0 0 0 1.5px ${item.theme.goldLight}` }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {index > 0 && <Arrow direction={-1} onStep={onStep} />}
      {index < BOOKS.length - 1 && <Arrow direction={1} onStep={onStep} />}
    </>
  );
}
