"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { toRoman } from "@/lib/cipher";
import { SEAL_COUNT, findSeal, saveBrokenSeal } from "@/lib/seals";
import { BRAND_NAME } from "@/lib/brand";
import { getMessages, useMessages } from "@/lib/i18n/locale-store";
import { LanguageToggle } from "@/components/brand/language-toggle";
import { BrandMark } from "@/components/brand/brand-mark";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "wrong" }
  | { kind: "broken"; index: number; fresh: boolean }
  | { kind: "error" };

type SealGateProps = {
  broken: number[];
  onBroken: (index: number, fresh: boolean, next: number[]) => void;
  onWrong: () => void;
  hidden: boolean;
};

export function sealShareMessage(count: number) {
  const { gate } = getMessages();
  return count >= SEAL_COUNT ? gate.shareAll(BRAND_NAME) : gate.shareSome(BRAND_NAME, count, SEAL_COUNT);
}

export async function shareSeals(count: number) {
  const message = sealShareMessage(count);
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ text: message });
      return null;
    }
    await navigator.clipboard.writeText(message);
    return getMessages().gate.copied;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    console.error("Seal share failed", error);
    return getMessages().gate.shareFailed;
  }
}

export function SealGate({ broken, onBroken, onWrong, hidden }: SealGateProps) {
  const messages = useMessages();
  const copy = messages.gate;
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [shareNote, setShareNote] = useState<string | null>(null);
  const shake = useAnimationControls();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status.kind === "checking") return;
    setStatus({ kind: "checking" });
    setShareNote(null);
    try {
      const index = await findSeal(text);
      if (index === null) {
        setStatus({ kind: "wrong" });
        onWrong();
        await shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.5 } });
        return;
      }
      const fresh = !broken.includes(index);
      const next = saveBrokenSeal(index);
      onBroken(index, fresh, next);
      setStatus({ kind: "broken", index, fresh });
      setText("");
    } catch (error) {
      console.error("Seal check failed", error);
      setStatus({ kind: "error" });
    }
  };

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="gate-ui"
          className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.2 } }}
          transition={{ duration: 1.4, delay: 0.6 }}
        >
          <header className="flex flex-col items-center px-3 pt-[max(env(safe-area-inset-top),1.25rem)] text-center sm:px-8">
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
              <Link
                href="/"
                aria-label={copy.back}
                className="focus-ring pointer-events-auto grid size-11 justify-self-start place-items-center rounded-full text-parchment/85 transition-colors hover:bg-white/5 hover:text-gold-bright"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </Link>
              <BrandMark />
              <div className="justify-self-end">
                <LanguageToggle />
              </div>
            </div>
            <h1 className="mt-1 font-serif text-3xl text-parchment [text-shadow:0_2px_14px_rgba(0,0,0,0.8)] sm:text-4xl">{copy.title}</h1>
            <div className="mt-2.5 flex items-center gap-3" role="img" aria-label={copy.progress(broken.length, SEAL_COUNT)}>
              <div className="flex gap-2.5">
                {Array.from({ length: SEAL_COUNT }, (_, index) => (
                  <span
                    key={index}
                    className={`size-2 rotate-45 rounded-[1px] ${
                      broken.includes(index)
                        ? "bg-[#fff4dc] shadow-[0_0_8px_rgba(255,236,190,0.9)]"
                        : "bg-[#2b2520] ring-1 ring-[#9c8a70]/60"
                    }`}
                  />
                ))}
              </div>
              <p className="text-label uppercase text-gold-bright/90">
                {broken.length} / {SEAL_COUNT}
              </p>
            </div>
          </header>

          <div className="bg-gradient-to-t from-black/85 via-black/60 to-transparent px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-16">
            <motion.form
              onSubmit={submit}
              animate={shake}
              className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col items-center gap-3"
            >
              <label htmlFor="seal-text" className="sr-only">
                {copy.label}
              </label>
              <textarea
                id="seal-text"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  if (status.kind === "wrong" || status.kind === "error") setStatus({ kind: "idle" });
                }}
                rows={2}
                maxLength={400}
                placeholder={copy.placeholder}
                aria-invalid={status.kind === "wrong"}
                aria-describedby="seal-feedback"
                className={`w-full resize-none rounded-2xl border bg-[#f1e4c5]/[0.08] px-5 py-3.5 font-serif text-lg text-parchment backdrop-blur-sm transition-colors duration-500 placeholder:italic placeholder:text-parchment-dim/75 focus:outline-none focus:ring-2 ${
                  status.kind === "wrong"
                    ? "border-[#e0705a]/80 focus:ring-[#e0705a]/25"
                    : "border-gold/30 focus:border-gold/60 focus:ring-gold/20"
                }`}
              />
              <button
                type="submit"
                disabled={status.kind === "checking" || text.trim().length === 0}
                className="btn-gold focus-ring px-10!"
              >
                {status.kind === "checking" ? copy.checking : copy.submit}
              </button>
            </motion.form>

            {copy.ancientHint && (
              <p className="mx-auto mt-3 max-w-lg text-center font-serif text-base italic text-parchment/75">{copy.ancientHint}</p>
            )}
            <div id="seal-feedback" className="pointer-events-auto mt-3 flex min-h-12 flex-col items-center gap-2 text-center" aria-live="polite">
              {status.kind === "wrong" && (
                <p className="flex items-center gap-2 font-serif text-lg italic text-[#f0a58f]">
                  <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    <path d="M12 3l9.5 17h-19z" />
                    <path d="M12 10v4.5M12 17.5v.01" />
                  </svg>
                  {copy.wrong}
                </p>
              )}
              {status.kind === "error" && (
                <p className="text-sm text-[#f0a58f]">{copy.error}</p>
              )}
              {status.kind === "broken" && (
                <>
                  <p className="font-serif text-xl text-gold-bright">
                    {status.fresh
                      ? copy.broken(toRoman(status.index + 1))
                      : copy.alreadyBroken(toRoman(status.index + 1))}
                  </p>
                  <button
                    type="button"
                    onClick={async () => setShareNote(await shareSeals(broken.length))}
                    className="btn-ghost focus-ring"
                  >
                    {copy.shareSeals}
                  </button>
                  {shareNote && <p className="text-sm text-parchment/80">{shareNote}</p>}
                </>
              )}
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
