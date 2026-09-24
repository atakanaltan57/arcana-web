import { BRAND_NAME } from "@/lib/brand";
import { ArcanaSeal } from "./arcana-seal";

type BrandMarkProps = {
  as?: "h1" | "p";
};

export function BrandMark({ as: Tag = "p" }: BrandMarkProps) {
  return (
    <Tag className="flex items-center gap-2.5 text-label font-medium uppercase text-gold-bright/90">
      <ArcanaSeal className="size-5" />
      {BRAND_NAME}
    </Tag>
  );
}
