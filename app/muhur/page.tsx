import type { Metadata } from "next";
import { GateExperience } from "@/components/gate/gate-experience";

export const metadata: Metadata = {
  title: "Mühür Kapısı · ARCANA",
  description: "Kadim satırları çözenlerin kapısı.",
  robots: { index: false, follow: false },
};

export default function SealPage() {
  return <GateExperience />;
}
