import "server-only";
import { cookies } from "next/headers";

export async function isAdmin(): Promise<boolean> {
  const key = process.env.ADMIN_KEY;
  if (!key) return false;
  return (await cookies()).get("iv_admin")?.value === key;
}
