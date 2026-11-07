import { NextResponse } from "next/server";
import { runWeekly } from "@/lib/weekly";

export const maxDuration = 120;

/**
 * 주간 메일을 보냅니다. 컴퓨터에서 운영하면 서버가 매주 월요일 09:00(KST)에 알아서 실행하고 (lib/scheduler.ts),
 * Vercel 에서는 vercel.json 의 예약 작업이 호출합니다. ?dry=1 이면 보내지 않고 내용만 돌려줍니다.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const params = new URL(req.url).searchParams;
  const adminKey = params.get("key");
  if (!(secret && auth === `Bearer ${secret}`) && !(process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runWeekly(params.get("dry") === "1"));
}
