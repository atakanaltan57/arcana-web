import { BRAND_NAME, shareUrl } from "@/lib/brand";
import { getMessages } from "@/lib/i18n/locale-store";
import type { StoryVideo } from "@/lib/story-recorder";

export type ShareKind = "image" | "video";

export type ShareOutcome = "shared" | "downloaded" | "copied" | "cancelled" | "in-app";

const IN_APP_PATTERN = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat|Twitter/i;

export function isInAppBrowser() {
  return typeof navigator !== "undefined" && IN_APP_PATTERN.test(navigator.userAgent);
}

export function shareText(answer: string, question = "") {
  const { share } = getMessages();
  const text = question ? share.textWithQuestion(BRAND_NAME, question, answer) : share.text(BRAND_NAME, answer);
  const url = shareUrl("answer");
  return url ? `${text}\n${url}` : text;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadStory(video: StoryVideo) {
  downloadBlob(video.blob, `${getMessages().share.fileName}.${video.extension}`);
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function shareFile(file: File, text: string): Promise<ShareOutcome> {
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
      throw error;
    }
  }
  if (isInAppBrowser()) return "in-app";
  downloadBlob(file, file.name);
  return "downloaded";
}

export async function shareAnswerCard(card: Blob, answer: string, question: string): Promise<ShareOutcome> {
  const file = new File([card], `${getMessages().share.fileName}.png`, { type: "image/png" });
  return shareFile(file, shareText(answer, question));
}

export async function shareStory(video: StoryVideo | null, answer: string, question: string): Promise<ShareOutcome> {
  const text = shareText(answer, question);

  if (video) {
    const file = new File([video.blob], `${getMessages().share.fileName}.${video.extension}`, { type: video.mimeType });
    return shareFile(file, text);
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
  await navigator.clipboard.writeText(text);
  return "copied";
}
