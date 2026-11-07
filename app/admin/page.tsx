import { revalidatePath } from "next/cache";
import { aiEnabled } from "@/lib/ai";
import { isAdmin } from "@/lib/admin";
import { intervieweeEmails, siteUrl } from "@/lib/mail";
import { loadPersonas } from "@/lib/personas";
import { store, usingSupabase } from "@/lib/store";
import { answerToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

async function setStatus(formData: FormData) {
  "use server";
  if (!(await isAdmin())) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (status === "hidden" || status === "open") await store().updateQuestion(id, { status });
  revalidatePath("/admin");
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="wrap narrow">
        <h1>관리 페이지</h1>
        <p className="muted">주소 끝에 ?key=관리키 를 붙여 들어와 주세요.</p>
      </main>
    );
  }

  const personas = loadPersonas();
  const names = Object.fromEntries(personas.map((p) => [p.slug, p.name]));
  const passageTitle = Object.fromEntries(personas.flatMap((p) => p.passages.map((x) => [x.id, `${p.name} · ${x.question}`])));
  const [visitors, msgs, reactions, questions] = await Promise.all([
    store().countVisitors(),
    store().listAllMessages(),
    store().listReactions(),
    store().listQuestions(),
  ]);
  const replies = msgs.filter((m) => m.role === "assistant");
  const userMsgs = msgs.filter((m) => m.role === "user");
  const msgById = new Map(msgs.map((m) => [m.id, m]));

  const perPersona = personas.map((p) => {
    const r = replies.filter((m) => m.persona === p.slug);
    const ids = new Set(r.map((m) => m.id));
    return {
      p,
      total: r.length,
      quote: r.filter((m) => m.kind === "quote").length,
      bridge: r.filter((m) => m.kind === "bridge").length,
      none: r.filter((m) => m.kind === "none").length,
      resonate: reactions.filter((x) => x.kind === "resonate" && ids.has(x.messageId)).length,
      open: questions.filter((q) => q.persona === p.slug && q.status === "open").length,
    };
  });

  const topicCount: Record<string, { n: number; none: number }> = {};
  for (const m of replies) for (const t of m.topics) {
    topicCount[t] ??= { n: 0, none: 0 };
    topicCount[t].n += 1;
    if (m.kind === "none") topicCount[t].none += 1;
  }
  const topics = Object.entries(topicCount).sort((a, b) => b[1].n - a[1].n).slice(0, 15);

  const passageHeat: Record<string, number> = {};
  for (const r of reactions) {
    if (r.kind !== "resonate") continue;
    for (const c of msgById.get(r.messageId)?.citations ?? []) passageHeat[c.passageId] = (passageHeat[c.passageId] ?? 0) + 1;
  }
  const hot = Object.entries(passageHeat).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const offs = reactions.filter((r) => r.kind === "off").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  const queue = questions.filter((q) => q.status === "open" || q.status === "hidden").sort((a, b) => b.votes - a.votes);
  const emails = intervieweeEmails();
  const secretOk = Boolean(process.env.ANSWER_SECRET);

  return (
    <main className="wrap">
      <h1>관리 페이지</h1>
      <p className="small muted">
        저장소: {usingSupabase ? "Supabase" : "이 컴퓨터의 SQLite 파일(.data/interactiview.db)"} · AI: {aiEnabled ? "Claude API" : "데모 모드(키 없음)"}
      </p>

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="card stat"><div className="n">{visitors}</div><div className="small muted">참여 독자</div></div>
        <div className="card stat"><div className="n">{userMsgs.length}</div><div className="small muted">질문</div></div>
        <div className="card stat"><div className="n">{pct(replies.filter((m) => m.kind === "none").length, replies.length)}</div><div className="small muted">원고에 답 없음</div></div>
        <div className="card stat"><div className="n">{reactions.filter((r) => r.kind === "resonate").length}</div><div className="small muted">공감</div></div>
        <div className="card stat"><div className="n">{questions.filter((q) => q.status === "open").length}</div><div className="small muted">인터뷰이 대기 질문</div></div>
      </div>

      <h2>인터뷰이별</h2>
      <table>
        <thead><tr><th>인터뷰이</th><th>답변</th><th>인용</th><th>연결</th><th>답 없음</th><th>공감</th><th>대기 질문</th></tr></thead>
        <tbody>
          {perPersona.map((x) => (
            <tr key={x.p.slug}>
              <td>{x.p.name}</td><td>{x.total}</td><td>{pct(x.quote, x.total)}</td><td>{pct(x.bridge, x.total)}</td><td>{pct(x.none, x.total)}</td><td>{x.resonate}</td><td>{x.open}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>독자들이 궁금해하는 주제</h2>
      <p className="small muted">&ldquo;답 없음&rdquo;이 많은 주제가 다음 에디션에 추가할 질문 후보예요.</p>
      <table>
        <thead><tr><th>주제</th><th>질문 수</th><th>답 없음</th></tr></thead>
        <tbody>
          {topics.map(([t, v]) => (<tr key={t}><td>{t}</td><td>{v.n}</td><td>{v.none}</td></tr>))}
          {!topics.length && (<tr><td colSpan={3} className="muted">아직 없어요</td></tr>)}
        </tbody>
      </table>

      <h2>많이 공감받은 문단</h2>
      <table>
        <thead><tr><th>문단</th><th>공감</th></tr></thead>
        <tbody>
          {hot.map(([id, n]) => (<tr key={id}><td>{passageTitle[id] ?? id}</td><td>{n}</td></tr>))}
          {!hot.length && (<tr><td colSpan={2} className="muted">아직 없어요</td></tr>)}
        </tbody>
      </table>

      <h2>&ldquo;답이 어긋났어요&rdquo; 신고</h2>
      <table>
        <thead><tr><th>인터뷰이</th><th>답변</th><th>메모</th></tr></thead>
        <tbody>
          {offs.map((r) => {
            const m = msgById.get(r.messageId);
            return (<tr key={r.id}><td>{m ? names[m.persona] : ""}</td><td>{m?.content.slice(0, 160)}</td><td>{r.note}</td></tr>);
          })}
          {!offs.length && (<tr><td colSpan={3} className="muted">아직 없어요</td></tr>)}
        </tbody>
      </table>

      <h2>인터뷰이 대기 질문</h2>
      <p className="small muted">인터뷰이가 직접 골라 답해요. 부적절한 질문만 숨기면 됩니다.</p>
      <table>
        <thead><tr><th>인터뷰이</th><th>요청</th><th>전달되는 질문</th><th>독자 원문</th><th></th></tr></thead>
        <tbody>
          {queue.map((q) => (
            <tr key={q.id} style={{ opacity: q.status === "hidden" ? 0.5 : 1 }}>
              <td>{names[q.persona] ?? q.persona}</td><td>{q.votes}</td><td>{q.text}</td><td className="muted">{q.original}</td>
              <td>
                <form action={setStatus}>
                  <input type="hidden" name="id" value={q.id} />
                  <button className="btn" name="status" value={q.status === "hidden" ? "open" : "hidden"}>{q.status === "hidden" ? "다시 보이기" : "숨기기"}</button>
                </form>
              </td>
            </tr>
          ))}
          {!queue.length && (<tr><td colSpan={5} className="muted">아직 없어요</td></tr>)}
        </tbody>
      </table>

      <h2>인터뷰이 답변 링크</h2>
      {!secretOk && <p className="error">ANSWER_SECRET 환경변수를 설정해야 링크가 만들어져요.</p>}
      {secretOk && (
        <table>
          <thead><tr><th>인터뷰이</th><th>메일</th><th>답변 페이지</th></tr></thead>
          <tbody>
            {personas.map((p) => {
              const link = `${siteUrl()}/answer/${answerToken(p.slug)}`;
              return (<tr key={p.slug}><td>{p.name}</td><td className="muted">{emails[p.slug] ?? "없음"}</td><td><a href={link} className="small">{link}</a></td></tr>);
            })}
          </tbody>
        </table>
      )}

      <h2>내보내기</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn" href="/api/admin/export?type=messages">대화 전체 CSV</a>
        <a className="btn" href="/api/admin/export?type=questions">인터뷰이 질문과 답변 CSV</a>
        <a className="btn" href="/api/admin/export?type=reactions">반응 CSV</a>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        주간 메일은 매주 월요일 오전 9시에 자동으로 나가요. 미리 보려면 /api/cron/weekly?key=관리키&dry=1 을 열어보세요 (메일을 보내지 않고 내용만 보여줘요).
      </p>
    </main>
  );
}
