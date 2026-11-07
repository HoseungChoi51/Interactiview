import type { Persona } from "./types";
import type { AnswerResult } from "./ai";

const STOP = new Set(["뭐예", "뭔가", "무엇", "어떻", "어떤", "어떻게", "있나", "있어", "있었", "없었", "궁금해", "궁금", "그리고", "그런", "정말", "혹시", "지금", "있다면", "하는", "했나", "했어", "였나"]);

/** 2글자 이상 한국어/영어 단어. 조사와 흔한 의문 표현은 뺍니다. */
export function keywords(s: string): string[] {
  const words = s.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? [];
  return words
    .map((w) => w.replace(/(은|는|이|가|을|를|에서|에게|으로|로|와|과|의|도|요|까요|나요|세요|예요|이에요)$/u, ""))
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/**
 * API 키가 없을 때 쓰는 데모 응답. 질문과 단어가 가장 많이 겹치는 문단을 찾아 그대로 인용합니다.
 * 실제 서비스 품질과는 다르며, 화면과 흐름을 확인하는 용도입니다.
 */
export function mockAnswer(p: Persona, question: string): AnswerResult {
  const qk = new Set(keywords(question));
  let best = { score: 0, idx: -1 };
  p.passages.forEach((x, idx) => {
    const pk = keywords(`${x.question} ${x.question} ${x.text}`);
    const score = pk.filter((w) => [...qk].some((q) => w.startsWith(q) || q.startsWith(w))).length;
    if (score > best.score) best = { score, idx };
  });
  const topics = [...qk].slice(0, 2);
  if (best.score < 2) {
    return {
      kind: "none",
      answer: "그 이야기는 아직 원고에 쓰지 않았어요. 직접 물어봐 주시면 다음에 답해볼게요. (데모 모드)",
      citations: [],
      topics,
      sensitive: false,
      demo: true,
    };
  }
  const passage = p.passages[best.idx];
  const sentences = passage.text.replace(/\n+/g, " ").split(/(?<=[.!?요다])\s+/).filter((s) => s.length > 8);
  const quote = sentences.slice(0, 2).join(" ");
  return {
    kind: "quote",
    answer: `원고에 이렇게 썼어요. (데모 모드: Claude API 키를 넣으면 질문에 맞춰 답합니다)`,
    citations: [{ passage_id: passage.id, quote }],
    topics,
    sensitive: false,
    demo: true,
  };
}
