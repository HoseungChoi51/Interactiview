/** KST 기준 그 주 월요일 날짜 (YYYY-MM-DD) */
export function kstWeekKey(d: Date): { week: string; afterMonday9: boolean } {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const dow = (kst.getUTCDay() + 6) % 7; // 월=0
  const monday = new Date(kst.getTime() - dow * 24 * 60 * 60 * 1000);
  const hour = kst.getUTCHours();
  return { week: monday.toISOString().slice(0, 10), afterMonday9: dow > 0 || hour >= 9 };
}
