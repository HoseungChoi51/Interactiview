import type { ChatMessage, NewMessage, Question, QuestionStatus, Reaction, ReactionKind, Visitor, Vote } from "../types";

export interface Store {
  createVisitor(nickname: string): Promise<Visitor>;
  getVisitor(id: string): Promise<Visitor | null>;
  countVisitors(): Promise<number>;

  addMessage(m: NewMessage): Promise<ChatMessage>;
  getMessage(id: string): Promise<ChatMessage | null>;
  /** 한 독자와 한 인터뷰이의 대화, 오래된 순 */
  listConversation(visitorId: string, persona: string): Promise<ChatMessage[]>;
  listMessagesByVisitor(visitorId: string): Promise<ChatMessage[]>;
  countUserMessagesSince(visitorId: string, since: Date): Promise<number>;
  listAllMessages(since?: Date): Promise<ChatMessage[]>;

  /** 반응을 켜고 끕니다. 켜진 상태면 true */
  toggleReaction(messageId: string, visitorId: string, kind: ReactionKind, note?: string | null): Promise<boolean>;
  listReactions(): Promise<Reaction[]>;
  listReactionsByVisitor(visitorId: string): Promise<Reaction[]>;

  /** persona 를 주면 그 인터뷰이 것만 */
  listQuestions(persona?: string): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | null>;
  createQuestion(q: { persona: string; original: string; text: string }): Promise<Question>;
  updateQuestion(id: string, patch: { status?: QuestionStatus; answer?: string | null; text?: string }): Promise<void>;

  /** 같은 질문에 독자가 한 표. 이미 있으면 무시 */
  addVote(questionId: string, visitorId: string): Promise<void>;
  listVotesByVisitor(visitorId: string): Promise<Vote[]>;
  markVotesSeen(visitorId: string, questionIds: string[]): Promise<void>;
}
