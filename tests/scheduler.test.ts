import { describe, expect, it } from "vitest";
import { kstWeekKey } from "@/lib/week";

describe("kstWeekKey", () => {
  it("uses Monday 09:00 KST as the weekly boundary", () => {
    // 2026-11-09 은 월요일. 08:59 KST = 전날 23:59 UTC
    expect(kstWeekKey(new Date("2026-11-08T23:59:00Z"))).toMatchObject({ week: "2026-11-09", afterMonday9: false });
    expect(kstWeekKey(new Date("2026-11-09T00:00:00Z"))).toMatchObject({ week: "2026-11-09", afterMonday9: true });
    // 일요일 밤(KST)은 그 주 월요일 소속
    expect(kstWeekKey(new Date("2026-11-15T14:00:00Z"))).toMatchObject({ week: "2026-11-09", afterMonday9: true });
  });
});
