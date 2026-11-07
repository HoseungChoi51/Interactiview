import { NextResponse } from "next/server";
import { askInterviewee, UserError } from "@/lib/service";
import { currentVisitor } from "@/lib/visitor";

export const maxDuration = 60;

export async function POST(req: Request) {
  const visitor = await currentVisitor();
  if (!visitor) return NextResponse.json({ error: "초대 링크로 먼저 들어와 주세요." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { messageId?: string };
  try {
    const r = await askInterviewee(visitor, String(body.messageId ?? ""));
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("ask failed", e);
    return NextResponse.json({ error: "질문을 보내지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
