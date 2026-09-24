import { pickAnswer, type PickedAnswer } from "@/lib/answers/pick-answer";
import { bookStore } from "@/lib/book-store";
import { getMessages } from "@/lib/i18n/locale-store";

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
export const REPEAT_TEMPO = 2.2;
export const QUICK_CLOSE_TEMPO = 2.4;
export const HURRY_TEMPO = 5;

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
  swapping: false,
  carouselDrag: 0,
  tempo: 1,
  portalLocked: false,
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

export const QUESTION_MAX_LENGTH = 90;

let pendingQuestion = "";
let completedRituals = 0;
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
  begin(question = "") {
    if (snapshot.phase !== "idle" || ritualMotion.swapping || !bookStore.getSnapshot().answers) return false;
    pendingQuestion = question.trim().replace(/\s+/g, " ").slice(0, QUESTION_MAX_LENGTH);
    ritualMotion.tempo = completedRituals > 0 ? REPEAT_TEMPO : 1;
    emit({ phase: "charging", answer: null });
    return true;
  },
  open() {
    if (snapshot.phase !== "charging") return;
    const { book, answers } = bookStore.getSnapshot();
    if (!answers) {
      console.error(`Answers for "${book.id}" are not loaded; ritual reset`);
      emit({ phase: "idle", answer: null });
      return;
    }
    emit({ phase: "opening", answer: pickAnswer({ locale: getMessages().locale, bookId: book.id, bookTitle: getMessages().books[book.id].title, answers, question: pendingQuestion }) });
  },
  reveal() {
    if (snapshot.phase !== "opening") return;
    ritualMotion.tempo = 1;
    emit({ phase: "revealed", answer: snapshot.answer });
  },
  close() {
    if (snapshot.phase !== "revealed") return;
    ritualMotion.tempo = completedRituals > 0 ? QUICK_CLOSE_TEMPO : 1;
    emit({ phase: "closing", answer: snapshot.answer });
  },
  settle() {
    if (snapshot.phase !== "closing") return;
    completedRituals += 1;
    ritualMotion.tempo = 1;
    ritualMotion.charge = 0;
    emit({ phase: "idle", answer: null });
  },
  enterPortal() {
    if (snapshot.phase !== "closing" || !ritualMotion.portalReady || ritualMotion.portalLocked) return false;
    ritualMotion.portalReady = false;
    ritualMotion.tempo = 1;
    emit({ phase: "portal", answer: snapshot.answer });
    return true;
  },
  hurry() {
    if (snapshot.phase !== "charging" && snapshot.phase !== "opening") return false;
    ritualMotion.tempo = Math.max(ritualMotion.tempo, HURRY_TEMPO);
    return true;
  },
  depart() {
    if (snapshot.phase !== "portal") return;
    emit({ phase: "departed", answer: null });
  },
  reset() {
    resetMotion();
    ritualMotion.tempo = 1;
    if (snapshot.phase !== "idle") emit({ phase: "idle", answer: null });
  },
};
