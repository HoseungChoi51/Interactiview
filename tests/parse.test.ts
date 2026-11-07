import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePersona, slugFromFilename } from "@/lib/parse";

describe("parsePersona", () => {
  it("splits intro and ## questions, reads frontmatter", () => {
    const raw = fs.readFileSync(path.join(__dirname, "fixtures/heading-format.md"), "utf8");
    const p = parsePersona(raw, "sample-jiwoo");
    expect(p.name).toBe("이지우 (예시)");
    expect(p.sampleQuestions).toHaveLength(3);
    expect(p.passages[0].id).toBe("sample-jiwoo-intro");
    expect(p.passages[1]).toMatchObject({ id: "sample-jiwoo-q1", question: "디자이너가 된 계기가 궁금해요" });
    expect(p.passages).toHaveLength(5);
    expect(p.quoteOnly).toBe(false);
  });

  it("splits the Notion Q/A format into one passage per question", () => {
    const raw = fs.readFileSync(path.join(__dirname, "../content/personas/choi-hoseung.md"), "utf8");
    const p = parsePersona(raw, "choi-hoseung");
    expect(p.name).toBe("최호승");
    expect(p.tagline).toBe("정답이 없는 문제는 틀릴 수 없습니다");
    expect(p.passages[0].id).toBe("choi-hoseung-intro");
    expect(p.passages[0].text.startsWith("천문학으로")).toBe(true);
    expect(p.passages[1]).toMatchObject({ id: "choi-hoseung-q1", question: "지금까지 어떤 길을 걸어오셨나요?", section: "계획에 없던 선택들이 이어진 길" });
    expect(p.passages[1].text.startsWith("처음부터")).toBe(true);
    expect(p.passages.at(-1)).toMatchObject({ id: "choi-hoseung-notes", question: "주석" });
    expect(p.passages).toHaveLength(12);
  });

  it("drops questions left without an answer and handles a missing intro", () => {
    const raw = "# 홍길동\n\n## **큰 제목**\n\n### 소제목\n\n**Q. 첫 질문?**\n\n**A**. 첫 답입니다. 충분히 깁니다.\n\nQ 둘째 질문?\n\nA\n\nQ. 셋째 질문?\n\n**A.** 셋째 답도 충분히 깁니다.";
    const p = parsePersona(raw, "hong");
    expect(p.tagline).toBe("큰 제목");
    expect(p.passages.map((x) => x.question)).toEqual(["첫 질문?", "셋째 질문?"]);
    expect(p.passages[0]).toMatchObject({ text: "첫 답입니다. 충분히 깁니다.", section: "소제목" });
  });

  it("handles a plain Notion export without frontmatter", () => {
    const raw = "# 홍길동\n\n자기소개입니다.\n\n<aside>노션 콜아웃</aside>\n\n### **첫 질문**\n\n답 하나.\n\n### 둘째 질문\n\n답 둘.";
    const p = parsePersona(raw, "hong");
    expect(p.name).toBe("홍길동");
    expect(p.passages.map((x) => x.question)).toEqual(["자기소개", "첫 질문", "둘째 질문"]);
    expect(p.passages[0].text).not.toContain("콜아웃");
  });

  it("strips the Notion id from export filenames", () => {
    expect(slugFromFilename("Kim Minji 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d.md")).toBe("kim-minji");
    expect(slugFromFilename("sample-jiwoo.md")).toBe("sample-jiwoo");
  });
});
