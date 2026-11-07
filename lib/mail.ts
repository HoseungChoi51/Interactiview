import "server-only";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Resend 로 메일을 보냅니다. 키가 없으면 보내지 않고 sent:false 를 돌려줍니다. */
export async function sendMail(m: Mail): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "RESEND_API_KEY 없음" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text }),
  });
  if (!res.ok) return { sent: false, error: `${res.status} ${await res.text()}` };
  return { sent: true };
}

/** INTERVIEWEE_EMAILS=slug:메일,slug:메일 */
export function intervieweeEmails(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (process.env.INTERVIEWEE_EMAILS ?? "").split(",")) {
    const [slug, email] = pair.split(":").map((s) => s?.trim());
    if (slug && email) out[slug] = email;
  }
  return out;
}

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
