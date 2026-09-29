import { ImageResponse } from "next/og";
import { BRAND_NAME_UPPER } from "@/lib/brand";
import { BrandSymbolImage } from "@/lib/brand-image";
import { resolveSharedAnswer } from "@/lib/answer-link";

const SIZE = { width: 1200, height: 630 };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const shared = await resolveSharedAnswer(params.get("l") ?? "", params.get("b") ?? "", params.get("i") ?? "", params.get("q"));
  if (!shared) return new Response("Not found", { status: 404 });

  const answerSize = shared.text.length > 48 ? 54 : 66;
  const headers = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };

  if (shared.card) {
    const cardSrc = new URL(shared.card.image, request.url).toString();
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: 64,
            padding: "0 80px",
            background: "radial-gradient(ellipse at 40% 45%, #3a1838 0%, #14080f 55%, #060505 100%)",
            color: "#efe3c8",
          }}
        >
          <img
            src={cardSrc}
            width={300}
            height={517}
            alt=""
            style={{ border: "6px solid #f3e6c6", boxShadow: "0 20px 50px rgba(0,0,0,0.7)" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <BrandSymbolImage size={52} />
              <div style={{ fontSize: 26, letterSpacing: 10, color: "#ecd08a" }}>{BRAND_NAME_UPPER}</div>
            </div>
            <div style={{ fontSize: 24, color: "rgba(239,227,200,0.75)" }}>{shared.bookTitle}</div>
            {shared.question ? (
              <div style={{ fontSize: 30, fontStyle: "italic", color: "rgba(239,227,200,0.9)" }}>{`“${shared.question}”`}</div>
            ) : null}
            <div style={{ fontSize: 30, letterSpacing: 6, color: "#ecd08a" }}>{shared.card.label}</div>
            <div style={{ fontSize: shared.text.length > 60 ? 42 : 50, color: "#f4e2b4", lineHeight: 1.2 }}>{shared.text}</div>
          </div>
        </div>
      ),
      { ...SIZE, headers },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          padding: "0 90px",
          background: "radial-gradient(ellipse at 50% 42%, #3a2412 0%, #140c07 55%, #060505 100%)",
          color: "#efe3c8",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <BrandSymbolImage size={64} />
          <div style={{ fontSize: 30, letterSpacing: 12, color: "#ecd08a" }}>{BRAND_NAME_UPPER}</div>
        </div>
        <div style={{ fontSize: 26, color: "rgba(239,227,200,0.75)" }}>{shared.bookTitle}</div>
        {shared.question ? (
          <div style={{ fontSize: 34, fontStyle: "italic", color: "rgba(239,227,200,0.9)", maxWidth: 1000 }}>{`“${shared.question}”`}</div>
        ) : null}
        <div style={{ width: 280, height: 2, background: "linear-gradient(90deg, rgba(236,208,138,0), #ecd08a, rgba(236,208,138,0))" }} />
        <div style={{ fontSize: answerSize, color: "#f4e2b4", lineHeight: 1.2, maxWidth: 1020 }}>{shared.text}</div>
      </div>
    ),
    { ...SIZE, headers },
  );
}
