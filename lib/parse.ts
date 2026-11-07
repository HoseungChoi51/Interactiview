import matter from "gray-matter";
import type { Passage, Persona } from "./types";

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

/** 노션에서 내보낸 마크다운에 섞여 오는 흔한 잡음을 정리합니다. */
function cleanNotion(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/<aside>[\s\S]*?<\/aside>/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * 인터뷰이 한 명의 원고를 문단(질문 단위)으로 나눕니다.
 * - 첫 질문 제목 전까지는 자기소개(intro)
 * - "## 제목"이 질문입니다. "##"이 하나도 없으면 "###"을 질문으로 봅니다.
 */
export function parsePersona(raw: string, slug: string): Persona {
  const { data, content } = matter(raw);
  const body = cleanNotion(content);
  const lines = body.split("\n");

  let title: string | null = null;
  const hasH2 = lines.some((l) => /^##\s+\S/.test(l));
  const qRe = hasH2 ? /^##\s+(.+?)\s*$/ : /^###\s+(.+?)\s*$/;

  const passages: Passage[] = [];
  let current: { question: string; buf: string[] } = { question: "자기소개", buf: [] };
  let n = 0;
  const flush = (isIntro: boolean) => {
    const text = current.buf.join("\n").trim();
    if (text) {
      passages.push({
        id: isIntro ? `${slug}-intro` : `${slug}-q${n}`,
        question: current.question,
        text,
      });
    }
  };

  let inIntro = true;
  for (const line of lines) {
    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1 && title === null && inIntro) {
      title = h1[1];
      continue;
    }
    const q = qRe.exec(line);
    if (q) {
      flush(inIntro);
      inIntro = false;
      n += 1;
      current = { question: q[1].replace(/\*\*/g, "").trim(), buf: [] };
      continue;
    }
    current.buf.push(line);
  }
  flush(inIntro);

  const name = String(data.name ?? title ?? slug).trim();
  return {
    slug,
    name,
    role: String(data.role ?? "").trim(),
    tagline: String(data.tagline ?? "").trim(),
    tags: asList(data.tags),
    sampleQuestions: asList(data.sample_questions),
    personaMemo: String(data.persona_memo ?? "").trim(),
    quoteOnly: data.quote_only === true,
    passages,
  };
}

/** 파일 이름으로 슬러그를 만듭니다. 노션 내보내기 파일명 끝의 ID(32자리 16진수)는 뺍니다. */
export function slugFromFilename(file: string): string {
  return file
    .replace(/\.md$/i, "")
    .replace(/\s+[0-9a-f]{32}$/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}
