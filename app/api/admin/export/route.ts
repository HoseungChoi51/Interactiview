import { isAdmin } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import { personaNames } from "@/lib/service";
import { store } from "@/lib/store";

/** 관리자용 CSV 내보내기. ?type=messages|questions|reactions */
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("관리자만 볼 수 있어요.", { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "messages";
  const names = personaNames();
  let csv: string;

  if (type === "questions") {
    const qs = await store().listQuestions();
    csv = toCsv([
      ["인터뷰이", "상태", "요청 수", "다듬은 질문", "독자 원문", "답변", "답변일", "생성일"],
      ...qs.map((q) => [names[q.persona] ?? q.persona, q.status, q.votes, q.text, q.original, q.answer, q.answeredAt, q.createdAt]),
    ]);
  } else if (type === "reactions") {
    const [rs, ms] = await Promise.all([store().listReactions(), store().listAllMessages()]);
    const byId = new Map(ms.map((m) => [m.id, m]));
    csv = toCsv([
      ["반응", "메모", "인터뷰이", "답변 종류", "답변", "인용 문단", "독자", "시각"],
      ...rs.map((r) => {
        const m = byId.get(r.messageId);
        return [r.kind, r.note, m ? names[m.persona] ?? m.persona : "", m?.kind, m?.content, m?.citations.map((c) => c.passageId).join(" "), r.visitorId.slice(0, 8), r.createdAt];
      }),
    ]);
  } else {
    const ms = await store().listAllMessages();
    csv = toCsv([
      ["시각", "독자", "인터뷰이", "역할", "내용", "답변 종류", "주제", "인용 문단", "민감"],
      ...ms.map((m) => [m.createdAt, m.visitorId.slice(0, 8), names[m.persona] ?? m.persona, m.role, m.content, m.kind, m.topics.join(" / "), m.citations.map((c) => c.passageId).join(" "), m.sensitive]),
    ]);
  }
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="interactiview-${type}.csv"`,
    },
  });
}
