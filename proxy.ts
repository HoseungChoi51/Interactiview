import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "iv_visitor";
const ADMIN_COOKIE = "iv_admin";

/** 초대받은 독자만 들어오게 합니다. 인터뷰이 답변 링크, 관리 페이지, 예약 작업은 각자 따로 확인합니다. */
export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === "/admin" && searchParams.get("key")) {
    const url = req.nextUrl.clone();
    url.search = "";
    const res = NextResponse.redirect(url);
    if (searchParams.get("key") === process.env.ADMIN_KEY) {
      res.cookies.set(ADMIN_COOKIE, searchParams.get("key")!, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 30 });
    }
    return res;
  }

  const open = pathname.startsWith("/join") || pathname.startsWith("/answer") || pathname.startsWith("/admin") || pathname.startsWith("/api/cron") || pathname.startsWith("/api/admin");
  if (open) return NextResponse.next();

  if (!req.cookies.get(VISITOR_COOKIE)?.value) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "초대 링크로 먼저 들어와 주세요." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/join";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
