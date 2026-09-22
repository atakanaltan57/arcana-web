"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-ink-deep px-6 text-center">
      <p className="font-serif text-3xl italic text-parchment">Kitap bu sefer açılmadı.</p>
      <p className="max-w-sm text-sm text-parchment-dim">
        Bir şeyler ters gitti. Tekrar denersen sayfalar yeniden hışırdayacak.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full border border-gold/40 px-6 py-2.5 text-sm tracking-widest text-gold transition-colors hover:bg-gold/10"
      >
        Tekrar dene
      </button>
    </main>
  );
}
