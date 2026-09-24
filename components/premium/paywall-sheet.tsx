"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Book } from "@/lib/books";
import { PLAN_IDS, type PlanId } from "@/lib/pricing";
import { useMessages } from "@/lib/i18n/locale-store";
import { ArcanaSeal } from "@/components/brand/arcana-seal";
import { BRAND_NAME } from "@/lib/brand";

type PaywallSheetProps = {
  book: Book;
  onClose: () => void;
};

export function PaywallSheet({ book, onClose }: PaywallSheetProps) {
  const messages = useMessages();
  const copy = messages.paywall;
  const [plan, setPlan] = useState<PlanId>("yearly");
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeButton.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-end justify-center bg-black/65 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <motion.div
        className="relative flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-gold/25 bg-[#0b0c10]/95 p-6 pb-7 text-center shadow-2xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label={messages.close}
          className="icon-btn focus-ring absolute right-3 top-3"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="drop-shadow-[0_0_16px_rgba(236,208,138,0.4)]">
          <ArcanaSeal className="size-16" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-micro uppercase text-gold-bright/85">{copy.name(BRAND_NAME)}</p>
          <h2 id="paywall-title" className="font-serif text-3xl text-parchment">
            {copy.sealed(messages.books[book.id].title)}
          </h2>
          <p className="font-serif text-lg italic text-parchment/80">{copy.subtitle}</p>
        </div>

        <ul className="flex w-full flex-col gap-2.5 text-left">
          {copy.benefits.map((benefit) => (
            <li key={benefit} className="text-hint flex items-start gap-3 text-parchment/90">
              <span className="mt-1.5 size-2 shrink-0 rotate-45 bg-gold-bright shadow-[0_0_6px_rgba(236,208,138,0.8)]" aria-hidden />
              {benefit}
            </li>
          ))}
        </ul>

        <div className="grid w-full grid-cols-2 gap-3" role="radiogroup" aria-label={copy.choosePlan}>
          {PLAN_IDS.map((id) => {
            const option = copy.plans[id];
            const active = id === plan;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPlan(id)}
                className={`focus-ring relative flex min-h-24 flex-col items-center justify-center gap-0.5 rounded-2xl border px-3 py-3 transition-colors ${
                  active ? "border-gold-bright/80 bg-gold/15 shadow-[0_0_18px_rgba(236,208,138,0.12)]" : "border-parchment/15 hover:border-gold/40"
                }`}
              >
                {option.note && (
                  <span className="absolute -top-3 whitespace-nowrap rounded-full bg-gold-bright px-3 py-0.5 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[#2a1806]">
                    {option.note}
                  </span>
                )}
                {active && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-gold-bright text-[#2a1806]" aria-hidden>
                    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                )}
                <span className="text-label uppercase text-parchment/80">{option.label}</span>
                <span className={`font-serif text-2xl ${active ? "text-gold-bright" : "text-parchment/80"}`}>{option.price}</span>
                <span className="text-sm text-parchment/80">{option.period}</span>
              </button>
            );
          })}
        </div>

        <button type="button" disabled className="btn-gold focus-ring w-full">
          {copy.soon}
        </button>
        <p className="text-sm text-parchment/80">{copy.footnote}</p>
      </motion.div>
    </motion.div>
  );
}
