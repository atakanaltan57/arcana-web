"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ritualMotion } from "@/lib/ritual-store";
import type { ShareKind } from "@/lib/share";
import { useMessages } from "@/lib/i18n/locale-store";
import { ShareIcon } from "./share-icons";

const SHARE_KINDS: ShareKind[] = ["image", "video"];
const REGION_TOP = 0.56;
const REGION_HEIGHT = 0.24;
const REGION_WIDTH = 0.82;

type PageActionsProps = {
  onShare: (kind: ShareKind) => (event: React.MouseEvent) => void;
  busy: ShareKind | null;
  videoAvailable: boolean;
};

const stopPointer = (event: React.PointerEvent) => event.stopPropagation();

export function PageActions({ onShare, busy, videoAvailable }: PageActionsProps) {
  const region = useRef<HTMLDivElement>(null);
  const messages = useMessages();

  useEffect(() => {
    let frame = 0;
    const place = () => {
      const node = region.current;
      const rect = ritualMotion.pageRect;
      if (node) {
        if (rect.visible) {
          const pageWidth = rect.right - rect.left;
          const pageHeight = rect.bottom - rect.top;
          const width = pageWidth * REGION_WIDTH;
          node.style.left = `${(rect.left + (pageWidth - width) / 2) * 100}%`;
          node.style.width = `${width * 100}%`;
          node.style.top = `${(rect.top + pageHeight * REGION_TOP) * 100}%`;
          node.style.height = `${pageHeight * REGION_HEIGHT * 100}%`;
          node.style.setProperty("--pw", `${pageWidth * window.innerWidth}px`);
          node.style.visibility = "visible";
        } else {
          node.style.visibility = "hidden";
        }
      }
      frame = requestAnimationFrame(place);
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={region} className="pointer-events-none absolute z-10" style={{ visibility: "hidden" }}>
      <motion.div
        className="flex h-full flex-col items-center justify-center gap-[clamp(8px,calc(var(--pw)*0.03),16px)]"
        initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(4px)" }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      >
        <div className="flex items-center gap-3 text-ink-page/90">
          <span className="h-px w-[clamp(18px,calc(var(--pw)*0.1),48px)] bg-current opacity-60" />
          <span className="font-serif text-[clamp(15px,calc(var(--pw)*0.048),22px)] font-medium italic">{messages.share.storyHeading}</span>
          <span className="h-px w-[clamp(18px,calc(var(--pw)*0.1),48px)] bg-current opacity-60" />
        </div>

        <div className="flex gap-[clamp(12px,calc(var(--pw)*0.05),26px)]">
          {SHARE_KINDS.filter((kind) => kind === "image" || videoAvailable).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={onShare(kind)}
              onPointerDown={stopPointer}
              disabled={busy !== null}
              aria-label={messages.share[`${kind}Aria`]}
              aria-busy={busy === kind}
              className="focus-ring group pointer-events-auto flex flex-col items-center gap-1.5 rounded-2xl disabled:opacity-60"
            >
              <span className="grid size-[clamp(46px,calc(var(--pw)*0.13),64px)] place-items-center rounded-full border-[1.5px] border-[#6b4520]/80 bg-[#f6e7c4]/30 text-[#3a220c] shadow-[inset_0_1px_2px_rgba(80,50,20,0.25),0_1px_0_rgba(255,245,220,0.5)] transition-all duration-300 group-hover:scale-105 group-hover:border-[#b8893a] group-hover:bg-[#d9b25e]/40 group-active:scale-95">
                <ShareIcon kind={kind} className="size-[46%]" />
              </span>
              <span className="font-serif text-[clamp(13px,calc(var(--pw)*0.038),15px)] font-medium text-ink-page">
                {busy === kind ? messages.share.preparing : messages.share[kind]}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
