import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { ReactionKind } from "@/lib/types";
import { currentVisitor } from "@/lib/visitor";

const KINDS: ReactionKind[] = ["resonate", "more", "off"];

export async function POST(req: Request) {
  const visitor = await currentVisitor();
  if (!visitor) return NextResponse.json({ error: "초대 링크로 먼저 들어와 주세요." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { messageId?: string; kind?: ReactionKind; note?: string };
  const msg = body.messageId ? await store().getMessage(body.messageId) : null;
  if (!msg || msg.visitorId !== visitor.id || msg.role !== "assistant" || !KINDS.includes(body.kind as ReactionKind)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const note = body.note?.trim().slice(0, 500) || null;
  const active = await store().toggleReaction(msg.id, visitor.id, body.kind as ReactionKind, note);
  return NextResponse.json({ active });
}
