import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPersona } from "@/lib/personas";
import { store } from "@/lib/store";
import { verifyAnswerToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

async function save(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const slug = verifyAnswerToken(token);
  if (!slug) return;
  const id = String(formData.get("id") ?? "");
  const q = await store().getQuestion(id);
  if (!q || q.persona !== slug) return;
  const action = String(formData.get("action") ?? "");
  if (action === "skip") {
    await store().updateQuestion(id, { status: "skipped" });
  } else if (action === "reopen") {
    await store().updateQuestion(id, { status: "open", answer: null });
  } else {
    const answer = String(formData.get("answer") ?? "").trim().slice(0, 5000);
    if (!answer) return;
    await store().updateQuestion(id, { status: "answered", answer });
  }
  revalidatePath(`/answer/${token}`);
}

/** 인터뷰이용 답변 페이지. 메일 속 링크만으로 들어오며 로그인이 없습니다. */
export default async function AnswerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const slug = verifyAnswerToken(token);
  const p = slug ? getPersona(slug) : null;
  if (!slug || !p) notFound();

  const qs = await store().listQuestions(slug);
  const open = qs.filter((q) => q.status === "open").sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
  const answered = qs.filter((q) => q.status === "answered").sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""));
  const skipped = qs.filter((q) => q.status === "skipped");

  return (
    <main className="wrap narrow">
      <p className="muted small">{p.name}님 전용 페이지 · 이 링크는 다른 사람과 공유하지 마세요</p>
      <h1 className="serif">독자들이 {p.name}님께 묻고 싶어해요</h1>
      <p className="muted">
        답하고 싶은 질문만 골라 짧게 답해 주세요. 한두 문장도 충분해요. 남긴 답은 바로 서비스에 &ldquo;추가 답변&rdquo;으로 실리고, 질문한 독자에게 알림이 가며, 다음 에디션 원고에도 들어갑니다. 질문은 개인정보를 가린 형태로 보입니다.
      </p>

      <h2>답을 기다리는 질문 {open.length}개</h2>
      {open.length === 0 && <p className="muted">지금은 기다리는 질문이 없어요.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {open.map((q) => (
          <form key={q.id} action={save} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="id" value={q.id} />
            <div className="small muted">{q.votes}명이 궁금해함</div>
            <div style={{ fontWeight: 600 }}>{q.text}</div>
            <textarea name="answer" rows={5} placeholder="편하게 답해 주세요" />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn primary" name="action" value="answer" type="submit">
                답변 저장
              </button>
              <button className="btn" name="action" value="skip" type="submit">
                이 질문은 넘기기
              </button>
            </div>
          </form>
        ))}
      </div>

      {answered.length > 0 && (
        <>
          <h2>답한 질문 {answered.length}개</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {answered.map((q) => (
              <form key={q.id} action={save} className="card">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="id" value={q.id} />
                <div style={{ fontWeight: 600 }}>{q.text}</div>
                <p className="serif" style={{ whiteSpace: "pre-wrap" }}>
                  {q.answer}
                </p>
                <button className="btn" name="action" value="reopen" type="submit">
                  답변 내리고 다시 쓰기
                </button>
              </form>
            ))}
          </div>
        </>
      )}

      {skipped.length > 0 && (
        <>
          <h2>넘긴 질문 {skipped.length}개</h2>
          {skipped.map((q) => (
            <form key={q.id} action={save} className="card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="id" value={q.id} />
              <span>{q.text}</span>
              <button className="btn" name="action" value="reopen" type="submit">
                다시 보기
              </button>
            </form>
          ))}
        </>
      )}
    </main>
  );
}
