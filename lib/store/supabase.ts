import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, Question, Reaction, Visitor, Vote } from "../types";
import type { Store } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

/** Supabase는 한 번에 1,000행까지만 주므로 나눠서 모두 가져옵니다. */
async function selectAll(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: any }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await build(from, from + 999)) ?? [];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const toVisitor = (r: Row): Visitor => ({ id: r.id, nickname: r.nickname, createdAt: r.created_at });
const toMessage = (r: Row): ChatMessage => ({
  id: r.id,
  visitorId: r.visitor_id,
  persona: r.persona,
  role: r.role,
  content: r.content,
  kind: r.kind,
  citations: r.citations ?? [],
  topics: r.topics ?? [],
  sensitive: r.sensitive ?? false,
  createdAt: r.created_at,
});
const toReaction = (r: Row): Reaction => ({
  id: r.id,
  messageId: r.message_id,
  visitorId: r.visitor_id,
  kind: r.kind,
  note: r.note,
  createdAt: r.created_at,
});
const toQuestion = (r: Row): Question => ({
  id: r.id,
  persona: r.persona,
  original: r.original,
  text: r.text,
  status: r.status,
  answer: r.answer,
  answeredAt: r.answered_at,
  createdAt: r.created_at,
  votes: Array.isArray(r.question_votes) ? (r.question_votes[0]?.count ?? 0) : 0,
});
const toVote = (r: Row): Vote => ({ questionId: r.question_id, visitorId: r.visitor_id, seen: r.seen, createdAt: r.created_at });

const Q_COLS = "*, question_votes(count)";

export const supabaseStore: Store = {
  async createVisitor(nickname) {
    return toVisitor(check(await db().from("visitors").insert({ nickname }).select().single())!);
  },
  async getVisitor(id) {
    const r = check(await db().from("visitors").select().eq("id", id).maybeSingle());
    return r ? toVisitor(r) : null;
  },
  async countVisitors() {
    const res = await db().from("visitors").select("id", { count: "exact", head: true });
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },

  async addMessage(m) {
    const row = {
      visitor_id: m.visitorId,
      persona: m.persona,
      role: m.role,
      content: m.content,
      kind: m.kind,
      citations: m.citations,
      topics: m.topics,
      sensitive: m.sensitive,
    };
    return toMessage(check(await db().from("messages").insert(row).select().single())!);
  },
  async getMessage(id) {
    const r = check(await db().from("messages").select().eq("id", id).maybeSingle());
    return r ? toMessage(r) : null;
  },
  async listConversation(visitorId, persona) {
    const rows = await selectAll((a, b) =>
      db().from("messages").select().eq("visitor_id", visitorId).eq("persona", persona).order("created_at").range(a, b),
    );
    return rows.map(toMessage);
  },
  async listMessagesByVisitor(visitorId) {
    const rows = await selectAll((a, b) => db().from("messages").select().eq("visitor_id", visitorId).order("created_at").range(a, b));
    return rows.map(toMessage);
  },
  async countUserMessagesSince(visitorId, since) {
    const res = await db()
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("visitor_id", visitorId)
      .eq("role", "user")
      .gte("created_at", since.toISOString());
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },
  async listAllMessages(since) {
    const rows = await selectAll((a, b) =>
      db()
        .from("messages")
        .select()
        .gte("created_at", (since ?? new Date(0)).toISOString())
        .order("created_at")
        .range(a, b),
    );
    return rows.map(toMessage);
  },

  async toggleReaction(messageId, visitorId, kind, note) {
    const existing = check(
      await db().from("reactions").select().eq("message_id", messageId).eq("visitor_id", visitorId).eq("kind", kind).maybeSingle(),
    );
    if (existing && !note) {
      check(await db().from("reactions").delete().eq("id", existing.id));
      return false;
    }
    if (existing) check(await db().from("reactions").update({ note }).eq("id", existing.id));
    else check(await db().from("reactions").insert({ message_id: messageId, visitor_id: visitorId, kind, note: note ?? null }));
    return true;
  },
  async listReactions() {
    return (await selectAll((a, b) => db().from("reactions").select().range(a, b))).map(toReaction);
  },
  async listReactionsByVisitor(visitorId) {
    return (await selectAll((a, b) => db().from("reactions").select().eq("visitor_id", visitorId).range(a, b))).map(toReaction);
  },

  async listQuestions(persona) {
    const rows = await selectAll((a, b) => {
      let q = db().from("questions").select(Q_COLS);
      if (persona) q = q.eq("persona", persona);
      return q.order("created_at").range(a, b);
    });
    return rows.map(toQuestion);
  },
  async getQuestion(id) {
    const r = check(await db().from("questions").select(Q_COLS).eq("id", id).maybeSingle());
    return r ? toQuestion(r) : null;
  },
  async createQuestion({ persona, original, text }) {
    return toQuestion(check(await db().from("questions").insert({ persona, original, text }).select().single())!);
  },
  async updateQuestion(id, patch) {
    const row: Row = {};
    if (patch.status) row.status = patch.status;
    if (patch.text !== undefined) row.text = patch.text;
    if (patch.answer !== undefined) {
      row.answer = patch.answer;
      row.answered_at = patch.answer ? new Date().toISOString() : null;
    }
    check(await db().from("questions").update(row).eq("id", id));
  },

  async addVote(questionId, visitorId) {
    check(
      await db()
        .from("question_votes")
        .upsert({ question_id: questionId, visitor_id: visitorId }, { onConflict: "question_id,visitor_id", ignoreDuplicates: true }),
    );
  },
  async listVotesByVisitor(visitorId) {
    return (await selectAll((a, b) => db().from("question_votes").select().eq("visitor_id", visitorId).range(a, b))).map(toVote);
  },
  async markVotesSeen(visitorId, questionIds) {
    if (!questionIds.length) return;
    check(await db().from("question_votes").update({ seen: true }).eq("visitor_id", visitorId).in("question_id", questionIds));
  },
};
