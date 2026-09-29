import type { Locale } from "@/lib/i18n/locale-store";

export type TarotCard = {
  index: number;
  numeral: string;
  name: Record<Locale, string>;
  image: string;
  shareImage: string;
};

const CARD_NAMES: [string, string][] = [
  ["Deli", "The Fool"],
  ["Büyücü", "The Magician"],
  ["Azize", "The High Priestess"],
  ["İmparatoriçe", "The Empress"],
  ["İmparator", "The Emperor"],
  ["Aziz", "The Hierophant"],
  ["Âşıklar", "The Lovers"],
  ["Savaş Arabası", "The Chariot"],
  ["Güç", "Strength"],
  ["Ermiş", "The Hermit"],
  ["Kader Çarkı", "Wheel of Fortune"],
  ["Adalet", "Justice"],
  ["Asılan Adam", "The Hanged Man"],
  ["Ölüm", "Death"],
  ["Denge", "Temperance"],
  ["Şeytan", "The Devil"],
  ["Kule", "The Tower"],
  ["Yıldız", "The Star"],
  ["Ay", "The Moon"],
  ["Güneş", "The Sun"],
  ["Mahkeme", "Judgement"],
  ["Dünya", "The World"],
];

const VEILED_IN_SHARES = new Set([6, 15, 17, 19]);

const NUMERALS = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

export const TAROT_DECK: TarotCard[] = CARD_NAMES.map(([tr, en], index) => {
  const file = String(index).padStart(2, "0");
  const image = `/tarot/${file}.jpg`;
  return {
    index,
    numeral: NUMERALS[index],
    name: { tr, en },
    image,
    shareImage: VEILED_IN_SHARES.has(index) ? `/tarot/${file}-veiled.jpg` : image,
  };
});

export const TAROT_BOOK_ID = "gizem";

export function tarotCardFor(bookId: string, index: number): TarotCard | null {
  if (bookId !== TAROT_BOOK_ID) return null;
  return TAROT_DECK[index] ?? null;
}

export function tarotLabel(card: TarotCard, locale: string) {
  const lang: Locale = locale === "en" ? "en" : "tr";
  return `${card.numeral} · ${card.name[lang].toLocaleUpperCase(lang)}`;
}
