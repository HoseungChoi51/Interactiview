import "server-only";
import { cookies } from "next/headers";
import { store } from "./store";
import type { Visitor } from "./types";

export const VISITOR_COOKIE = "iv_visitor";

export async function currentVisitor(): Promise<Visitor | null> {
  const id = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return store().getVisitor(id);
}
