"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { classicTheme } from "@/lib/themes";
import { CHARGE_SECONDS, ritualMotion, ritualStore } from "@/lib/ritual-store";
import { isSoundEnabled, setSoundEnabled, startDrone, stopDrone } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";

const BookScene = dynamic(() => import("@/components/book/book-scene"), { ssr: false });

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

function ChargeLine() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${ritualMotion.charge})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="h-px w-40 overflow-hidden bg-gold/15">
      <div ref={bar} className="h-full w-full origin-center bg-gradient-to-r from-transparent via-gold-bright to-transparent" />
    </div>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(isSoundEnabled());
  }, []);

  const toggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    const next = !on;
    setSoundEnabled(next);
    if (!next) stopDrone();
    setOn(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label={on ? "Sesi kapat" : "Sesi aç"}
      className="pointer-events-auto grid size-10 place-items-center rounded-full text-parchment-dim/70 transition-colors hover:text-gold"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {on ? (
          <>
            <path d="M15.5 9a4 4 0 0 1 0 6" />
            <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
          </>
        ) : (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        )}
      </svg>
    </button>
  );
}

export function Experience() {
  const [ready, setReady] = useState(false);
  const { phase, answer } = useSyncExternalStore(
    ritualStore.subscribe,
    ritualStore.getSnapshot,
    ritualStore.getServerSnapshot,
  );

  const begin = useCallback(() => {
    if (!ready) return;
    if (ritualStore.begin()) {
      startDrone(CHARGE_SECONDS);
      vibrate([10, 90, 14, 70, 18, 50, 24, 30, 30]);
    }
  }, [ready]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      begin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [begin]);

  const askAgain = (event: React.MouseEvent) => {
    event.stopPropagation();
    ritualStore.close();
  };

  return (
    <main
      className={`relative h-dvh w-full overflow-hidden bg-[#050608] ${phase === "idle" && ready ? "cursor-pointer" : ""}`}
      onPointerDown={begin}
    >
      <div className="absolute inset-0">
        <BookScene theme={classicTheme} onReady={() => setReady(true)} />
      </div>

      <AnimatePresence>
        {!ready && (
          <motion.div
            key="veil"
            className="absolute inset-0 z-20 bg-[#050608]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 2, ease: "easeOut" } }}
          />
        )}
      </AnimatePresence>

      <motion.header
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-8"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: phase === "opening" ? 0.3 : 1 } : undefined}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <span className="size-10" aria-hidden />
        <h1 className="text-[0.65rem] font-medium uppercase tracking-[0.55em] text-gold/75">Cevaplar Kitabı</h1>
        <SoundToggle />
      </motion.header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex min-h-40 flex-col items-center justify-end px-6 pb-[max(env(safe-area-inset-bottom),2.5rem)] text-center">
        <AnimatePresence mode="wait">
          {ready && phase === "idle" && (
            <motion.div key="idle" {...fade} transition={{ duration: 0.9, ease: "easeOut" }} className="flex flex-col items-center gap-3">
              <p className="font-serif text-[1.7rem] italic leading-snug text-parchment/95 sm:text-3xl">Sorunu içinden geçir…</p>
              <motion.p
                className="text-[0.7rem] uppercase tracking-[0.32em] text-parchment-dim/60"
                animate={{ opacity: [0.45, 0.9, 0.45] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              >
                ve kitaba dokun
              </motion.p>
            </motion.div>
          )}

          {phase === "charging" && (
            <motion.div key="charging" {...fade} transition={{ duration: 0.5 }} className="flex flex-col items-center gap-4">
              <p className="font-serif text-2xl italic text-gold-bright/90">Kitap seni dinliyor…</p>
              <ChargeLine />
            </motion.div>
          )}

          {phase === "revealed" && (
            <motion.div key="revealed" {...fade} transition={{ duration: 0.8, delay: 0.1 }} className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={askAgain}
                onPointerDown={(event) => event.stopPropagation()}
                className="pointer-events-auto rounded-full border border-gold/35 bg-black/30 px-7 py-3 text-[0.72rem] uppercase tracking-[0.3em] text-gold-bright/90 backdrop-blur-sm transition-colors hover:border-gold/70 hover:bg-gold/10"
              >
                Yeni soru sor
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="sr-only" aria-live="polite">
        {phase === "revealed" && answer ? `Kitabın cevabı: ${answer.text}` : ""}
      </p>
    </main>
  );
}
