"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ReactionKind } from "@/lib/types";

const LABEL: Record<string, string> = {
  quote: "원문 인용",
  bridge: "원고를 바탕으로 AI가 이어 쓴 답",
  none: "아직 답하지 않은 질문",
};

const REACTIONS: { kind: ReactionKind; text: string }[] = [
  { kind: "resonate", text: "공감돼요" },
  { kind: "more", text: "더 듣고 싶어요" },
  { kind: "off", text: "답이 어긋났어요" },
];

interface Props {
  slug: string;
  name: string;
  greeting: string;
  samples: string[];
  initial: ChatMessage[];
  initialReactions: Record<string, ReactionKind[]>;
}

export default function Chat({ slug, name, greeting, samples, initial, initialReactions }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [reactions, setReactions] = useState<Record<string, ReactionKind[]>>(initialReactions);
  const [asked, setAsked] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      visitorId: "",
      persona: slug,
      role: "user",
      content: question,
      kind: null,
      citations: [],
      topics: [],
      sensitive: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, temp]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: slug, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "오류가 났어요.");
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), data.user, data.reply]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setText(question);
      setError(e instanceof Error ? e.message : "오류가 났어요.");
    } finally {
      setBusy(false);
    }
  }

  async function react(messageId: string, kind: ReactionKind) {
    const on = reactions[messageId]?.includes(kind);
    let note: string | null = null;
    if (kind === "off" && !on) note = window.prompt("어떤 점이 어긋났는지 한 줄로 알려주시면 고칠게요. (선택)", "") || null;
    const res = await fetch("/api/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, kind, note }),
    });
    if (!res.ok) return;
    const { active } = await res.json();
    setReactions((r) => {
      const cur = new Set(r[messageId] ?? []);
      if (active) cur.add(kind);
      else cur.delete(kind);
      return { ...r, [messageId]: [...cur] };
    });
  }

  async function ask(messageId: string) {
    setAsked((a) => ({ ...a, [messageId]: "보내는 중…" }));
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    const data = await res.json();
    setAsked((a) => ({
      ...a,
      [messageId]: res.ok
        ? data.merged
          ? `비슷한 질문이 이미 있어서 한 표를 보탰어요. ${name}님이 답하면 첫 화면에 알려드릴게요.`
          : `${name}님께 질문을 남겼어요. 답이 오면 첫 화면에 알려드릴게요.`
        : data.error ?? "보내지 못했어요.",
    }));
  }

  return (
    <>
      <div className="thread">
        <div className="them">
          <div className="bubble">{greeting}</div>
          {messages.length === 0 && samples.length > 0 && (
            <div className="suggest">
              {samples.map((s) => (
                <button key={s} className="btn" onClick={() => send(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="bubble me">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="them">
              {m.kind && <span className={`label ${m.kind}`}>{LABEL[m.kind]}</span>}
              <div className="bubble">{m.content}</div>
              {m.citations.map((c, i) => (
                <Link key={i} href={`/p/${slug}/read#${c.passageId}`} className="qcard serif">
                  <div className="q">원고 · {c.question}</div>“{c.quote.replace(/\*\*/g, "").replace(/\s*〔\d+〕/g, "")}”
                </Link>
              ))}
              <div className="reacts">
                {REACTIONS.map((r) => (
                  <button key={r.kind} className={`btn ${reactions[m.id]?.includes(r.kind) ? "on" : ""}`} onClick={() => react(m.id, r.kind)}>
                    {r.text}
                  </button>
                ))}
                {!m.sensitive && (m.kind === "none" || m.kind === "bridge") && !asked[m.id] && (
                  <button className={`btn ${m.kind === "none" ? "primary" : ""}`} onClick={() => ask(m.id)}>
                    {m.kind === "none" ? `${name}님께 직접 물어보기` : `${name}님께 직접 듣고 싶어요`}
                  </button>
                )}
              </div>
              {asked[m.id] && <div className="ask-done">{asked[m.id]}</div>}
            </div>
          ),
        )}
        {busy && <div className="typing">{name}님이 답을 쓰고 있어요…</div>}
        {error && <div className="error">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder={`${name}님께 궁금한 것을 물어보세요`}
            rows={1}
            maxLength={1000}
          />
          <button className="btn primary" type="submit" disabled={busy || !text.trim()} style={{ height: 52 }}>
            보내기
          </button>
        </form>
      </div>
    </>
  );
}
