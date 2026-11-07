import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { VISITOR_COOKIE } from "@/lib/visitor";

async function join(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 20);
  const expected = process.env.INVITE_CODE;
  if (expected && code !== expected) redirect(`/join?code=${encodeURIComponent(code)}&e=code`);
  if (!nickname) redirect(`/join?code=${encodeURIComponent(code)}&e=name`);
  if (formData.get("agree") !== "on") redirect(`/join?code=${encodeURIComponent(code)}&e=agree`);
  const v = await store().createVisitor(nickname);
  (await cookies()).set(VISITOR_COOKIE, v.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}

const ERRORS: Record<string, string> = {
  code: "초대 코드가 맞지 않아요. 받은 링크를 다시 확인해 주세요.",
  name: "닉네임을 입력해 주세요.",
  agree: "안내에 동의해 주셔야 시작할 수 있어요.",
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string; e?: string }> }) {
  const { code = "", e } = await searchParams;
  return (
    <main className="wrap narrow" style={{ paddingTop: 64 }}>
      <p className="muted small">베타 초대</p>
      <h1 className="serif">16명에게 직접 묻는 인터뷰집</h1>
      <p className="muted">
        책을 앞에서부터 읽는 대신, 궁금한 사람에게 바로 말을 걸어보세요. 답은 그 사람이 직접 쓴 원고에서 옵니다.
      </p>
      <form action={join} className="card" style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
        <input type="hidden" name="code" value={code} />
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>닉네임</div>
          <input type="text" name="nickname" maxLength={20} placeholder="대화에서 불릴 이름" autoComplete="nickname" />
        </label>
        <div className="small muted" style={{ background: "var(--bg)", padding: 12, borderRadius: 10 }}>
          <b>안내</b>
          <br />· 남겨주신 질문과 반응은 책을 개선하고, 인터뷰이에게 질문을 전달하는 데 쓰입니다.
          <br />· 인터뷰이에게는 질문 내용만 전달되고 닉네임은 전달되지 않습니다. 회사명 같은 개인정보는 자동으로 가려집니다.
          <br />· 원고에 없는 내용은 AI가 원고를 바탕으로 이어 쓴 답이며, 항상 따로 표시됩니다.
          <br />· 로그인 정보가 이 브라우저에만 저장되어, 다른 기기에서는 대화가 이어지지 않아요.
        </div>
        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="agree" /> 위 안내를 읽었고 동의합니다
        </label>
        {e && ERRORS[e] && <div className="error">{ERRORS[e]}</div>}
        <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>
          시작하기
        </button>
      </form>
    </main>
  );
}
