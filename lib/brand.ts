import { tr } from "@/lib/i18n/messages/tr";

export const BRAND_NAME = "Arcana";

export const BRAND_NAME_UPPER = BRAND_NAME.toLocaleUpperCase("tr-TR");

export const BRAND_TAGLINE = tr.tagline;

export const BRAND_TITLE = `${BRAND_NAME} · ${tr.title}`;

export const BRAND_DESCRIPTION = tr.description;

const LOCAL_HOST_PATTERN = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/;

export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined" && !LOCAL_HOST_PATTERN.test(window.location.hostname)) return window.location.origin;
  return "";
}

export function shareUrl(source: string) {
  const base = siteUrl();
  return base ? `${base}/?utm_source=${source}&utm_medium=share` : "";
}

export const BRAND_SYMBOL_VIEWBOX = 100;

export const BRAND_SYMBOL_STROKE_WIDTH = 3;

function circle(cx: number, cy: number, r: number) {
  return `M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy}`;
}

export const BRAND_SYMBOL_STROKE_PATH = [
  circle(50, 50, 46),
  circle(32, 50, 28),
  circle(68, 50, 28),
  "M 50 31 Q 58.5 50 50 69 Q 41.5 50 50 31",
  "M 44.5 61 L 52.5 75",
  "M 55.5 61 L 47.5 75",
].join(" ");

export const BRAND_SYMBOL_FILL_PATH = "M 50 37 L 54.5 49 L 50 61 L 45.5 49 Z";
