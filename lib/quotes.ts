import type { Citation, Passage } from "./types";

/** 공백, 따옴표, 마크다운 강조를 무시하고 비교하기 위한 정규화 */
export function normalize(s: string): string {
  return s
    .replace(/[*_`>#]/g, "")
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RawCitation {
  passage_id: string;
  quote: string;
}

/**
 * 모델이 인용했다고 한 문장이 실제 원고에 그대로 있는지 확인합니다.
 * 없는 인용은 버립니다. 문단 번호가 틀렸지만 다른 문단에 있으면 바로잡습니다.
 */
export function verifyCitations(raw: RawCitation[], passages: Passage[]): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const q = normalize(c.quote ?? "");
    if (q.length < 8) continue;
    const exact = passages.find((p) => p.id === c.passage_id && normalize(p.text).includes(q));
    const found = exact ?? passages.find((p) => normalize(p.text).includes(q));
    if (!found) continue;
    const key = `${found.id}:${q}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // 화면에 그대로 보이도록 마크다운 굵게 표시는 뺍니다.
    out.push({ passageId: found.id, question: found.question, quote: c.quote.replace(/\*\*/g, "").trim() });
  }
  return out;
}
