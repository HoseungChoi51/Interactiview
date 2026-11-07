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
    .replace(/^\s*---\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

/** "**제목**" 같은 굵게 표시를 벗겨낸 순수 텍스트 */
const plain = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

const HEADING = /^(#{1,4})\s+(.+?)\s*$/;
/** "**Q. 질문**", "**Q.** 질문", "Q 질문", "Q. 질문" */
const Q_LINE = /^Q\s*[.:．]?\s+(.+)$|^Q[.:．](.+)$/;
/** 답변 첫 줄의 "**A.**", "**A**.", "A" 표시 */
const A_MARK = /^\s*(?:\*\*)?A(?:\*\*)?\s*[.:．]?\s*(?:\*\*)?\s*/;
const NOTES_TITLES = new Set(["주", "주석", "각주", "참고", "참고문헌"]);

const MIN_ANSWER = 10;

/**
 * 인터뷰이 한 명의 원고를 문단(질문 단위)으로 나눕니다.
 *
 * 문답 형식(노션 원고 기본): "Q. 질문" 줄마다 문단 하나. 소제목(##, ###)은 section 으로 붙습니다.
 *   첫 Q 전의 본문은 자기소개, "## 주" 같은 주석 절은 따로 한 문단이 됩니다.
 * 제목 형식(Q 줄이 없을 때): "## 제목"이 질문, 그 아래가 답. "##"이 없으면 "###".
 */
export function parsePersona(raw: string, slug: string): Persona {
  const { data, content } = matter(raw);
  const lines = cleanNotion(content).split("\n");
  const qCount = lines.filter((l) => Q_LINE.test(plain(l))).length;
  const parsed = qCount >= 2 ? parseQA(lines, slug) : parseHeadings(lines, slug);

  const name = String(data.name ?? parsed.title ?? slug).trim();
  return {
    slug,
    name,
    role: String(data.role ?? "").trim(),
    tagline: String(data.tagline ?? parsed.tagline ?? "").trim(),
    tags: asList(data.tags),
    sampleQuestions: asList(data.sample_questions),
    personaMemo: String(data.persona_memo ?? "").trim(),
    quoteOnly: data.quote_only === true,
    passages: parsed.passages,
  };
}

interface Parsed {
  title: string | null;
  tagline: string | null;
  passages: Passage[];
}

function parseQA(lines: string[], slug: string): Parsed {
  let title: string | null = null;
  let tagline: string | null = null;
  let section: string | undefined;
  const intro: string[] = [];
  const notes: string[] = [];
  const passages: Passage[] = [];
  let cur: { question: string; section?: string; buf: string[] } | null = null;
  let inNotes = false;
  let seenBody = false;
  let n = 0;

  const flush = () => {
    if (!cur) return;
    const text = cur.buf.join("\n").replace(A_MARK, "").trim();
    if (text.length >= MIN_ANSWER) {
      n += 1;
      passages.push({ id: `${slug}-q${n}`, question: cur.question, section: cur.section, text });
    }
    cur = null;
  };

  for (const line of lines) {
    const h = HEADING.exec(line);
    if (h) {
      const text = plain(h[2]);
      if (title === null && h[1] === "#") {
        title = text;
        continue;
      }
      if (!seenBody && !cur && tagline === null && text !== "자기소개") {
        // 이름 바로 아래의 큰 제목은 한 줄 소개로 씁니다.
        tagline = text;
        continue;
      }
      flush();
      inNotes = NOTES_TITLES.has(text);
      if (!inNotes && text !== "자기소개") section = text;
      continue;
    }
    if (inNotes) {
      notes.push(line);
      continue;
    }
    const q = Q_LINE.exec(plain(line));
    if (q) {
      flush();
      cur = { question: (q[1] ?? q[2]).trim(), section, buf: [] };
      continue;
    }
    if (cur) {
      cur.buf.push(line);
      continue;
    }
    // 첫 질문 전: 이름만 있는 줄은 건너뛰고 나머지는 자기소개
    if (!line.trim()) continue;
    if (title && plain(line).length <= 20 && title.includes(plain(line))) continue;
    seenBody = true;
    intro.push(line);
  }
  flush();

  const out: Passage[] = [];
  const introText = intro.join("\n\n").trim();
  if (introText) out.push({ id: `${slug}-intro`, question: "자기소개", text: introText });
  out.push(...passages);
  const notesText = notes.filter((l) => l.trim()).join("\n\n").trim();
  if (notesText) out.push({ id: `${slug}-notes`, question: "주석", text: notesText });
  return { title, tagline, passages: out };
}

function parseHeadings(lines: string[], slug: string): Parsed {
  let title: string | null = null;
  const hasH2 = lines.some((l) => /^##\s+\S/.test(l));
  const qRe = hasH2 ? /^##\s+(.+?)\s*$/ : /^###\s+(.+?)\s*$/;

  const passages: Passage[] = [];
  let current: { question: string; buf: string[] } = { question: "자기소개", buf: [] };
  let n = 0;
  let inIntro = true;
  const flush = () => {
    const text = current.buf.join("\n").trim();
    if (!text) return;
    if (NOTES_TITLES.has(current.question)) passages.push({ id: `${slug}-notes`, question: "주석", text });
    else passages.push({ id: inIntro ? `${slug}-intro` : `${slug}-q${n}`, question: current.question, text });
  };

  for (const line of lines) {
    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1 && title === null && inIntro) {
      title = plain(h1[1]);
      continue;
    }
    const q = qRe.exec(line);
    if (q) {
      flush();
      inIntro = false;
      const question = plain(q[1]);
      if (!NOTES_TITLES.has(question)) n += 1;
      current = { question, buf: [] };
      continue;
    }
    current.buf.push(line);
  }
  flush();
  return { title, tagline: null, passages };
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
