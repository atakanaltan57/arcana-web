"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { StoryVideo } from "@/lib/story-recorder";
import { downloadStory, shareStory, type ShareTarget } from "@/lib/share";
import { useMessages } from "@/lib/i18n/locale-store";
import { ShareIcon } from "./share-icons";

type StorySheetProps = {
  video: StoryVideo | null;
  target: ShareTarget;
  answer: string;
  onClose: () => void;
};

export function StorySheet({ video, target, answer, onClose }: StorySheetProps) {
  const messages = useMessages();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    primary.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    if (!video) return;
    const url = URL.createObjectURL(video.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await shareStory(video, target, answer);
      if (outcome === "downloaded" || outcome === "copied") setMessage(messages.story[outcome]);
    } catch (error) {
      console.error("Story share failed", error);
      setMessage(messages.story.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={messages.story.dialog}
    >
      <motion.div
        className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-gold/20 bg-[#0b0c10]/95 p-5 pb-6 shadow-2xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-micro uppercase text-gold-bright/85">{messages.story.ready}</p>

        {previewUrl ? (
          <video
            src={previewUrl}
            className="aspect-[9/16] max-h-[52dvh] w-auto rounded-2xl border border-gold/15 bg-black object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <p className="select-text px-4 text-center font-serif text-xl italic text-parchment/90">“{answer}”</p>
        )}

        <button
          type="button"
          ref={primary}
          onClick={share}
          disabled={busy}
          className="btn-gold focus-ring w-full"
        >
          <ShareIcon target={target} className="size-5" />
          {busy ? messages.story.opening : messages.share.cta[target]}
        </button>

        <div className="flex w-full gap-3">
          {video && (
            <button
              type="button"
              onClick={() => downloadStory(video)}
              className="btn-ghost focus-ring min-h-12! flex-1"
            >
              {messages.story.download}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost focus-ring min-h-12! flex-1 border-parchment/25! text-parchment/85!"
          >
            {messages.close}
          </button>
        </div>

        {message && <p className="text-center text-sm leading-relaxed text-parchment/80">{message}</p>}
      </motion.div>
    </motion.div>
  );
}
