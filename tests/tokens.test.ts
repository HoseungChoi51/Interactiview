import { describe, expect, it } from "vitest";
import { answerToken, verifyAnswerToken } from "@/lib/tokens";

describe("answer tokens", () => {
  it("round-trips and rejects tampering", () => {
    const t = answerToken("sample-jiwoo", "secret");
    expect(verifyAnswerToken(t, "secret")).toBe("sample-jiwoo");
    expect(verifyAnswerToken(t, "other")).toBeNull();
    expect(verifyAnswerToken(t.replace("sample-jiwoo", "sample-minho"), "secret")).toBeNull();
    expect(verifyAnswerToken("garbage", "secret")).toBeNull();
  });
});
