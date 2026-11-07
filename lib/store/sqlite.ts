import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { ChatMessage, Question, Reaction, Visitor, Vote } from "../types";
import type { Store } from "./types";

/**
 * 컴퓨터 한 대에서 운영할 때 쓰는 저장소. 파일 하나(.data/interactiview.db)에 모두 저장합니다.
 * 백업은 이 파일을 복사하면 됩니다. Node 22.13 이상이 필요합니다.
 */
const SCHEMA = `
create table if not exists visitors (id text primary key, nickname text not null, created_at text not null);
create table if not exists messages (
  id text primary key, visitor_id text not null, persona text not null, role text not null, content text not null,
  kind text, citations text not null default '[]', topics text not null default '[]', sensitive integer not null default 0,
  created_at text not null
);
create index if not exists messages_conv on messages (visitor_id, persona, created_at);
create index if not exists messages_created on messages (created_at);
create table if not exists reactions (
  id text primary key, message_id text not null, visitor_id text not null, kind text not null, note text,
  created_at text not null, unique (message_id, visitor_id, kind)
);
create table if not exists questions (
  id text primary key, persona text not null, original text not null, text text not null, status text not null default 'open',
  answer text, answered_at text, created_at text not null
);
create index if not exists questions_persona on questions (persona, status);
create table if not exists question_votes (
  question_id text not null, visitor_id text not null, seen integer not null default 0, created_at text not null,
  primary key (question_id, visitor_id)
);
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function createSqliteStore(file: string): Store {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("pragma journal_mode = wal; pragma busy_timeout = 5000;");
  db.exec(SCHEMA);

  const now = () => new Date().toISOString();
  const all = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).all(...args) as Row[];
  const get = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).get(...args) as Row | undefined;
  const run = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).run(...args);

  const toVisitor = (r: Row): Visitor => ({ id: r.id, nickname: r.nickname, createdAt: r.created_at });
  const toMessage = (r: Row): ChatMessage => ({
    id: r.id,
    visitorId: r.visitor_id,
    persona: r.persona,
    role: r.role,
    content: r.content,
    kind: r.kind ?? null,
    citations: JSON.parse(r.citations),
    topics: JSON.parse(r.topics),
    sensitive: Boolean(r.sensitive),
    createdAt: r.created_at,
  });
  const toReaction = (r: Row): Reaction => ({ id: r.id, messageId: r.message_id, visitorId: r.visitor_id, kind: r.kind, note: r.note ?? null, createdAt: r.created_at });
  const toQuestion = (r: Row): Question => ({
    id: r.id,
    persona: r.persona,
    original: r.original,
    text: r.text,
    status: r.status,
    answer: r.answer ?? null,
    answeredAt: r.answered_at ?? null,
    createdAt: r.created_at,
    votes: Number(r.votes ?? 0),
  });
  const toVote = (r: Row): Vote => ({ questionId: r.question_id, visitorId: r.visitor_id, seen: Boolean(r.seen), createdAt: r.created_at });
  const Q_SELECT = "select q.*, (select count(*) from question_votes v where v.question_id = q.id) as votes from questions q";

  return {
    async createVisitor(nickname) {
      const v = { id: randomUUID(), nickname, createdAt: now() };
      run("insert into visitors (id, nickname, created_at) values (?, ?, ?)", v.id, v.nickname, v.createdAt);
      return v;
    },
    async getVisitor(id) {
      const r = get("select * from visitors where id = ?", id);
      return r ? toVisitor(r) : null;
    },
    async countVisitors() {
      return Number(get("select count(*) as n from visitors")!.n);
    },

    async addMessage(m) {
      const msg: ChatMessage = { ...m, id: randomUUID(), createdAt: now() };
      run(
        "insert into messages (id, visitor_id, persona, role, content, kind, citations, topics, sensitive, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        msg.id, msg.visitorId, msg.persona, msg.role, msg.content, msg.kind, JSON.stringify(msg.citations), JSON.stringify(msg.topics), msg.sensitive ? 1 : 0, msg.createdAt,
      );
      return msg;
    },
    async getMessage(id) {
      const r = get("select * from messages where id = ?", id);
      return r ? toMessage(r) : null;
    },
    async listConversation(visitorId, persona) {
      return all("select * from messages where visitor_id = ? and persona = ? order by created_at, rowid", visitorId, persona).map(toMessage);
    },
    async listMessagesByVisitor(visitorId) {
      return all("select * from messages where visitor_id = ? order by created_at, rowid", visitorId).map(toMessage);
    },
    async countUserMessagesSince(visitorId, since) {
      return Number(get("select count(*) as n from messages where visitor_id = ? and role = 'user' and created_at >= ?", visitorId, since.toISOString())!.n);
    },
    async listAllMessages(since) {
      return all("select * from messages where created_at >= ? order by created_at, rowid", (since ?? new Date(0)).toISOString()).map(toMessage);
    },

    async toggleReaction(messageId, visitorId, kind, note) {
      const existing = get("select id from reactions where message_id = ? and visitor_id = ? and kind = ?", messageId, visitorId, kind);
      if (existing && !note) {
        run("delete from reactions where id = ?", existing.id);
        return false;
      }
      if (existing) run("update reactions set note = ? where id = ?", note ?? null, existing.id);
      else run("insert into reactions (id, message_id, visitor_id, kind, note, created_at) values (?, ?, ?, ?, ?, ?)", randomUUID(), messageId, visitorId, kind, note ?? null, now());
      return true;
    },
    async listReactions() {
      return all("select * from reactions").map(toReaction);
    },
    async listReactionsByVisitor(visitorId) {
      return all("select * from reactions where visitor_id = ?", visitorId).map(toReaction);
    },

    async listQuestions(persona) {
      return (persona ? all(`${Q_SELECT} where q.persona = ? order by q.created_at`, persona) : all(`${Q_SELECT} order by q.created_at`)).map(toQuestion);
    },
    async getQuestion(id) {
      const r = get(`${Q_SELECT} where q.id = ?`, id);
      return r ? toQuestion(r) : null;
    },
    async createQuestion({ persona, original, text }) {
      const q: Question = { id: randomUUID(), persona, original, text, status: "open", answer: null, answeredAt: null, createdAt: now(), votes: 0 };
      run("insert into questions (id, persona, original, text, status, created_at) values (?, ?, ?, ?, 'open', ?)", q.id, persona, original, text, q.createdAt);
      return q;
    },
    async updateQuestion(id, patch) {
      if (patch.status) run("update questions set status = ? where id = ?", patch.status, id);
      if (patch.text !== undefined) run("update questions set text = ? where id = ?", patch.text, id);
      if (patch.answer !== undefined) run("update questions set answer = ?, answered_at = ? where id = ?", patch.answer, patch.answer ? now() : null, id);
    },

    async addVote(questionId, visitorId) {
      run("insert or ignore into question_votes (question_id, visitor_id, seen, created_at) values (?, ?, 0, ?)", questionId, visitorId, now());
    },
    async listVotesByVisitor(visitorId) {
      return all("select * from question_votes where visitor_id = ?", visitorId).map(toVote);
    },
    async markVotesSeen(visitorId, questionIds) {
      for (const qid of questionIds) run("update question_votes set seen = 1 where visitor_id = ? and question_id = ?", visitorId, qid);
    },
  };
}
