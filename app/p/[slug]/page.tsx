import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import TopBar from "@/app/TopBar";
import { getPersona } from "@/lib/personas";
import { store } from "@/lib/store";
import type { ReactionKind } from "@/lib/types";
import { currentVisitor } from "@/lib/visitor";
import Chat from "./Chat";

export const dynamic = "force-dynamic";

/** 원고의 자기소개 첫 문단을 첫 인사로 씁니다. */
function greetingFrom(intro: string | undefined, name: string): string {
  const paras = (intro ?? "").split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const hello = paras.find((p) => /안녕|입니다|이에요|예요/.test(p) && !/예시입니다/.test(p)) ?? paras[0];
  return hello ?? `안녕하세요, ${name}입니다. 궁금한 걸 물어보세요.`;
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
          greeting={greetingFrom(p.passages.find((x) => x.id.endsWith("-intro"))?.text, p.name)}
          samples={p.sampleQuestions.slice(0, 3)}
          initial={conv}
          initialReactions={byMsg}
        />
      </main>
    </>
  );
}
