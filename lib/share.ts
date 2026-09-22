import { BRAND_NAME } from "@/lib/brand";
import type { StoryVideo } from "@/lib/story-recorder";

export type ShareTarget = "instagram" | "tiktok" | "whatsapp";

export type ShareOutcome = "shared" | "downloaded" | "copied" | "cancelled";

export const SHARE_LABELS: Record<ShareTarget, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export const SHARE_CTA: Record<ShareTarget, string> = {
  instagram: "Instagram'da paylaş",
  tiktok: "TikTok'ta paylaş",
  whatsapp: "WhatsApp'ta paylaş",
};

export function shareText(answer: string) {
  return `${BRAND_NAME} bana şunu söyledi: “${answer}”`;
}

export function downloadStory(video: StoryVideo) {
  const url = URL.createObjectURL(video.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `arcana-cevap.${video.extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function openWhatsAppText(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function shareStory(video: StoryVideo | null, target: ShareTarget, answer: string): Promise<ShareOutcome> {
  const text = shareText(answer);

  if (video) {
    const file = new File([video.blob], `arcana-cevap.${video.extension}`, { type: video.mimeType });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return "shared";
      } catch (error) {
        if (isAbort(error)) return "cancelled";
        throw error;
      }
    }
    downloadStory(video);
    if (target === "whatsapp") openWhatsAppText(text);
    return "downloaded";
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
      throw error;
    }
  }
  if (target === "whatsapp") {
    openWhatsAppText(text);
    return "shared";
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
