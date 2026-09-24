"use client";

import { localeStore, useMessages } from "@/lib/i18n/locale-store";

export function LanguageToggle() {
  const messages = useMessages();

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        localeStore.toggle();
      }}
      aria-label={messages.switchLanguage}
      className="focus-ring pointer-events-auto flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-label text-parchment/85 transition-colors hover:text-gold-bright"
    >
      <span className={messages.locale === "tr" ? "text-gold-bright" : "opacity-70"}>TR</span>
      <span className="opacity-40" aria-hidden>
        /
      </span>
      <span className={messages.locale === "en" ? "text-gold-bright" : "opacity-70"}>EN</span>
    </button>
  );
}
