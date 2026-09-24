"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useProgress } from "@react-three/drei";
import { ArcanaSeal } from "./arcana-seal";

type AwakeningVeilProps = {
  visible: boolean;
  label: string;
  background?: string;
};

export function AwakeningVeil({ visible, label, background = "bg-[#050608]" }: AwakeningVeilProps) {
  const progress = useProgress((state) => state.progress);
  const loading = useProgress((state) => state.active);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="awakening"
          className={`pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 ${background}`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.8, ease: "easeOut" } }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="drop-shadow-[0_0_18px_rgba(236,208,138,0.35)]"
            animate={{ opacity: [0.55, 1, 0.55], scale: [0.97, 1, 0.97] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArcanaSeal className="size-20" />
          </motion.div>
          <p className="font-serif text-2xl italic text-parchment/90">{label}</p>
          <div className="h-px w-36 overflow-hidden bg-gold/15">
            <div
              className="h-full origin-left bg-gradient-to-r from-gold/40 via-gold-bright to-gold/40 transition-transform duration-500"
              style={{ transform: `scaleX(${loading || progress < 100 ? Math.max(0.05, progress / 100) : 1})` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
