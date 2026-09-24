"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { LanguageToggle } from "@/components/brand/language-toggle";
import { localeStore, useMessages } from "@/lib/i18n/locale-store";

export function PrivacyContent() {
  const messages = useMessages();
  const copy = messages.privacy;

  useEffect(() => {
    localeStore.hydrate();
  }, []);

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_50%_0%,#2a1a0c_0%,#0b0c10_60%)] px-5 pb-16 pt-[max(env(safe-area-inset-top),1.25rem)] text-parchment">
      <div className="mx-auto grid max-w-2xl grid-cols-[1fr_auto_1fr] items-center">
        <Link href="/" aria-label={copy.back} className="icon-btn focus-ring justify-self-start">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <BrandMark />
        <div className="justify-self-end">
          <LanguageToggle />
        </div>
      </div>

      <article className="mx-auto mt-10 max-w-2xl">
        <h1 className="font-serif text-4xl text-parchment">{copy.title}</h1>
        <p className="mt-2 text-sm text-parchment/70">{copy.updated}</p>
        <div className="mt-8 flex flex-col gap-7">
          {copy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-serif text-2xl text-gold-bright">{section.heading}</h2>
              <p className="mt-2 text-base leading-relaxed text-parchment/85">{section.body}</p>
            </section>
          ))}
        </div>
        <Link href="/" className="btn-gold focus-ring mt-12">
          {copy.back}
        </Link>
      </article>
    </main>
  );
}
