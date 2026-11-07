export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // 엑셀에서 한글이 깨지지 않도록 BOM 을 붙입니다.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
