"use client";

import { useEffect } from "react";
import { useProgress } from "@react-three/drei";
import { loadProgressStore } from "@/lib/load-progress";

export function LoadProgressBridge() {
  const progress = useProgress((state) => state.progress);
  const active = useProgress((state) => state.active);

  useEffect(() => {
    loadProgressStore.set({ progress, active });
  }, [progress, active]);

  return null;
}
