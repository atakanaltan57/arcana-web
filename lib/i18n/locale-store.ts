import { useSyncExternalStore } from "react";
import { en } from "./messages/en";
import { tr, type Messages } from "./messages/tr";

export type Locale = "tr" | "en";

const STORAGE_KEY = "arcana-locale";
const MESSAGES: Record<Locale, Messages> = { tr, en };

let locale: Locale = "tr";
let hydrated = false;
const listeners = new Set<() => void>();

function isLocale(value: unknown): value is Locale {
  return value === "tr" || value === "en";
}

export function detectLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch (error) {
    console.error("Locale preference could not be read", error);
  }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => language?.toLowerCase().startsWith("tr")) ? "tr" : "en";
}

function apply(next: Locale) {
  locale = next;
  document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}

export const localeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => locale,
  getServerSnapshot: (): Locale => "tr",
  hydrate() {
    if (hydrated) return;
    hydrated = true;
    const detected = detectLocale();
    if (detected !== locale) apply(detected);
    else document.documentElement.lang = detected;
  },
  set(next: Locale) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      console.error("Locale preference could not be saved", error);
    }
    if (next !== locale) apply(next);
  },
  toggle() {
    localeStore.set(locale === "tr" ? "en" : "tr");
  },
};

export function getMessages(): Messages {
  return MESSAGES[locale];
}

export function useLocale() {
  return useSyncExternalStore(localeStore.subscribe, localeStore.getSnapshot, localeStore.getServerSnapshot);
}

export function useMessages(): Messages {
  return MESSAGES[useLocale()];
}
