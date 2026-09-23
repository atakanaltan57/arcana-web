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
          <header className="flex flex-col items-center px-5 pt-[max(env(safe-area-inset-top),1.5rem)] text-center">
            <p className="text-[0.62rem] uppercase tracking-[0.55em] text-gold/70">Arcana</p>
            <h1 className="mt-2 font-serif text-3xl text-parchment sm:text-4xl">Mühür Kapısı</h1>
            <p className="mt-2 text-[0.68rem] uppercase tracking-[0.3em] text-gold/80">
              {broken.length} / {SEAL_COUNT} mühür kırıldı
            </p>
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
                className="w-full resize-none rounded-2xl border border-gold/25 bg-[#f1e4c5]/[0.07] px-5 py-3.5 font-serif text-lg text-parchment backdrop-blur-sm placeholder:italic placeholder:text-parchment-dim/55 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20"
              />
              <button
                type="submit"
                disabled={status.kind === "checking" || text.trim().length === 0}
                className="rounded-full bg-gradient-to-b from-[#e8c983] via-[#c49b46] to-[#8d6726] px-10 py-3 font-serif text-lg font-semibold tracking-wide text-[#2a1806] shadow-[0_2px_14px_rgba(60,30,5,0.45),inset_0_1px_0_rgba(255,240,200,0.7)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                {status.kind === "checking" ? "Mühre dokunuluyor…" : "Mührü kır"}
              </button>
            </motion.form>

            <div className="pointer-events-auto mt-3 flex min-h-12 flex-col items-center gap-2 text-center" aria-live="polite">
              {status.kind === "wrong" && (
                <p className="font-serif text-lg italic text-[#e0917a]">Mürekkep henüz kurumadı. Satırı yeniden oku.</p>
              )}
              {status.kind === "error" && (
                <p className="text-sm text-[#e0917a]">Mühür şu an doğrulanamadı. Biraz sonra yeniden dene.</p>
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
                    className="text-[0.68rem] uppercase tracking-[0.25em] text-gold-bright/85 underline-offset-4 hover:underline"
                  >
                    Kırdığın mühürleri paylaş
                  </button>
                  {shareNote && <p className="text-xs text-parchment-dim">{shareNote}</p>}
                </>
              )}
            </div>

            <div className="mt-2 flex justify-center">
              <Link
                href="/"
                className="pointer-events-auto text-[0.65rem] uppercase tracking-[0.35em] text-parchment-dim/60 transition-colors hover:text-gold"
              >
                Kitaba dön
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
