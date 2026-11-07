import Link from "next/link";
import { marked } from "marked";
import { notFound } from "next/navigation";
import TopBar from "@/app/TopBar";
import { personaWithAnswers } from "@/lib/service";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/** 원고 전문. 다른 독자들이 많이 공감한 문단을 은은하게 표시합니다. */
export default async function ReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await personaWithAnswers(slug);
  if (!p) notFound();

  const [msgs, reactions] = await Promise.all([store().listAllMessages(), store().listReactions()]);
  const resonated = new Set(reactions.filter((r) => r.kind === "resonate").map((r) => r.messageId));
  const heat: Record<string, number> = {};
  for (const m of msgs) {
    if (m.persona !== slug || !resonated.has(m.id)) continue;
    for (const c of m.citations) heat[c.passageId] = (heat[c.passageId] ?? 0) + 1;
  }

  return (
    <>
      <TopBar
        right={
          <Link href={`/p/${slug}`} className="btn primary">
            대화하기
          </Link>
        }
      />
      <main className="wrap narrow reading serif">
        <h1>{p.name}</h1>
        <div className="muted small" style={{ fontFamily: "inherit" }}>
          {p.role}
        </div>
        {p.passages.map((x) => (
          <section key={x.id} id={x.id} className={heat[x.id] >= 2 ? "hot" : ""}>
            {!x.id.endsWith("-intro") && (
              <h3>
                {x.question}
                {x.extra && <span className="badge">독자 질문에 추가로 답함</span>}
                {heat[x.id] >= 2 && <span className="badge">독자 {heat[x.id]}명이 공감</span>}
              </h3>
            )}
            {x.extra ? (
              // 서비스에서 입력받은 답변은 HTML 로 해석하지 않고 그대로 보여줍니다.
              <p style={{ whiteSpace: "pre-wrap" }}>{x.text}</p>
            ) : (
              // 원고 MD 는 저장소에 들어 있는 신뢰할 수 있는 내용입니다.
              <div dangerouslySetInnerHTML={{ __html: marked.parse(x.text, { async: false }) as string }} />
            )}
          </section>
        ))}
      </main>
    </>
  );
}
