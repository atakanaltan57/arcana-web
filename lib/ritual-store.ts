import { pickAnswer, type PickedAnswer } from "@/lib/answers/pick-answer";

export type RitualPhase = "idle" | "charging" | "opening" | "revealed" | "closing";

export type RitualSnapshot = {
  phase: RitualPhase;
  answer: PickedAnswer | null;
};

export const CHARGE_SECONDS = 1.9;
export const OPENING_SECONDS = 5.2;
export const CLOSING_SECONDS = 1.3;

export const ritualMotion = {
  charge: 0,
  phaseTime: 0,
  open: 0,
  hover: 0,
  attract: 0,
  burst: 0,
};

let snapshot: RitualSnapshot = { phase: "idle", answer: null };
const serverSnapshot: RitualSnapshot = { phase: "idle", answer: null };
const listeners = new Set<() => void>();

function emit(next: RitualSnapshot) {
  snapshot = next;
  ritualMotion.phaseTime = 0;
  listeners.forEach((listener) => listener());
}

export const ritualStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  getServerSnapshot: () => serverSnapshot,
  begin() {
    if (snapshot.phase !== "idle") return false;
    emit({ phase: "charging", answer: null });
    return true;
  },
  open() {
    if (snapshot.phase !== "charging") return;
    emit({ phase: "opening", answer: pickAnswer() });
  },
  reveal() {
    if (snapshot.phase !== "opening") return;
    emit({ phase: "revealed", answer: snapshot.answer });
  },
  close() {
    if (snapshot.phase !== "revealed") return;
    emit({ phase: "closing", answer: snapshot.answer });
  },
  settle() {
    if (snapshot.phase !== "closing") return;
    ritualMotion.charge = 0;
    emit({ phase: "idle", answer: null });
  },
};
