import { NextResponse } from "next/server";
import { chat, UserError } from "@/lib/service";
import { currentVisitor } from "@/lib/visitor";

export const maxDuration = 60;

export async function POST(req: Request) {
  const visitor = await currentVisitor();
  if (!visitor) return NextResponse.json({ error: "초대 링크로 먼저 들어와 주세요." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { persona?: string; question?: string };
  try {
    const { user, reply } = await chat(visitor, String(body.persona ?? ""), String(body.question ?? ""));
    return NextResponse.json({ user, reply });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("chat failed", e);
    return NextResponse.json({ error: "답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
