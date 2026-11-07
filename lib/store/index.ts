import "server-only";
import path from "node:path";
import { createSqliteStore } from "./sqlite";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export const usingSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let local: Store | null = null;

/** Supabase 설정이 있으면 Supabase, 없으면 컴퓨터 안의 SQLite 파일(.data/interactiview.db) */
export function store(): Store {
  if (usingSupabase) return supabaseStore;
  local ??= createSqliteStore(process.env.DB_FILE ?? path.join(process.cwd(), ".data", "interactiview.db"));
  return local;
}
