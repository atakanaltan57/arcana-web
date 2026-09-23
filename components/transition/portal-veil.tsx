"use client";

import { useEffect, useRef } from "react";
import { ritualMotion } from "@/lib/ritual-store";

type PortalVeilProps = {
  hold: boolean;
};

export function PortalVeil({ hold }: PortalVeilProps) {
  const veil = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (veil.current) {
        const t = ritualMotion.tunnel;
        const k = hold ? 1 : Math.min(1, Math.max(0, (t - 0.84) / 0.16));
        veil.current.style.opacity = String(k * k);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hold]);

  return (
    <div
      ref={veil}
      className="pointer-events-none absolute inset-0 z-40 bg-[radial-gradient(circle_at_50%_50%,#fffaf0_0%,#f3d9a0_35%,#c9a24b_70%,#6b4a1a_100%)]"
      style={{ opacity: 0 }}
    />
  );
}
