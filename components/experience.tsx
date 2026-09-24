"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CHARGE_SECONDS, ritualMotion, ritualStore } from "@/lib/ritual-store";
import { isSoundEnabled, setSoundEnabled, startDrone, stopDrone } from "@/lib/sound";
import { vibrate } from "@/lib/haptics";
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
import { BrandMark } from "@/components/brand/brand-mark";
import { BRAND_NAME } from "@/lib/brand";
import { AwakeningVeil } from "@/components/brand/awakening-veil";
import { BookShelf } from "@/components/shelf/book-shelf";
import { PaywallSheet } from "@/components/premium/paywall-sheet";
import { bookStore } from "@/lib/book-store";
import { getMessages, localeStore, useMessages } from "@/lib/i18n/locale-store";
import { LanguageToggle } from "@/components/brand/language-toggle";
import { canOpen } from "@/lib/entitlements";
import type { Book } from "@/lib/books";

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isControlTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("button, a, [role=dialog]") !== null;
}

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
  const messages = useMessages();
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
      aria-label={on ? messages.sound.off : messages.sound.on}
      className="icon-btn focus-ring pointer-events-auto"
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
  const [paywall, setPaywall] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef("");
  const previousPhase = useRef<string>("idle");
  const { phase, answer } = useSyncExternalStore(
    ritualStore.subscribe,
    ritualStore.getSnapshot,
    ritualStore.getServerSnapshot,
  );
  const { book, answers, error: bookError } = useSyncExternalStore(
    bookStore.subscribe,
    bookStore.getSnapshot,
    bookStore.getServerSnapshot,
  );
  const locked = !canOpen(book);

  const messages = useMessages();
  const bookText = messages.books[book.id];

  useEffect(() => {
    localeStore.hydrate();
    bookStore.hydrate();
  }, []);

  useEffect(() => {
    document.title = `${BRAND_NAME} · ${messages.title}`;
  }, [messages.title]);

  const selectBook = useCallback((next: Book) => bookStore.select(next.id), []);
  const stepBook = useCallback((direction: 1 | -1) => bookStore.step(direction), []);
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null);
  const closePaywall = useCallback(() => setPaywall(false), []);

  const begin = useCallback(() => {
    if (!ready || story || paywall) return;
    if (locked) {
      if (ritualStore.getSnapshot().phase === "idle") setPaywall(true);
      return;
    }
    if (ritualStore.begin()) {
      startDrone(CHARGE_SECONDS);
      vibrate([10, 90, 14, 70, 18, 50, 24, 30, 30]);
      const canvas = stageRef.current?.querySelector("canvas");
      if (canvas) startStoryRecording(canvas, getMessages().books[bookStore.getSnapshot().book.id].title);
    }
  }, [ready, story, paywall, locked]);

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
      if (story || paywall) return;
      if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && ritualStore.getSnapshot().phase === "idle") {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        bookStore.step(event.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      begin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [begin, story, paywall]);

  const releaseDrag = () => {
    drag.current = null;
    ritualMotion.carouselDrag = 0;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (!ready || story || paywall || !event.isPrimary || isControlTarget(event.target)) return;
    drag.current = { x: event.clientX, id: event.pointerId, moved: false };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId || phase !== "idle") return;
    const dx = event.clientX - current.x;
    if (Math.abs(dx) > 8) current.moved = true;
    if (current.moved) ritualMotion.carouselDrag = clampValue(-dx / (window.innerWidth * 0.55), -1.2, 1.2);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const current = drag.current;
    releaseDrag();
    if (!current || current.id !== event.pointerId || isControlTarget(event.target)) return;
    const dx = event.clientX - current.x;
    if (phase === "idle" && Math.abs(dx) > Math.min(70, window.innerWidth * 0.12)) {
      bookStore.step(dx < 0 ? 1 : -1);
      return;
    }
    if (current.moved) return;
    if (phase === "idle") {
      const edge = event.clientX / window.innerWidth;
      if (edge < 0.16) {
        bookStore.step(-1);
        return;
      }
      if (edge > 0.84) {
        bookStore.step(1);
        return;
      }
    }
    begin();
  };

  const askAgain = (event: React.MouseEvent) => {
    event.stopPropagation();
    ritualStore.close();
  };

  return (
    <main
      className={`relative h-dvh w-full touch-none overflow-hidden bg-[#050608] select-none ${phase === "idle" && ready ? "cursor-pointer" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={releaseDrag}
      onPointerLeave={releaseDrag}
    >
      <div ref={stageRef} className="absolute inset-0">
        <BookScene bookId={book.id} onReady={() => setReady(true)} />
      </div>

      <AwakeningVeil visible={!ready} label={messages.home.awakening} />

      <motion.header
        className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center px-3 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-8"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: phase === "opening" ? 0.3 : 1 } : undefined}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <div className="justify-self-start">
          <LanguageToggle />
        </div>
        <BrandMark as="h1" />
        <div className="justify-self-end">
          <SoundToggle />
        </div>
      </motion.header>

      <AnimatePresence>
        {ready && phase === "idle" && (
          <motion.div
            key="shelf"
            className="pointer-events-none absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <BookShelf book={book} onSelect={selectBook} onStep={stepBook} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex min-h-40 flex-col items-center justify-end px-6 pb-[max(env(safe-area-inset-bottom),2.5rem)] text-center">
        <AnimatePresence mode="wait">
          {ready && phase === "idle" && (
            <motion.div key="idle" {...fade} transition={{ duration: 0.9, ease: "easeOut" }} className="flex w-full flex-col items-center gap-3">
              <p className="text-balance font-serif text-[clamp(1.5rem,5vw,2.25rem)] italic leading-snug text-parchment [text-shadow:0_2px_16px_rgba(0,0,0,0.8)]">
                {locked ? messages.home.lockedPrompt(bookText.title) : messages.home.prompt}
              </p>
              {bookError ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-hint [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">{messages.home.loadError}</p>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => bookStore.select(book.id)}
                    className="btn-ghost focus-ring pointer-events-auto"
                  >
                    {messages.home.retry}
                  </button>
                </div>
              ) : (
                <p className="text-hint text-balance [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
                  {locked ? messages.home.lockedHint : answers ? messages.home.touchHint : messages.home.loadingPages}
                  {!locked && answers && (
                    <span className="hidden text-parchment/70 [@media(hover:hover)]:inline">{messages.home.keyHint}</span>
                  )}
                </p>
              )}
              <motion.span
                className="h-px w-16 bg-gradient-to-r from-transparent via-gold-bright to-transparent"
                animate={{ opacity: [0.2, 1, 0.2], scaleX: [0.6, 1.4, 0.6] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          )}

          {phase === "charging" && (
            <motion.div key="charging" {...fade} transition={{ duration: 0.5 }} className="flex flex-col items-center gap-4">
              <p className="font-serif text-2xl italic text-gold-bright [text-shadow:0_2px_18px_rgba(0,0,0,0.95)]">{messages.home.listening}</p>
              <ChargeLine />
            </motion.div>
          )}

          {phase === "revealed" && (
            <motion.div key="revealed" {...fade} transition={{ duration: 1.1, delay: 0.4, ease: "easeOut" }}>
              <button
                type="button"
                onClick={askAgain}
                onPointerDown={(event) => event.stopPropagation()}
                className="btn-gold focus-ring pointer-events-auto"
              >
                {messages.home.askAgain}
              </button>
            </motion.div>
          )}

          {phase === "closing" && shareTarget && (
            <motion.p key="preparing" {...fade} transition={{ duration: 0.5 }} className="font-serif text-2xl italic text-gold-bright [text-shadow:0_2px_18px_rgba(0,0,0,0.95)]">
              {messages.home.preparingStory}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {phase === "revealed" && <PageActions key="page-actions" onShare={shareTo} />}
      </AnimatePresence>

      {(phase === "portal" || phase === "departed") && <PortalVeil hold={phase === "departed"} />}

      <AnimatePresence>
        {story && <StorySheet key="story" video={story.video} target={story.target} answer={story.answer} onClose={closeStory} />}
      </AnimatePresence>

      <AnimatePresence>{paywall && <PaywallSheet key="paywall" book={book} onClose={closePaywall} />}</AnimatePresence>

      <p className="sr-only select-text" aria-live="polite">
        {phase === "revealed" && answer ? messages.home.answerAnnouncement(answer.text) : ""}
      </p>
    </main>
  );
}
