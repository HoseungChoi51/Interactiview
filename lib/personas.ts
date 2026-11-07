import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parsePersona, slugFromFilename } from "./parse";
import type { Persona, Question } from "./types";

const DIR = path.join(process.cwd(), "content", "personas");

let cache: Persona[] | null = null;

/** content/personas/*.md 를 모두 읽습니다. "_"로 시작하는 파일은 건너뜁니다. */
export function loadPersonas(): Persona[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"))
    .sort();
  cache = files.map((f) => parsePersona(fs.readFileSync(path.join(DIR, f), "utf8"), slugFromFilename(f)));
  return cache;
}

export function getPersona(slug: string): Persona | null {
  return loadPersonas().find((p) => p.slug === slug) ?? null;
}

/** 원고에 인터뷰이가 서비스에서 추가로 답한 문단을 덧붙입니다. */
export function withExtraAnswers(p: Persona, answered: Question[]): Persona {
  const extra = answered
    .filter((q) => q.persona === p.slug && q.status === "answered" && q.answer)
    .sort((a, b) => (a.answeredAt ?? "").localeCompare(b.answeredAt ?? ""))
    .map((q) => ({
      id: `${p.slug}-a-${q.id.slice(0, 8)}`,
      question: q.text,
      text: q.answer as string,
      extra: true,
    }));
  return { ...p, passages: [...p.passages, ...extra] };
}
