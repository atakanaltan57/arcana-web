import { BRAND_NAME, siteUrl } from "@/lib/brand";
import { answerPath } from "@/lib/answer-link";
import type { PickedAnswer } from "@/lib/answers/pick-answer";
import { getMessages } from "@/lib/i18n/locale-store";
import type { StoryVideo } from "@/lib/story-recorder";

export type ShareKind = "image" | "link" | "video";

export type ShareOutcome = "shared" | "downloaded" | "copied" | "cancelled" | "in-app";

const IN_APP_PATTERN = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat|Twitter/i;

export function isInAppBrowser() {
  return typeof navigator !== "undefined" && IN_APP_PATTERN.test(navigator.userAgent);
}

export function answerUrl(answer: PickedAnswer, source: string) {
  const base = siteUrl();
  if (!base) return "";
  const path = answerPath({ locale: answer.locale, bookId: answer.bookId, index: answer.index, question: answer.question });
  const joiner = path.includes("?") ? "&" : "?";
  return `${base}${path}${joiner}utm_source=${source}&utm_medium=share`;
}

function answerMessage(answer: PickedAnswer) {
  const { share } = getMessages();
  return answer.question ? share.textWithQuestion(BRAND_NAME, answer.question, answer.text) : share.text(BRAND_NAME, answer.text);
}

export function shareText(answer: PickedAnswer, source: string) {
  const text = answerMessage(answer);
  const url = answerUrl(answer, source);
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

async function shareTextOnly(text: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(url ? { text, url } : { text });
      return "shared";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
      throw error;
    }
  }
  await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
  return "copied";
}

export async function shareAnswerCard(card: Blob, answer: PickedAnswer): Promise<ShareOutcome> {
  const file = new File([card], `${getMessages().share.fileName}.png`, { type: "image/png" });
  return shareFile(file, shareText(answer, "card"));
}

export async function shareAnswerLink(answer: PickedAnswer): Promise<ShareOutcome> {
  return shareTextOnly(answerMessage(answer), answerUrl(answer, "link"));
}

export async function shareStory(video: StoryVideo | null, answer: PickedAnswer): Promise<ShareOutcome> {
  if (video) {
    const file = new File([video.blob], `${getMessages().share.fileName}.${video.extension}`, { type: video.mimeType });
    return shareFile(file, shareText(answer, "video"));
  }
  return shareTextOnly(answerMessage(answer), answerUrl(answer, "video"));
}
