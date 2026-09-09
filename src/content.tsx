import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { categories, items, locations } from "./data";
import type { Item, Localized } from "./data";
import { supabase } from "./supabase";

export type Managed = {
  id: string;
  name: Localized;
  available: boolean;
  sort_order: number;
};
export type Category = Managed & { icon: string };
export type MenuItem = Item & Managed;
export type Location = Managed & {
  area: Localized;
  address: Localized;
  image: string;
  map: string;
};
export type Content = {
  categories: Category[];
  items: MenuItem[];
  locations: Location[];
};
const defaults: Content = {
  categories: categories
    .filter((c) => c.id !== "all")
    .map((c, i) => ({ ...c, available: true, sort_order: i })),
  items: items.map((c, i) => ({ ...c, available: true, sort_order: i })),
  locations: locations.map((c, i) => ({
    ...c,
    available: true,
    sort_order: i,
  })),
};
const empty: Content = { categories: [], items: [], locations: [] };
const Context = createContext<
  Content & { loading: boolean; error: boolean; refresh: () => Promise<void> }
>({ ...empty, loading: true, error: false, refresh: async () => {} });
export function ContentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(supabase ? empty : defaults);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const version = ++request.current;
    try {
      const results = await Promise.all(
        ["categories", "menu_items", "locations"].map((table) =>
          supabase!.from(table).select("*").order("sort_order").order("id"),
        ),
      );
      if (version !== request.current) return;
      if (results.some((r) => r.error)) throw new Error("content unavailable");
      const next = {
        categories: results[0].data as Category[],
        items: results[1].data as MenuItem[],
        locations: results[2].data as Location[],
      };
      // Polls often return identical content. Preserve references so menu
      // filtering, reveal observers and open previews do not rerender.
      setData((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
      setError(false);
    } catch {
      if (version === request.current) setError(true);
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;
    let authUser: string | null | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (active) void refresh();
      }, 50);
    };
    void refresh();
    if (!supabase) return;
    const channel = supabase.channel("website-content");
    for (const table of ["categories", "menu_items", "locations"])
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    channel.subscribe();
    const onFocus = scheduleRefresh;
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user.id ?? null;
      // INITIAL_SESSION is already covered by the mount request. SIGNED_IN
      // can fire again just because the same user returns to the tab.
      const sameUser = user === authUser;
      authUser = user;
      if (event === "INITIAL_SESSION" || (event === "SIGNED_IN" && sameUser))
        return;
      request.current++;
      if (!sameUser || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setData(empty);
        setLoading(true);
      }
      scheduleRefresh();
    });
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      request.current++;
      void supabase!.removeChannel(channel);
      auth.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [refresh]);
  const value = useMemo(
    () => ({ ...data, loading, error, refresh }),
    [data, loading, error, refresh],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useContent = () => useContext(Context);
export function usePublicContent() {
  const content = useContent();
  return useMemo(() => {
    const categories = content.categories.filter((c) => c.available);
    const availableCategories = new Set(categories.map((c) => c.id));
    return {
      ...content,
      categories,
      items: content.items.filter(
        (i) => i.available && availableCategories.has(i.category),
      ),
      locations: content.locations.filter((l) => l.available),
    };
  }, [content]);
}
