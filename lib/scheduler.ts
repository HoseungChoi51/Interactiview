import fs from "node:fs";
import path from "node:path";
import { kstWeekKey } from "./week";
import { runWeekly } from "./weekly";

/**
 * 컴퓨터에서 운영할 때 쓰는 주간 메일 예약.
 * 10분마다 확인해서, 이번 주(KST 월요일 09:00 이후)에 아직 안 보냈으면 한 번 보냅니다.
 * 컴퓨터가 월요일 아침에 꺼져 있었다면 켜진 뒤에 보냅니다. 메일 키(RESEND_API_KEY)가 없으면 아무것도 하지 않습니다.
 */
export function startWeeklyScheduler() {
  if (!process.env.RESEND_API_KEY) return;
  const marker = path.join(process.cwd(), ".data", "weekly-last.txt");
  let running = false;
  const tick = async () => {
    const { week, afterMonday9 } = kstWeekKey(new Date());
    if (running || !afterMonday9) return;
    const last = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : "";
    if (last === week) return;
    running = true;
    try {
      fs.mkdirSync(path.dirname(marker), { recursive: true });
      fs.writeFileSync(marker, week);
      const r = await runWeekly(false);
      console.log(`[weekly] ${week} 주간 메일: 인터뷰이 ${r.interviewees.length}명, 운영자 ${r.admin.sent ? "보냄" : r.admin.error}`);
    } catch (e) {
      console.error("[weekly] 실패", e);
    } finally {
      running = false;
    }
  };
  setInterval(tick, 10 * 60 * 1000).unref();
  setTimeout(tick, 30 * 1000).unref();
}
