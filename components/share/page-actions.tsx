"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ritualMotion } from "@/lib/ritual-store";
import { SHARE_CTA, SHARE_LABELS, type ShareTarget } from "@/lib/share";
import { ShareIcon } from "./share-icons";

const SHARE_TARGETS: ShareTarget[] = ["instagram", "tiktok", "whatsapp"];
const REGION_TOP = 0.555;
const REGION_HEIGHT = 0.31;
const REGION_WIDTH = 0.82;

type PageActionsProps = {
  onShare: (target: ShareTarget) => (event: React.MouseEvent) => void;
  onAskAgain: (event: React.MouseEvent) => void;
};

const stopPointer = (event: React.PointerEvent) => event.stopPropagation();

export function PageActions({ onShare, onAskAgain }: PageActionsProps) {
  const region = useRef<HTMLDivElement>(null);

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
          <span className="font-serif text-[clamp(15px,calc(var(--pw)*0.048),22px)] font-medium italic">Bu anı story yap</span>
          <span className="h-px w-[clamp(18px,calc(var(--pw)*0.1),48px)] bg-current opacity-60" />
        </div>

        <div className="flex gap-[clamp(12px,calc(var(--pw)*0.05),26px)]">
          {SHARE_TARGETS.map((target) => (
            <button
              key={target}
              type="button"
              onClick={onShare(target)}
              onPointerDown={stopPointer}
              aria-label={SHARE_CTA[target]}
              className="focus-ring group pointer-events-auto flex flex-col items-center gap-1.5 rounded-2xl"
            >
              <span className="grid size-[clamp(46px,calc(var(--pw)*0.13),64px)] place-items-center rounded-full border-[1.5px] border-[#6b4520]/80 bg-[#f6e7c4]/30 text-[#3a220c] shadow-[inset_0_1px_2px_rgba(80,50,20,0.25),0_1px_0_rgba(255,245,220,0.5)] transition-all duration-300 group-hover:scale-105 group-hover:border-[#b8893a] group-hover:bg-[#d9b25e]/40 group-active:scale-95">
                <ShareIcon target={target} className="size-[46%]" />
              </span>
              <span className="font-serif text-[clamp(12px,calc(var(--pw)*0.036),15px)] font-medium text-ink-page">
                {SHARE_LABELS[target]}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onAskAgain}
          onPointerDown={stopPointer}
          className="btn-gold focus-ring pointer-events-auto min-h-[clamp(44px,calc(var(--pw)*0.11),52px)]! px-[clamp(22px,calc(var(--pw)*0.09),40px)]! text-[clamp(16px,calc(var(--pw)*0.05),22px)]!"
        >
          Yeni soru sor
        </button>
      </motion.div>
    </div>
  );
}
