import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mockAnswer } from "@/lib/mock";
import { parsePersona } from "@/lib/parse";
import { verifyCitations } from "@/lib/quotes";

const p = parsePersona(fs.readFileSync(path.join(__dirname, "../content/personas/sample-minho.md"), "utf8"), "sample-minho");

describe("demo mode answers", () => {
  it("quotes the best matching passage verbatim", () => {
    const r = mockAnswer(p, "창업할 때 무섭지 않았어요?");
    expect(r.kind).toBe("quote");
    expect(verifyCitations(r.citations, p.passages)).toHaveLength(1);
  });
  it("returns none when nothing matches", () => {
    expect(mockAnswer(p, "좋아하는 음식은?").kind).toBe("none");
    expect(mockAnswer(p, "좋아하는 음식이 뭐예요?").kind).toBe("none");
  });
});
