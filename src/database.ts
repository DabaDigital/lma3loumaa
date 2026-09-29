import { PostgrestClient } from "@supabase/postgrest-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Reads public tables as an anonymous visitor: the same requests, headers and
 * retries as supabase-js, without its sign-in, realtime and storage clients
 * (about 50 KB compressed). Those load with loadSupabase() once something
 * needs them, so a visitor's page load does not download them. */
export const publicDb =
  url && key
    ? new PostgrestClient(new URL("rest/v1", url.replace(/\/*$/, "/")).href, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
    : null;

/** What reading a table needs, from either client. */
export type Reader = Pick<PostgrestClient, "from">;

let client: Promise<SupabaseClient | null> | undefined;

/** The full client (src/supabase.ts), downloaded on first use. */
export const loadSupabase = () =>
  (client ??= import("./supabase").then((module) => module.supabase));

/** True when a dashboard session is stored in this browser. Its reads go
 * through supabase-js, with that user's rights. */
export function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++)
      if (/^sb-.*-auth-token$/.test(localStorage.key(i) ?? "")) return true;
  } catch {}
  return false;
}
