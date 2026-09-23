"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { toRoman } from "@/lib/cipher";
import { SEAL_COUNT, findSeal, saveBrokenSeal } from "@/lib/seals";

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
  return count >= SEAL_COUNT
    ? "ARCANA'nın dokuz kadim mührünü de kırdım. Kapı açıldı."
    : `ARCANA'nın kadim mühürlerinden ${count}/${SEAL_COUNT} tanesini kırdım. Sen kaç tanesini çözebilirsin?`;
}

export async function shareSeals(count: number) {
  const message = sealShareMessage(count);
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ text: message });
      return null;
    }
    await navigator.clipboard.writeText(message);
    return "Metin panoya kopyalandı.";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    console.error("Seal share failed", error);
    return "Paylaşım açılamadı.";
  }
}

export function SealGate({ broken, onBroken, onWrong, hidden }: SealGateProps) {
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
          <header className="relative flex flex-col items-center px-5 pt-[max(env(safe-area-inset-top),1.25rem)] text-center">
            <Link
              href="/"
              aria-label="Kitaba dön"
              className="focus-ring pointer-events-auto absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] grid size-11 place-items-center rounded-full text-parchment/85 transition-colors hover:bg-white/5 hover:text-gold-bright"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </Link>
            <p className="text-micro uppercase text-gold-bright/85">Arcana</p>
            <h1 className="mt-1.5 font-serif text-3xl text-parchment [text-shadow:0_2px_14px_rgba(0,0,0,0.8)] sm:text-4xl">Mühür Kapısı</h1>
            <div className="mt-2.5 flex items-center gap-3" role="img" aria-label={`${broken.length} / ${SEAL_COUNT} mühür kırıldı`}>
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
                Çözdüğün satır
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
                placeholder="Kadim satırlardan birini çözdüysen buraya yaz…"
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
                {status.kind === "checking" ? "Mühre dokunuluyor…" : "Mührü kır"}
              </button>
            </motion.form>

            <div id="seal-feedback" className="pointer-events-auto mt-3 flex min-h-12 flex-col items-center gap-2 text-center" aria-live="polite">
              {status.kind === "wrong" && (
                <p className="flex items-center gap-2 font-serif text-lg italic text-[#f0a58f]">
                  <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    <path d="M12 3l9.5 17h-19z" />
                    <path d="M12 10v4.5M12 17.5v.01" />
                  </svg>
                  Mürekkep henüz kurumadı. Satırı yeniden oku.
                </p>
              )}
              {status.kind === "error" && (
                <p className="text-sm text-[#f0a58f]">Mühür şu an doğrulanamadı. Biraz sonra yeniden dene.</p>
              )}
              {status.kind === "broken" && (
                <>
                  <p className="font-serif text-xl text-gold-bright">
                    {status.fresh
                      ? `${toRoman(status.index + 1)}. mühür kırıldı.`
                      : `${toRoman(status.index + 1)}. mühür zaten kırılmıştı.`}
                  </p>
                  <button
                    type="button"
                    onClick={async () => setShareNote(await shareSeals(broken.length))}
                    className="btn-ghost focus-ring"
                  >
                    Kırdığın mühürleri paylaş
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
