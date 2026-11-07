import "server-only";
import { fileStore } from "./file";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export const usingSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function store(): Store {
  return usingSupabase ? supabaseStore : fileStore;
}
