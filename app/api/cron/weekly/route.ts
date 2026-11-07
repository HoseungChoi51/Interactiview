import { NextResponse } from "next/server";
import { summarizeWeek } from "@/lib/ai";
import { intervieweeEmails, sendMail, siteUrl } from "@/lib/mail";
import { loadPersonas } from "@/lib/personas";
import { personaNames } from "@/lib/service";
import { store } from "@/lib/store";
import { answerToken } from "@/lib/tokens";

export const maxDuration = 120;

/**
 * 매주 월요일 오전 9시(KST)에 Vercel 이 호출합니다 (vercel.json).
 * 1) 인터뷰이마다: 새 질문 수 + 요청 많은 질문 3개 + 답변 페이지 링크
 * 2) 운영자에게: 이번 주 질문 주제 요약
 * 메일 키가 없거나 ?dry=1 이면 보내지 않고 내용만 돌려줍니다.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const params = new URL(req.url).searchParams;
  const adminKey = params.get("key");
  // dry=1 이면 메일을 보내지 않고 내용만 돌려줍니다.
  const dry = params.get("dry") === "1";
  if (!(secret && auth === `Bearer ${secret}`) && !(process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const emails = intervieweeEmails();
  const allQuestions = await store().listQuestions();
  const results: unknown[] = [];

  for (const p of loadPersonas()) {
    const open = allQuestions.filter((q) => q.persona === p.slug && q.status === "open").sort((a, b) => b.votes - a.votes);
    const fresh = open.filter((q) => new Date(q.createdAt) >= weekAgo);
    if (!open.length) continue;
    const link = `${siteUrl()}/answer/${answerToken(p.slug)}`;
    const top = open.slice(0, 3).map((q, i) => `${i + 1}. ${q.text} (${q.votes}명이 궁금해함)`).join("\n");
    const text = `${p.name}님, 안녕하세요.

이번 주 독자들이 ${p.name}님께 새로 남긴 질문이 ${fresh.length}개 있어요. 지금 답을 기다리는 질문은 모두 ${open.length}개예요.

가장 많이 궁금해한 질문
${top}

아래 링크에서 답하고 싶은 질문만 골라 짧게 답해 주시면 돼요. 로그인은 필요 없고, 답하지 않고 넘겨도 괜찮아요.
${link}

남겨주신 답은 바로 서비스에 반영되고, 다음 에디션 원고에도 들어갑니다.`;
    const to = emails[p.slug];
    const sent = to && !dry ? await sendMail({ to, subject: `[인터뷰집] 독자들이 ${p.name}님께 묻고 싶은 질문 ${open.length}개`, text }) : { sent: false, error: dry ? "미리보기" : "메일 주소 없음" };
    results.push({ persona: p.slug, to: to ?? null, ...sent, preview: sent.sent ? undefined : text });
  }

  const names = personaNames();
  const weekMsgs = (await store().listAllMessages(weekAgo)).filter((m) => m.role === "assistant");
  const userMsgs = await store().listAllMessages(weekAgo);
  // 각 답변 바로 앞의 질문을 짝지어 "[인터뷰이] [종류] 질문" 줄을 만듭니다.
  const lines: string[] = [];
  const convs = new Map<string, typeof userMsgs>();
  for (const m of userMsgs) {
    const k = `${m.visitorId}:${m.persona}`;
    convs.set(k, [...(convs.get(k) ?? []), m]);
  }
  for (const list of convs.values()) {
    list.forEach((m, i) => {
      if (m.role !== "user") return;
      const reply = list[i + 1];
      lines.push(`[${names[m.persona] ?? m.persona}] [${reply?.kind ?? "?"}] ${m.content.replace(/\s+/g, " ").slice(0, 200)}`);
    });
  }
  const summary = await summarizeWeek(lines);
  const adminText = `이번 주 대화: 답변 ${weekMsgs.length}개, 질문 ${lines.length}개\n\n${summary}\n\n관리 페이지: ${siteUrl()}/admin`;
  const admin = process.env.ADMIN_EMAIL && !dry
    ? await sendMail({ to: process.env.ADMIN_EMAIL, subject: "[인터뷰집] 이번 주 독자 질문 리포트", text: adminText })
    : { sent: false, error: dry ? "미리보기" : "ADMIN_EMAIL 없음" };

  return NextResponse.json({ interviewees: results, admin: { ...admin, preview: admin.sent ? undefined : adminText } });
}
