import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSqliteStore } from "@/lib/store/sqlite";

describe("sqlite store", () => {
  it("stores conversations, reactions, questions and votes", async () => {
    const s = createSqliteStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "iv-")), "t.db"));
    const a = await s.createVisitor("가");
    const b = await s.createVisitor("나");
    expect(await s.countVisitors()).toBe(2);

    const base = { persona: "p", kind: null, citations: [], topics: ["이직"], sensitive: false };
    await s.addMessage({ ...base, visitorId: a.id, role: "user", content: "질문" });
    const reply = await s.addMessage({ ...base, visitorId: a.id, role: "assistant", content: "답", kind: "quote", citations: [{ passageId: "p-q1", question: "Q", quote: "인용" }] });
    const conv = await s.listConversation(a.id, "p");
    expect(conv.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(conv[1].citations[0].passageId).toBe("p-q1");
    expect(await s.countUserMessagesSince(a.id, new Date(Date.now() - 1000))).toBe(1);

    expect(await s.toggleReaction(reply.id, a.id, "resonate")).toBe(true);
    expect(await s.toggleReaction(reply.id, a.id, "resonate")).toBe(false);
    expect(await s.toggleReaction(reply.id, a.id, "off", "메모")).toBe(true);
    expect((await s.listReactions())[0].note).toBe("메모");

    const q = await s.createQuestion({ persona: "p", original: "원문", text: "다듬은 질문" });
    await s.addVote(q.id, a.id);
    await s.addVote(q.id, a.id);
    await s.addVote(q.id, b.id);
    expect((await s.getQuestion(q.id))!.votes).toBe(2);
    await s.updateQuestion(q.id, { status: "answered", answer: "답변" });
    const answered = (await s.listQuestions("p"))[0];
    expect(answered).toMatchObject({ status: "answered", answer: "답변" });
    expect(answered.answeredAt).not.toBeNull();
    await s.markVotesSeen(a.id, [q.id]);
    expect((await s.listVotesByVisitor(a.id))[0].seen).toBe(true);
    expect((await s.listVotesByVisitor(b.id))[0].seen).toBe(false);
  });
});
