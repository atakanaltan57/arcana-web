import { pickAnswer, type PickedAnswer } from "@/lib/answers/pick-answer";

export type RitualPhase = "idle" | "charging" | "opening" | "revealed" | "closing" | "portal" | "departed";

export type RitualSnapshot = {
  phase: RitualPhase;
  answer: PickedAnswer | null;
};

export const CHARGE_SECONDS = 2.3;
export const OPENING_SECONDS = 7.6;
export const UNDERPAGE_HOLD = 4;
export const CLOSING_SECONDS = 8.3 + UNDERPAGE_HOLD;
export const PORTAL_SECONDS = 7.6;
export const PORTAL_GROW_SECONDS = 2.8;
export const PORTAL_TUNNEL_START = 4.1;

export const ritualMotion = {
  charge: 0,
  phaseTime: 0,
  open: 0,
  hover: 0,
  attract: 0,
  burst: 0,
  burnClock: -1,
  burnOriginU: 0.9,
  burnOriginV: 0.08,
  burnId: 0,
  ignite: 1.2,
  flash: 0,
  pageRect: { left: 0, top: 0, right: 0, bottom: 0, visible: false },
  glint: [1.5, 3.4, 3.2] as [number, number, number],
  portalReady: false,
  vortex: 0,
  dive: 0,
  tunnel: 0,
  attractCenter: [0, 0.7, 0] as [number, number, number],
};

function resetMotion() {
  ritualMotion.charge = 0;
  ritualMotion.open = 0;
  ritualMotion.attract = 0;
  ritualMotion.burst = 0;
  ritualMotion.burnClock = -1;
  ritualMotion.flash = 0;
  ritualMotion.portalReady = false;
  ritualMotion.vortex = 0;
  ritualMotion.dive = 0;
  ritualMotion.tunnel = 0;
  ritualMotion.attractCenter = [0, 0.7, 0];
}

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
  enterPortal() {
    if (snapshot.phase !== "closing" || !ritualMotion.portalReady) return false;
    ritualMotion.portalReady = false;
    emit({ phase: "portal", answer: snapshot.answer });
    return true;
  },
  depart() {
    if (snapshot.phase !== "portal") return;
    emit({ phase: "departed", answer: null });
  },
  reset() {
    resetMotion();
    if (snapshot.phase !== "idle") emit({ phase: "idle", answer: null });
  },
};
