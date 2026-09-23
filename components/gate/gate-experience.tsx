"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { SealGate, shareSeals } from "@/components/seal/seal-gate";
import { AwakeningVeil } from "@/components/brand/awakening-veil";
import { ArcanaSeal } from "@/components/brand/arcana-seal";
import { SEAL_COUNT, readBrokenSeals } from "@/lib/seals";
import { playArrival, playDoorGrind, playSealCrack } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
import { DOOR_OPEN_MS } from "./gate-doors";
import { SEAL_BREAK_MS } from "./seal-socket";
import type { SealBreak } from "./gate-scene";

const GateScene = dynamic(() => import("./gate-scene"), { ssr: false });

const ARRIVAL_KEY = "arcana-arrival";

function consumeArrival() {
  try {
    const value = window.sessionStorage.getItem(ARRIVAL_KEY);
    window.sessionStorage.removeItem(ARRIVAL_KEY);
    return value === "portal";
  } catch (error) {
    console.error("Arrival flag could not be read", error);
    return false;
  }
}

export function GateExperience() {
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState<number[]>([]);
  const [breaking, setBreaking] = useState<SealBreak | null>(null);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [dimAt, setDimAt] = useState<number | null>(null);
  const [viaPortal, setViaPortal] = useState(false);
  const [arrivalChecked, setArrivalChecked] = useState(false);
  const [finale, setFinale] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const saved = readBrokenSeals();
    setBroken(saved);
    setViaPortal(consumeArrival());
    setArrivalChecked(true);
    if (saved.length >= SEAL_COUNT) {
      setOpenAt(performance.now() - DOOR_OPEN_MS * 3);
      setFinale(true);
    }
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (ready && viaPortal) playArrival();
  }, [ready, viaPortal]);

  const onBroken = useCallback(
    (index: number, fresh: boolean, next: number[]) => {
      setBroken(next);
      if (!fresh) return;
      setBreaking({ index, at: performance.now() });
      playSealCrack();
      vibrate([20, 40, 60]);
      if (next.length >= SEAL_COUNT && openAt === null) {
        timers.current.push(
          window.setTimeout(() => {
            setOpenAt(performance.now());
            playDoorGrind(DOOR_OPEN_MS / 1000);
            vibrate([40, 80, 40, 80, 120]);
          }, SEAL_BREAK_MS + 900),
          window.setTimeout(() => setFinale(true), SEAL_BREAK_MS + 900 + DOOR_OPEN_MS),
        );
      }
    },
    [openAt],
  );

  const onWrong = useCallback(() => setDimAt(performance.now()), []);
  const markReady = useCallback(() => setReady(true), []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#040406]">
      <div className="absolute inset-0">
        <GateScene broken={broken} breaking={breaking} openAt={openAt} dimAt={dimAt} onReady={markReady} />
      </div>

      <SealGate broken={broken} onBroken={onBroken} onWrong={onWrong} hidden={!ready || openAt !== null} />

      <AnimatePresence>
        {finale && (
          <motion.div
            key="finale"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_50%_45%,rgba(255,244,220,0.92)_0%,rgba(240,205,140,0.85)_45%,rgba(176,122,50,0.9)_100%)] px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.6, delay: 0.6, ease: "easeOut" }}
              className="drop-shadow-[0_0_24px_rgba(255,236,190,0.9)]"
            >
              <ArcanaSeal className="size-24" />
            </motion.div>
            <p className="text-label uppercase text-[#3a2508]/90">9 / 9 mühür</p>
            <h2 className="max-w-md font-serif text-4xl leading-tight text-[#2a1806] sm:text-5xl">
              Kadim Yazıcılar arasına katıldın
            </h2>
            <p className="max-w-sm font-serif text-lg italic text-[#3a2508]/85">
              Kapı artık senin için hep açık. Sırrı taşıyan, sırrın mührü olur.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={async () => setShareNote(await shareSeals(SEAL_COUNT))}
                className="focus-ring inline-flex min-h-12 items-center rounded-full bg-[#2a1806] px-7 font-serif text-lg text-[#f3dc9a] shadow-lg transition-transform hover:scale-[1.03]"
              >
                Bunu paylaş
              </button>
              <Link
                href="/"
                className="focus-ring inline-flex min-h-12 items-center rounded-full border border-[#2a1806]/50 px-7 font-serif text-lg text-[#2a1806] transition-colors hover:bg-[#2a1806]/10"
              >
                Kitaba dön
              </Link>
            </div>
            {shareNote && <p className="text-sm text-[#3a2508]">{shareNote}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <AwakeningVeil visible={!ready && arrivalChecked && !viaPortal} label="Kapı beliriyor…" background="bg-[#040406]" />

      <AnimatePresence>
        {(viaPortal || !arrivalChecked) && (
          <motion.div
            key={viaPortal ? "portal-veil" : "dark-veil"}
            className={`pointer-events-none absolute inset-0 z-30 ${
              viaPortal
                ? "bg-[radial-gradient(circle_at_50%_50%,#fffaf0_0%,#f3d9a0_35%,#c9a24b_70%,#6b4a1a_100%)]"
                : "bg-[#040406]"
            }`}
            initial={{ opacity: 1 }}
            animate={ready ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: viaPortal ? 2.6 : 1.4, ease: "easeOut" }}
            onAnimationComplete={() => {
              if (ready) setViaPortal(false);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
