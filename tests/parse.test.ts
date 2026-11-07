import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePersona, slugFromFilename } from "@/lib/parse";

describe("parsePersona", () => {
  it("splits intro and ## questions, reads frontmatter", () => {
    const raw = fs.readFileSync(path.join(__dirname, "../content/personas/sample-jiwoo.md"), "utf8");
    const p = parsePersona(raw, "sample-jiwoo");
    expect(p.name).toBe("이지우 (예시)");
    expect(p.sampleQuestions).toHaveLength(3);
    expect(p.passages[0].id).toBe("sample-jiwoo-intro");
    expect(p.passages[1]).toMatchObject({ id: "sample-jiwoo-q1", question: "디자이너가 된 계기가 궁금해요" });
    expect(p.passages).toHaveLength(5);
    expect(p.quoteOnly).toBe(false);
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
