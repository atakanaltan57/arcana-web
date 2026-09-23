"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { classicTheme } from "@/lib/themes";
import { CHARGE_SECONDS, ritualMotion, ritualStore } from "@/lib/ritual-store";
import { isSoundEnabled, setSoundEnabled, startDrone, stopDrone } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
import { BRAND_NAME } from "@/lib/brand";
import {
  cancelStoryRecording,
  isStoryRecordingSupported,
  startStoryRecording,
  stopStoryRecording,
  type StoryVideo,
} from "@/lib/story-recorder";
import type { ShareTarget } from "@/lib/share";
import { StorySheet } from "@/components/share/story-sheet";
import { PageActions } from "@/components/share/page-actions";
import { PortalVeil } from "@/components/transition/portal-veil";
import { ArcanaSeal } from "@/components/brand/arcana-seal";
import { AwakeningVeil } from "@/components/brand/awakening-veil";

type PreparedStory = {
  video: StoryVideo | null;
  target: ShareTarget;
  answer: string;
};

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
      className="focus-ring pointer-events-auto grid size-11 place-items-center rounded-full text-parchment/85 transition-colors hover:text-gold-bright"
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
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [story, setStory] = useState<PreparedStory | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef("");
  const previousPhase = useRef<string>("idle");
  const { phase, answer } = useSyncExternalStore(
    ritualStore.subscribe,
    ritualStore.getSnapshot,
    ritualStore.getServerSnapshot,
  );

  const begin = useCallback(() => {
    if (!ready || story) return;
    if (ritualStore.begin()) {
      startDrone(CHARGE_SECONDS);
      vibrate([10, 90, 14, 70, 18, 50, 24, 30, 30]);
      const canvas = stageRef.current?.querySelector("canvas");
      if (canvas) startStoryRecording(canvas);
    }
  }, [ready, story]);

  useEffect(() => {
    if (phase === "revealed" && answer) answerRef.current = answer.text;
    const wasClosing = previousPhase.current === "closing";
    previousPhase.current = phase;
    if (!wasClosing || phase !== "idle") return;
    if (!shareTarget) {
      cancelStoryRecording();
      return;
    }
    const target = shareTarget;
    const answerText = answerRef.current;
    setShareTarget(null);
    stopStoryRecording()
      .then((video) => setStory({ video, target, answer: answerText }))
      .catch((error: unknown) => {
        console.error("Story video could not be prepared", error);
        setStory({ video: null, target, answer: answerText });
      });
  }, [phase, answer, shareTarget]);

  const shareTo = (target: ShareTarget) => (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isStoryRecordingSupported()) {
      setStory({ video: null, target, answer: answerRef.current || answer?.text || "" });
      return;
    }
    setShareTarget(target);
    ritualStore.close();
  };

  const closeStory = useCallback(() => setStory(null), []);
  const router = useRouter();

  useEffect(() => {
    ritualStore.reset();
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    if (phase === "portal") {
      cancelStoryRecording();
      setShareTarget(null);
      router.prefetch("/muhur");
    }
    if (phase === "departed") {
      try {
        window.sessionStorage.setItem("arcana-arrival", "portal");
      } catch (error) {
        console.error("Arrival flag could not be stored", error);
      }
      router.push("/muhur");
    }
  }, [phase, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target instanceof HTMLButtonElement || story) return;
      event.preventDefault();
      begin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [begin, story]);

  const askAgain = (event: React.MouseEvent) => {
    event.stopPropagation();
    ritualStore.close();
  };

  return (
    <main
      className={`relative h-dvh w-full overflow-hidden bg-[#050608] ${phase === "idle" && ready ? "cursor-pointer" : ""}`}
      onPointerDown={begin}
    >
      <div ref={stageRef} className="absolute inset-0">
        <BookScene theme={classicTheme} onReady={() => setReady(true)} />
      </div>

      <AwakeningVeil visible={!ready} label="Kitap uyanıyor…" />

      <motion.header
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-8"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: phase === "opening" ? 0.3 : 1 } : undefined}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <span className="size-11" aria-hidden />
        <h1 className="flex items-center gap-2.5 text-label font-medium uppercase text-gold-bright/90">
          <ArcanaSeal className="size-5" />
          {BRAND_NAME}
        </h1>
        <SoundToggle />
      </motion.header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex min-h-40 flex-col items-center justify-end px-6 pb-[max(env(safe-area-inset-bottom),2.5rem)] text-center">
        <AnimatePresence mode="wait">
          {ready && phase === "idle" && (
            <motion.div key="idle" {...fade} transition={{ duration: 0.9, ease: "easeOut" }} className="flex flex-col items-center gap-3">
              <p className="font-serif text-[1.8rem] italic leading-snug text-parchment [text-shadow:0_2px_16px_rgba(0,0,0,0.8)] sm:text-4xl">
                Sorunu içinden geçir…
              </p>
              <p className="text-label uppercase text-parchment/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
                ve kitaba dokun
                <span className="hidden normal-case tracking-normal text-parchment-dim/80 [@media(hover:hover)]:inline"> · ya da Enter&apos;a bas</span>
              </p>
              <motion.span
                className="h-px w-16 bg-gradient-to-r from-transparent via-gold-bright to-transparent"
                animate={{ opacity: [0.2, 1, 0.2], scaleX: [0.6, 1.4, 0.6] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          )}

          {phase === "charging" && (
            <motion.div key="charging" {...fade} transition={{ duration: 0.5 }} className="flex flex-col items-center gap-4">
              <p className="font-serif text-2xl italic text-gold-bright [text-shadow:0_2px_18px_rgba(0,0,0,0.95)]">Kitap seni dinliyor…</p>
              <ChargeLine />
            </motion.div>
          )}

          {phase === "closing" && shareTarget && (
            <motion.p key="preparing" {...fade} transition={{ duration: 0.5 }} className="font-serif text-xl italic text-gold-bright [text-shadow:0_2px_18px_rgba(0,0,0,0.95)]">
              Hikayen hazırlanıyor…
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === "revealed" && <PageActions key="page-actions" onShare={shareTo} onAskAgain={askAgain} />}
      </AnimatePresence>

      {(phase === "portal" || phase === "departed") && <PortalVeil hold={phase === "departed"} />}

      <AnimatePresence>
        {story && <StorySheet key="story" video={story.video} target={story.target} answer={story.answer} onClose={closeStory} />}
      </AnimatePresence>

      <p className="sr-only select-text" aria-live="polite">
        {phase === "revealed" && answer ? `Kitabın cevabı: ${answer.text}` : ""}
      </p>
    </main>
  );
}
