import { ImageResponse } from "next/og";
import { BrandAppIcon } from "@/lib/brand-image";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandAppIcon size={64} />, size);
}
