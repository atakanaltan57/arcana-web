"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArcanaSeal } from "@/components/brand/arcana-seal";
import { localeStore, useMessages } from "@/lib/i18n/locale-store";

export default function NotFound() {
  const messages = useMessages();

  useEffect(() => {
    localeStore.hydrate();
  }, []);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_50%_40%,#2a1a0c_0%,#0b0c10_65%)] px-6 text-center">
      <div className="drop-shadow-[0_0_16px_rgba(236,208,138,0.4)]">
        <ArcanaSeal className="size-16" />
      </div>
      <h1 className="font-serif text-3xl text-parchment">{messages.notFound.title}</h1>
      <p className="max-w-sm text-base text-parchment/80">{messages.notFound.body}</p>
      <Link href="/" className="btn-gold focus-ring">
        {messages.notFound.back}
      </Link>
    </main>
  );
}
