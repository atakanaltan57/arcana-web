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
      <p className="max-w-sm text-base text-parchment/80">
        Bir şeyler ters gitti. Tekrar denersen sayfalar yeniden hışırdayacak.
      </p>
      <button
        type="button"
        onClick={reset}
        className="btn-ghost focus-ring"
      >
        Tekrar dene
      </button>
    </main>
  );
}
