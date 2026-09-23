import { useId } from "react";
import {
  BRAND_SYMBOL_FILL_PATH,
  BRAND_SYMBOL_STROKE_PATH,
  BRAND_SYMBOL_STROKE_WIDTH,
  BRAND_SYMBOL_VIEWBOX,
} from "@/lib/brand";

type ArcanaSealProps = {
  className?: string;
  gemClassName?: string;
};

export function ArcanaSeal({ className, gemClassName }: ArcanaSealProps) {
  const id = useId();
  const gold = `${id}-gold`;
  const gem = `${id}-gem`;
  return (
    <svg viewBox={`0 0 ${BRAND_SYMBOL_VIEWBOX} ${BRAND_SYMBOL_VIEWBOX}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dc9a" />
          <stop offset="0.45" stopColor="#c9a24b" />
          <stop offset="0.7" stopColor="#8a6424" />
          <stop offset="1" stopColor="#d9b867" />
        </linearGradient>
        <linearGradient id={gem} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#e9cf93" />
        </linearGradient>
      </defs>
      <path
        d={BRAND_SYMBOL_STROKE_PATH}
        fill="none"
        stroke={`url(#${gold})`}
        strokeWidth={BRAND_SYMBOL_STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path d={BRAND_SYMBOL_FILL_PATH} fill={`url(#${gem})`} className={gemClassName} />
    </svg>
  );
}
