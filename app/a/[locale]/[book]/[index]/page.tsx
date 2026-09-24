import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArcanaSeal } from "@/components/brand/arcana-seal";
import { BRAND_NAME } from "@/lib/brand";
import { resolveSharedAnswer } from "@/lib/answer-link";

type AnswerPageProps = {
  params: Promise<{ locale: string; book: string; index: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function load({ params, searchParams }: AnswerPageProps) {
  const [{ locale, book, index }, query] = await Promise.all([params, searchParams]);
  return resolveSharedAnswer(locale, book, index, firstValue(query.q));
}

export async function generateMetadata(props: AnswerPageProps): Promise<Metadata> {
  const shared = await load(props);
  if (!shared) notFound();
  const copy = shared.messages.answerPage;
  const image = new URLSearchParams({ l: shared.locale, b: shared.bookId, i: String(shared.index) });
  if (shared.question) image.set("q", shared.question);
  const title = `${copy.title(shared.text)} · ${BRAND_NAME}`;
  const description = copy.description(shared.question);
  const images = [{ url: `/api/og/answer?${image.toString()}`, width: 1200, height: 630, alt: shared.text }];
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, images, type: "article", locale: shared.locale === "tr" ? "tr_TR" : "en_US" },
    twitter: { card: "summary_large_image", title, description, images: images.map((item) => item.url) },
  };
}

export default async function SharedAnswerPage(props: AnswerPageProps) {
  const shared = await load(props);
  if (!shared) notFound();
  const copy = shared.messages.answerPage;
  const home = `/?utm_source=answer_page&utm_medium=share&utm_content=${encodeURIComponent(shared.bookId)}`;

  return (
    <main
      lang={shared.locale}
      className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-[radial-gradient(ellipse_at_50%_35%,#3a2412_0%,#140c07_55%,#060505_100%)] px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),2rem)] text-center"
    >
      <header className="flex flex-col items-center gap-2">
        <div className="drop-shadow-[0_0_16px_rgba(236,208,138,0.4)]">
          <ArcanaSeal className="size-12" />
        </div>
        <p className="text-label font-medium uppercase text-gold-bright/90">{BRAND_NAME}</p>
      </header>

      <article className="relative w-full max-w-md rounded-[1.75rem] bg-[linear-gradient(160deg,#f3e6c6_0%,#e6d3a6_55%,#d6bd86_100%)] px-7 py-10 text-[#3e250d] shadow-[0_30px_80px_rgba(0,0,0,0.6),inset_0_0_60px_rgba(120,80,30,0.25)]">
        <div className="pointer-events-none absolute inset-3 rounded-[1.35rem] border border-[#8a5a24]/35" aria-hidden />
        <p className="font-serif text-base italic text-[#6a4a24]">{shared.bookTitle}</p>
        {shared.question && (
          <p className="mt-5 text-balance font-serif text-2xl italic text-[#7a1f16]">“{shared.question}”</p>
        )}
        <span className="mx-auto mt-6 block h-px w-32 bg-gradient-to-r from-transparent via-[#8a5a24] to-transparent" aria-hidden />
        <h1 className="mt-6 text-balance font-serif text-4xl italic leading-tight sm:text-5xl">{shared.text}</h1>
        <p className="mt-6 text-sm text-[#6a4a24]">{shared.question ? copy.intro(BRAND_NAME) : copy.introNoQuestion(BRAND_NAME)}</p>
      </article>

      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <p className="text-hint text-balance">{copy.explainer}</p>
        <Link href={home} className="btn-gold focus-ring w-full min-h-14! text-xl!">
          {copy.cta}
        </Link>
        <p className="text-xs text-parchment/70">
          {copy.note} ·{" "}
          <Link href="/gizlilik" className="underline decoration-parchment/40 underline-offset-2 hover:text-parchment">
            {shared.messages.privacy.link}
          </Link>
        </p>
      </div>
    </main>
  );
}
