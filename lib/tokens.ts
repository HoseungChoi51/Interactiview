import { createHmac, timingSafeEqual } from "node:crypto";

/** 인터뷰이별 답변 페이지 링크 토큰. 로그인 없이 링크만으로 들어옵니다. */
function sign(slug: string, secret: string): string {
  return createHmac("sha256", secret).update(`answer:${slug}`).digest("base64url").slice(0, 24);
}

export function answerToken(slug: string, secret = process.env.ANSWER_SECRET ?? ""): string {
  if (!secret) throw new Error("ANSWER_SECRET 이 설정되지 않았습니다.");
  return `${slug}.${sign(slug, secret)}`;
}

/** 토큰이 맞으면 슬러그를, 아니면 null 을 돌려줍니다. */
export function verifyAnswerToken(token: string, secret = process.env.ANSWER_SECRET ?? ""): string | null {
  if (!secret) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const slug = token.slice(0, i);
  const a = Buffer.from(token.slice(i + 1));
  const b = Buffer.from(sign(slug, secret));
  return a.length === b.length && timingSafeEqual(a, b) ? slug : null;
}
