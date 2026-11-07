import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ChatMessage, Question, Reaction, Visitor, Vote } from "../types";
import type { Store } from "./types";

/**
 * 로컬 개발용 저장소. Supabase 설정이 없을 때 .data/db.json 에 저장합니다.
 * 배포 환경(Vercel)에서는 파일이 유지되지 않으므로 반드시 Supabase를 쓰세요.
 */
interface Db {
  visitors: Visitor[];
  messages: ChatMessage[];
  reactions: Reaction[];
  questions: Omit<Question, "votes">[];
  votes: Vote[];
}

const FILE = path.join(process.cwd(), ".data", "db.json");

function load(): Db {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
  } catch {
    return { visitors: [], messages: [], reactions: [], questions: [], votes: [] };
  }
}
function save(db: Db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}
const now = () => new Date().toISOString();

function withVotes(db: Db, q: Omit<Question, "votes">): Question {
  return { ...q, votes: db.votes.filter((v) => v.questionId === q.id).length };
}

export const fileStore: Store = {
  async createVisitor(nickname) {
    const db = load();
    const v = { id: randomUUID(), nickname, createdAt: now() };
    db.visitors.push(v);
    save(db);
    return v;
  },
  async getVisitor(id) {
    return load().visitors.find((v) => v.id === id) ?? null;
  },
  async countVisitors() {
    return load().visitors.length;
  },

  async addMessage(m) {
    const db = load();
    const msg: ChatMessage = { ...m, id: randomUUID(), createdAt: now() };
    db.messages.push(msg);
    save(db);
    return msg;
  },
  async getMessage(id) {
    return load().messages.find((m) => m.id === id) ?? null;
  },
  async listConversation(visitorId, persona) {
    return load().messages.filter((m) => m.visitorId === visitorId && m.persona === persona);
  },
  async listMessagesByVisitor(visitorId) {
    return load().messages.filter((m) => m.visitorId === visitorId);
  },
  async countUserMessagesSince(visitorId, since) {
    const t = since.toISOString();
    return load().messages.filter((m) => m.visitorId === visitorId && m.role === "user" && m.createdAt >= t).length;
  },
  async listAllMessages(since) {
    const t = since?.toISOString() ?? "";
    return load().messages.filter((m) => m.createdAt >= t);
  },

  async toggleReaction(messageId, visitorId, kind, note) {
    const db = load();
    const i = db.reactions.findIndex((r) => r.messageId === messageId && r.visitorId === visitorId && r.kind === kind);
    if (i >= 0 && !note) {
      db.reactions.splice(i, 1);
      save(db);
      return false;
    }
    if (i >= 0) db.reactions[i].note = note ?? null;
    else db.reactions.push({ id: randomUUID(), messageId, visitorId, kind, note: note ?? null, createdAt: now() });
    save(db);
    return true;
  },
  async listReactions() {
    return load().reactions;
  },
  async listReactionsByVisitor(visitorId) {
    return load().reactions.filter((r) => r.visitorId === visitorId);
  },

  async listQuestions(persona) {
    const db = load();
    return db.questions.filter((q) => !persona || q.persona === persona).map((q) => withVotes(db, q));
  },
  async getQuestion(id) {
    const db = load();
    const q = db.questions.find((x) => x.id === id);
    return q ? withVotes(db, q) : null;
  },
  async createQuestion({ persona, original, text }) {
    const db = load();
    const q = { id: randomUUID(), persona, original, text, status: "open" as const, answer: null, answeredAt: null, createdAt: now() };
    db.questions.push(q);
    save(db);
    return { ...q, votes: 0 };
  },
  async updateQuestion(id, patch) {
    const db = load();
    const q = db.questions.find((x) => x.id === id);
    if (!q) return;
    if (patch.status) q.status = patch.status;
    if (patch.text !== undefined) q.text = patch.text;
    if (patch.answer !== undefined) {
      q.answer = patch.answer;
      q.answeredAt = patch.answer ? now() : null;
    }
    save(db);
  },

  async addVote(questionId, visitorId) {
    const db = load();
    if (db.votes.some((v) => v.questionId === questionId && v.visitorId === visitorId)) return;
    db.votes.push({ questionId, visitorId, seen: false, createdAt: now() });
    save(db);
  },
  async listVotesByVisitor(visitorId) {
    return load().votes.filter((v) => v.visitorId === visitorId);
  },
  async markVotesSeen(visitorId, questionIds) {
    const db = load();
    for (const v of db.votes) if (v.visitorId === visitorId && questionIds.includes(v.questionId)) v.seen = true;
    save(db);
  },
};
