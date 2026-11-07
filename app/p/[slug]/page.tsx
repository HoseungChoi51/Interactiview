import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import TopBar from "@/app/TopBar";
import { getPersona } from "@/lib/personas";
import { store } from "@/lib/store";
import type { ReactionKind } from "@/lib/types";
import { currentVisitor } from "@/lib/visitor";
import Chat from "./Chat";

export const dynamic = "force-dynamic";

/** 원고의 자기소개 첫 문단(없으면 한 줄 소개)으로 첫 인사를 만듭니다. */
function greetingFrom(intro: string | undefined, name: string, tagline: string): string {
  const first = (intro ?? "").split(/\n\s*\n/).map((s) => s.trim()).find(Boolean);
  const body = (first ?? (tagline ? `“${tagline}”라는 이야기를 썼어요.` : "")).replace(/\*\*/g, "").replace(/〔\d+〕/g, "");
  return `안녕하세요, ${name}입니다. ${body} 궁금한 걸 편하게 물어보세요.`.replace(/\s+/g, " ");
}

export default async function PersonaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const visitor = await currentVisitor();
  if (!visitor) redirect("/join");
  const p = getPersona(slug);
  if (!p) notFound();

  const [conv, reactions] = await Promise.all([store().listConversation(visitor.id, slug), store().listReactionsByVisitor(visitor.id)]);
  const byMsg: Record<string, ReactionKind[]> = {};
  for (const r of reactions) (byMsg[r.messageId] ??= []).push(r.kind);

  return (
    <>
      <TopBar
        right={
          <Link href={`/p/${slug}/read`} className="btn">
            원문 읽기
          </Link>
        }
      />
      <main className="wrap narrow">
        <div className="chat-head" style={{ marginTop: 12 }}>
          <div className="avatar">{p.name.slice(0, 1)}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{p.name}</div>
            <div className="small muted">{p.role}</div>
          </div>
        </div>
        <Chat
          slug={slug}
          name={p.name.replace(/\s*\(.*\)\s*$/, "")}
          greeting={greetingFrom(p.passages.find((x) => x.id.endsWith("-intro"))?.text, p.name.replace(/\s*\(.*\)\s*$/, ""), p.tagline)}
          samples={p.sampleQuestions.slice(0, 3)}
          initial={conv}
          initialReactions={byMsg}
        />
      </main>
    </>
  );
}
