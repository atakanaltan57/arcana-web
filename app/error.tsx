"use client";

import { useEffect } from "react";
import { useMessages } from "@/lib/i18n/locale-store";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const messages = useMessages();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-ink-deep px-6 text-center">
      <p className="font-serif text-3xl italic text-parchment">{messages.errorPage.title}</p>
      <p className="max-w-sm text-base text-parchment/80">
        {messages.errorPage.body}
      </p>
      <button
        type="button"
        onClick={reset}
        className="btn-ghost focus-ring"
      >
        {messages.errorPage.retry}
      </button>
    </main>
  );
}
