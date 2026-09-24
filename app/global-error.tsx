"use client";

import { useEffect } from "react";
import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink-deep px-6 text-center font-[Georgia,serif] text-parchment">
          <p className="text-3xl">Kitap bu sefer açılmadı.</p>
          <p className="text-base text-parchment/80">The book did not open this time.</p>
          <button type="button" onClick={reset} className="btn-gold focus-ring">
            Yeniden dene · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
