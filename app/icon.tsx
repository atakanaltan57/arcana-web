import { ImageResponse } from "next/og";
import { BrandAppIcon } from "@/lib/brand-image";

const SIZES = [64, 192, 512] as const;

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default function Icon({ id }: { id: string }) {
  const size = Number(id);
  if (!SIZES.includes(size as (typeof SIZES)[number])) {
    throw new Error(`Unsupported icon size: ${id}`);
  }
  return new ImageResponse(<BrandAppIcon size={size} rounded={size < 128} />, { width: size, height: size });
}
