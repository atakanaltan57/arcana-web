import {
  BRAND_NAME,
  BRAND_SYMBOL_FILL_PATH,
  BRAND_SYMBOL_STROKE_PATH,
  BRAND_SYMBOL_STROKE_WIDTH,
  BRAND_SYMBOL_VIEWBOX,
  BRAND_TAGLINE,
} from "@/lib/brand";

type BrandSymbolImageProps = {
  size: number;
  strokeScale?: number;
};

export function BrandSymbolImage({ size, strokeScale = 1 }: BrandSymbolImageProps) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${BRAND_SYMBOL_VIEWBOX} ${BRAND_SYMBOL_VIEWBOX}`}>
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dc9a" />
          <stop offset="0.5" stopColor="#c9a24b" />
          <stop offset="1" stopColor="#e2c27a" />
        </linearGradient>
      </defs>
      <path
        d={BRAND_SYMBOL_STROKE_PATH}
        fill="none"
        stroke="url(#gold)"
        strokeWidth={BRAND_SYMBOL_STROKE_WIDTH * strokeScale}
        strokeLinecap="round"
      />
      <path d={BRAND_SYMBOL_FILL_PATH} fill="#fff4dc" />
    </svg>
  );
}

export function BrandAppIcon({ size, rounded = true }: { size: number; rounded?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 45%, #1a1712 0%, #0b0c10 70%)",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <BrandSymbolImage size={size * 0.84} strokeScale={size < 64 ? 1.6 : 1.1} />
    </div>
  );
}

export function BrandShareCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        background: "radial-gradient(ellipse at 50% 40%, #2a1a0c 0%, #0b0c10 65%)",
        color: "#efe3c8",
      }}
    >
      <BrandSymbolImage size={220} />
      <div style={{ fontSize: 84, letterSpacing: 28, color: "#ecd08a", paddingLeft: 28 }}>{BRAND_NAME}</div>
      <div style={{ fontSize: 36, fontStyle: "italic", color: "#efe3c8", opacity: 0.85 }}>{BRAND_TAGLINE}</div>
    </div>
  );
}
