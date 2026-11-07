import "server-only";
import { answerQuestion, triageQuestion } from "./ai";
import { getPersona, loadPersonas, withExtraAnswers } from "./personas";
import { verifyCitations } from "./quotes";
import { store } from "./store";
import type { ChatMessage, Persona, Visitor } from "./types";

const NONE_TEXT = "그 이야기는 아직 원고에 쓰지 않았어요. 직접 물어봐 주시면 다음에 답해볼게요.";

/** 원고 + 인터뷰이가 서비스에서 추가로 답한 문단 */
export async function personaWithAnswers(slug: string): Promise<Persona | null> {
  const p = getPersona(slug);
  if (!p) return null;
  const answered = (await store().listQuestions(slug)).filter((q) => q.status === "answered");
  return withExtraAnswers(p, answered);
}

export function dailyLimit(): number {
  return Number(process.env.DAILY_QUESTION_LIMIT ?? 40) || 40;
}

export class UserError extends Error {}

/** 독자의 질문 하나에 답하고, 질문과 답을 모두 기록합니다. */
export async function chat(visitor: Visitor, slug: string, question: string): Promise<{ user: ChatMessage; reply: ChatMessage }> {
  const q = question.trim();
  if (!q) throw new UserError("질문을 입력해 주세요.");
  if (q.length > 1000) throw new UserError("질문은 1,000자 이내로 써주세요.");

  const persona = await personaWithAnswers(slug);
  if (!persona) throw new UserError("없는 인터뷰이예요.");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await store().countUserMessagesSince(visitor.id, since)) >= dailyLimit()) {
    throw new UserError(`하루에 ${dailyLimit()}개까지 물어볼 수 있어요. 내일 다시 와주세요.`);
  }

  const history = (await store().listConversation(visitor.id, slug)).map((m) => ({ role: m.role, content: m.content }));
  const result = await answerQuestion(persona, history, q);

  const citations = verifyCitations(result.citations, persona.passages);
  let kind = result.kind;
  let answer = result.answer.trim();
  // 근거 없는 답은 내보내지 않습니다.
  if (kind !== "none" && citations.length === 0) {
    kind = "none";
    answer = NONE_TEXT;
  }
  if (kind === "bridge" && persona.quoteOnly) kind = "quote";
  if (!answer) answer = NONE_TEXT;

  const user = await store().addMessage({
    visitorId: visitor.id,
    persona: slug,
    role: "user",
    content: q,
    kind: null,
    citations: [],
    topics: result.topics.slice(0, 3),
    sensitive: result.sensitive,
  });
  const reply = await store().addMessage({
    visitorId: visitor.id,
    persona: slug,
    role: "assistant",
    content: answer,
    kind,
    citations: kind === "none" ? [] : citations,
    topics: result.topics.slice(0, 3),
    sensitive: result.sensitive,
  });
  return { user, reply };
}

/**
 * "직접 물어보기": 답변 바로 앞의 독자 질문을 인터뷰이 대기열에 넣습니다.
 * 같은 뜻의 질문이 이미 있으면 새로 만들지 않고 한 표를 더합니다.
 */
export async function askInterviewee(visitor: Visitor, replyId: string): Promise<{ merged: boolean }> {
  const reply = await store().getMessage(replyId);
  if (!reply || reply.visitorId !== visitor.id || reply.role !== "assistant") throw new UserError("대화를 찾을 수 없어요.");
  if (reply.sensitive) throw new UserError("이 질문은 인터뷰이에게 보내지 않아요.");

  const conv = await store().listConversation(visitor.id, reply.persona);
  const idx = conv.findIndex((m) => m.id === reply.id);
  const userMsg = conv
    .slice(0, idx)
    .reverse()
    .find((m) => m.role === "user");
  if (!userMsg) throw new UserError("질문을 찾을 수 없어요.");

  const persona = getPersona(reply.persona);
  if (!persona) throw new UserError("없는 인터뷰이예요.");

  const open = (await store().listQuestions(reply.persona)).filter((q) => q.status === "open");
  const already = open.find((q) => q.original === userMsg.content);
  if (already) {
    await store().addVote(already.id, visitor.id);
    return { merged: true };
  }
  const t = await triageQuestion(persona.name, userMsg.content, open.map((q) => ({ id: q.id, text: q.text })));
  if (t.duplicateOf) {
    await store().addVote(t.duplicateOf, visitor.id);
    return { merged: true };
  }
  const created = await store().createQuestion({ persona: reply.persona, original: userMsg.content, text: t.text });
  await store().addVote(created.id, visitor.id);
  return { merged: false };
}

export function personaNames(): Record<string, string> {
  return Object.fromEntries(loadPersonas().map((p) => [p.slug, p.name]));
}
