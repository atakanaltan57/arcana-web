import type { Metadata } from "next";
import { GateExperience } from "@/components/gate/gate-experience";
import { BRAND_NAME } from "@/lib/brand";
import { tr } from "@/lib/i18n/messages/tr";

export const metadata: Metadata = {
  title: `${tr.gate.title} · ${BRAND_NAME}`,
  description: "Kadim satırları çözenlerin kapısı.",
  robots: { index: false, follow: false },
};

export default function SealPage() {
  return <GateExperience />;
}
