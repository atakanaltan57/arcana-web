"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { StoryVideo } from "@/lib/story-recorder";
import { SHARE_CTA, downloadStory, shareStory, type ShareOutcome, type ShareTarget } from "@/lib/share";
import { ShareIcon } from "./share-icons";

type StorySheetProps = {
  video: StoryVideo | null;
  target: ShareTarget;
  answer: string;
  onClose: () => void;
};

const OUTCOME_MESSAGES: Record<Exclude<ShareOutcome, "shared" | "cancelled">, string> = {
  downloaded: "Video indirildi. Telefonundan hikaye olarak yükleyebilirsin.",
  copied: "Cevap panoya kopyalandı.",
};

export function StorySheet({ video, target, answer, onClose }: StorySheetProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
      if (outcome === "downloaded" || outcome === "copied") setMessage(OUTCOME_MESSAGES[outcome]);
    } catch (error) {
      console.error("Story share failed", error);
      setMessage("Paylaşım açılamadı. Videoyu indirip elle paylaşabilirsin.");
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
      aria-label="Hikayeni paylaş"
    >
      <motion.div
        className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-gold/20 bg-[#0b0c10]/95 p-5 pb-6 shadow-2xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[0.65rem] uppercase tracking-[0.4em] text-gold/70">Hikayen hazır</p>

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
          <p className="px-4 text-center font-serif text-xl italic text-parchment/90">“{answer}”</p>
        )}

        <button
          type="button"
          onClick={share}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-b from-gold-bright to-gold px-6 py-3.5 text-sm font-semibold tracking-wide text-[#1a1206] transition-opacity disabled:opacity-60"
        >
          <ShareIcon target={target} className="size-5" />
          {busy ? "Açılıyor…" : SHARE_CTA[target]}
        </button>

        <div className="flex w-full gap-3">
          {video && (
            <button
              type="button"
              onClick={() => downloadStory(video)}
              className="flex-1 rounded-full border border-gold/30 px-4 py-3 text-xs uppercase tracking-[0.2em] text-gold-bright/85 transition-colors hover:bg-gold/10"
            >
              İndir
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-parchment/15 px-4 py-3 text-xs uppercase tracking-[0.2em] text-parchment-dim transition-colors hover:bg-white/5"
          >
            Kapat
          </button>
        </div>

        {message && <p className="text-center text-xs leading-relaxed text-parchment-dim">{message}</p>}
      </motion.div>
    </motion.div>
  );
}
