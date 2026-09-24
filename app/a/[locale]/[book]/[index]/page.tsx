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
      className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-[radial-gradient(ellipse_at_50%_40%,#2a1a0c_0%,#0b0c10_65%)] px-6 py-12 text-center"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="drop-shadow-[0_0_16px_rgba(236,208,138,0.4)]">
          <ArcanaSeal className="size-16" />
        </div>
        <p className="text-label font-medium uppercase text-gold-bright/90">{BRAND_NAME}</p>
        <p className="font-serif text-lg italic text-parchment/85">{shared.bookTitle}</p>
      </div>

      <div className="flex max-w-xl flex-col items-center gap-6">
        <p className="text-hint">{shared.question ? copy.intro(BRAND_NAME) : copy.introNoQuestion(BRAND_NAME)}</p>
        {shared.question && (
          <p className="text-balance font-serif text-2xl italic text-parchment/90">“{shared.question}”</p>
        )}
        <span className="h-px w-40 bg-gradient-to-r from-transparent via-gold-bright to-transparent" aria-hidden />
        <h1 className="text-balance font-serif text-4xl italic leading-tight text-gold-bright [text-shadow:0_2px_24px_rgba(236,208,138,0.25)] sm:text-5xl">
          {shared.text}
        </h1>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link href={home} className="btn-gold focus-ring px-10">
          {copy.cta}
        </Link>
        <p className="text-sm text-parchment/80">{copy.note}</p>
      </div>
    </main>
  );
}
