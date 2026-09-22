"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ritualMotion } from "@/lib/ritual-store";
import { SHARE_CTA, type ShareTarget } from "@/lib/share";
import { ShareIcon } from "./share-icons";

const SHARE_TARGETS: ShareTarget[] = ["instagram", "tiktok", "whatsapp"];
const REGION_TOP = 0.6;
const REGION_HEIGHT = 0.25;
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
        className="flex h-full flex-col items-center justify-center gap-[clamp(10px,calc(var(--pw)*0.04),22px)]"
        initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(4px)" }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      >
        <div className="flex items-center gap-3 text-[#5b3a1a]/80">
          <span className="h-px w-[clamp(18px,calc(var(--pw)*0.1),48px)] bg-current opacity-50" />
          <span className="font-serif text-[clamp(14px,calc(var(--pw)*0.045),21px)] italic">Hikaye olarak paylaş</span>
          <span className="h-px w-[clamp(18px,calc(var(--pw)*0.1),48px)] bg-current opacity-50" />
        </div>

        <div className="flex gap-[clamp(12px,calc(var(--pw)*0.05),26px)]">
          {SHARE_TARGETS.map((target) => (
            <button
              key={target}
              type="button"
              onClick={onShare(target)}
              onPointerDown={stopPointer}
              aria-label={SHARE_CTA[target]}
              className="pointer-events-auto grid size-[clamp(46px,calc(var(--pw)*0.15),70px)] place-items-center rounded-full border-[1.5px] border-[#7a5426]/60 bg-[#f6e7c4]/25 text-[#4a2c12] shadow-[inset_0_1px_2px_rgba(80,50,20,0.25)] transition-all duration-300 hover:scale-105 hover:border-[#b8893a] hover:bg-[#d9b25e]/35 active:scale-95"
            >
              <ShareIcon target={target} className="size-[45%]" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onAskAgain}
          onPointerDown={stopPointer}
          className="pointer-events-auto rounded-full bg-gradient-to-b from-[#e8c983] via-[#c49b46] to-[#8d6726] px-[clamp(22px,calc(var(--pw)*0.09),40px)] py-[clamp(10px,calc(var(--pw)*0.03),15px)] font-serif text-[clamp(16px,calc(var(--pw)*0.05),23px)] font-semibold tracking-wide text-[#2a1806] shadow-[0_2px_10px_rgba(60,30,5,0.35),inset_0_1px_0_rgba(255,240,200,0.7)] transition-transform duration-300 hover:scale-[1.04] active:scale-95"
        >
          Yeni soru sor
        </button>
      </motion.div>
    </div>
  );
}
