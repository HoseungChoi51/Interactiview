export async function register() {
  // Vercel 에서는 vercel.json 예약 작업을 쓰므로, 직접 띄운 서버(npm start)에서만 예약을 켭니다.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL && process.env.NODE_ENV === "production") {
    const { startWeeklyScheduler } = await import("./lib/scheduler");
    startWeeklyScheduler();
  }
}
