import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPersonas } from "@/lib/personas";
import { store } from "@/lib/store";
import { currentVisitor } from "@/lib/visitor";
import Shelf from "./Shelf";
import TopBar from "./TopBar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const visitor = await currentVisitor();
  if (!visitor) redirect("/join");

  const personas = loadPersonas();
  const names = Object.fromEntries(personas.map((p) => [p.slug, p.name]));
  const [questions, votes, msgs] = await Promise.all([
    store().listQuestions(),
    store().listVotesByVisitor(visitor.id),
    store().listMessagesByVisitor(visitor.id),
  ]);
  const talked = new Set(msgs.map((m) => m.persona));
  const answered = questions.filter((q) => q.status === "answered").sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""));
  const unseen = new Set(votes.filter((v) => !v.seen).map((v) => v.questionId));
  const mine = answered.filter((q) => unseen.has(q.id));
  const recent = answered.filter((q) => !unseen.has(q.id)).slice(0, 5);
  // 이번에 보여준 새 답변은 본 것으로 표시합니다.
  if (mine.length) await store().markVotesSeen(visitor.id, mine.map((q) => q.id));

  return (
    <>
      <TopBar nickname={visitor.nickname} />
      <main className="wrap">
        <h1 className="serif">누구에게 먼저 물어볼까요?</h1>
        <p className="muted">커리어와 인생에 대해 궁금한 것을 자유롭게 물어보세요. 답은 그 사람이 직접 쓴 원고에서 옵니다.</p>

        {mine.length > 0 && (
          <>
            <h2>내 질문에 새 답변이 왔어요</h2>
            <div className="news">
              {mine.map((q) => (
                <Link key={q.id} href={`/p/${q.persona}/read#${q.persona}-a-${q.id.slice(0, 8)}`} className="card" style={{ textDecoration: "none", borderColor: "var(--accent)" }}>
                  <div className="small" style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {names[q.persona] ?? q.persona}님이 답했어요
                  </div>
                  <div style={{ fontWeight: 600 }}>{q.text}</div>
                  <div className="serif muted" style={{ marginTop: 6 }}>
                    {(q.answer ?? "").slice(0, 120)}
                    {(q.answer ?? "").length > 120 ? "…" : ""}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2>인터뷰이</h2>
        <Shelf
          items={personas.map((p) => ({ slug: p.slug, name: p.name, role: p.role, tagline: p.tagline, tags: p.tags, talked: talked.has(p.slug) }))}
        />

        {recent.length > 0 && (
          <>
            <h2>독자 질문에 새로 답했어요</h2>
            <div className="news">
              {recent.map((q) => (
                <Link key={q.id} href={`/p/${q.persona}/read#${q.persona}-a-${q.id.slice(0, 8)}`} className="card" style={{ textDecoration: "none" }}>
                  <div className="small muted">{names[q.persona] ?? q.persona}</div>
                  <div style={{ fontWeight: 600 }}>{q.text}</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
