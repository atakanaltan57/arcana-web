import { ImageResponse } from "next/og";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { BrandShareCard } from "@/lib/brand-image";

export const alt = `${BRAND_NAME} · ${BRAND_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<BrandShareCard />, size);
}
