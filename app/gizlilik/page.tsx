import type { Metadata } from "next";
import { PrivacyContent } from "@/components/legal/privacy-content";
import { BRAND_NAME } from "@/lib/brand";
import { tr } from "@/lib/i18n/messages/tr";

export const metadata: Metadata = {
  title: `${tr.privacy.title} · ${BRAND_NAME}`,
  description: tr.privacy.sections[1].body,
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
