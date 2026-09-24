import { useSyncExternalStore } from "react";

export type LoadProgress = {
  progress: number;
  active: boolean;
};

const initial: LoadProgress = { progress: 0, active: true };
let snapshot = initial;
const listeners = new Set<() => void>();

export const loadProgressStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  getServerSnapshot: () => initial,
  set(next: LoadProgress) {
    if (next.progress === snapshot.progress && next.active === snapshot.active) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  },
};

export function useLoadProgress() {
  return useSyncExternalStore(loadProgressStore.subscribe, loadProgressStore.getSnapshot, loadProgressStore.getServerSnapshot);
}
