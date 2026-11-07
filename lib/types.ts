export type AnswerKind = "quote" | "bridge" | "none";

export interface Passage {
  /** 예: sample-jiwoo-q2, sample-jiwoo-intro, sample-jiwoo-a3(추가 답변) */
  id: string;
  /** 질문 제목. 자기소개는 "자기소개", 주석은 "주석" */
  question: string;
  /** 원고의 소제목 (예: "AI에게 맡기는 것, 사람이 쥐는 것") */
  section?: string;
  text: string;
  /** 인터뷰이가 서비스에서 추가로 답한 문단이면 true */
  extra?: boolean;
}

export interface Persona {
  slug: string;
  name: string;
  role: string;
  tagline: string;
  tags: string[];
  sampleQuestions: string[];
  personaMemo: string;
  quoteOnly: boolean;
  passages: Passage[];
}

export interface Citation {
  passageId: string;
  question: string;
  quote: string;
}

export interface Visitor {
  id: string;
  nickname: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  visitorId: string;
  persona: string;
  role: "user" | "assistant";
  content: string;
  kind: AnswerKind | null;
  citations: Citation[];
  topics: string[];
  sensitive: boolean;
  createdAt: string;
}

export type NewMessage = Omit<ChatMessage, "id" | "createdAt">;

export type ReactionKind = "resonate" | "more" | "off";

export interface Reaction {
  id: string;
  messageId: string;
  visitorId: string;
  kind: ReactionKind;
  note: string | null;
  createdAt: string;
}

export type QuestionStatus = "open" | "answered" | "skipped" | "hidden";

export interface Question {
  id: string;
  persona: string;
  /** 독자가 쓴 원래 질문 (관리자만 봄) */
  original: string;
  /** 개인정보를 가리고 다듬은 질문 (인터뷰이에게 보임) */
  text: string;
  status: QuestionStatus;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  /** 같은 질문을 요청한 독자 수 */
  votes: number;
}

export interface Vote {
  questionId: string;
  visitorId: string;
  seen: boolean;
  createdAt: string;
}
