import { describe, expect, it } from "vitest";
import { verifyCitations } from "@/lib/quotes";
import type { Passage } from "@/lib/types";

const passages: Passage[] = [
  { id: "a-q1", question: "첫 질문", text: "원래는 경영학을 전공했어요.\n대학교 3학년 때 **처음으로** 시간 가는 줄 모르는 경험을 했습니다." },
  { id: "a-q2", question: "둘째 질문", text: "모르는 걸 모른다고 말하는 연습을 일찍 하세요." },
];

describe("verifyCitations", () => {
  it("keeps quotes that exist verbatim (ignoring whitespace and emphasis)", () => {
    const out = verifyCitations([{ passage_id: "a-q1", quote: "대학교 3학년 때 처음으로 시간 가는 줄 모르는 경험을 했습니다." }], passages);
    expect(out).toEqual([{ passageId: "a-q1", question: "첫 질문", quote: "대학교 3학년 때 처음으로 시간 가는 줄 모르는 경험을 했습니다." }]);
  });

  it("removes markdown bold from the stored quote", () => {
    const out = verifyCitations([{ passage_id: "a-q1", quote: "대학교 3학년 때 **처음으로** 시간 가는 줄" }], passages);
    expect(out[0].quote).toBe("대학교 3학년 때 처음으로 시간 가는 줄");
  });

  it("drops invented quotes", () => {
    expect(verifyCitations([{ passage_id: "a-q1", quote: "저는 디자인을 정말 사랑했어요." }], passages)).toEqual([]);
  });

  it("fixes a wrong passage id when the quote exists elsewhere", () => {
    const out = verifyCitations([{ passage_id: "a-q1", quote: "모르는 걸 모른다고 말하는 연습을 일찍 하세요." }], passages);
    expect(out[0].passageId).toBe("a-q2");
  });

  it("drops very short fragments and duplicates", () => {
    const q = { passage_id: "a-q2", quote: "모르는 걸 모른다고 말하는 연습" };
    expect(verifyCitations([q, q], passages)).toHaveLength(1);
    expect(verifyCitations([{ passage_id: "a-q2", quote: "연습" }], passages)).toEqual([]);
  });
});
