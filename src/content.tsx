import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { categories, instagramUrl, items, locations } from "./data";
import type { Item, Localized } from "./data";
import { hasStoredSession, loadSupabase, publicDb } from "./database";
import type { Reader } from "./database";
import { onFirstInput } from "./firstInput";
import { onWindowReturn } from "./windowReturn";

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
export type LinkKind = "social" | "order";
/** A social profile or ordering platform, managed in the dashboard. */
export type SiteLink = {
  id: string;
  kind: LinkKind;
  /** A key from the platform catalog in links.tsx, or "other". */
  platform: string;
  /** Display name; only used for "other" platforms. */
  label: string;
  url: string;
  available: boolean;
  sort_order: number;
};
/** A post or reel shown in the follow-us carousel. */
export type SocialPost = {
  id: string;
  url: string;
  video: string | null;
  poster: string | null;
  caption: string;
  available: boolean;
  sort_order: number;
};
// What visitors see until the dashboard's links are read (or without a
// database). Glovo's locale-aware default lives in links.tsx.
const defaultLinks: SiteLink[] = [
  {
    id: "instagram",
    kind: "social",
    platform: "instagram",
    label: "",
    url: instagramUrl,
    available: true,
    sort_order: 0,
  },
];
const bySortOrder = <T extends { sort_order: number; id: string }>(
  a: T,
  b: T,
) => a.sort_order - b.sort_order || a.id.localeCompare(b.id);
// Also reads rows from before the open-links migration, which only had an id
// (the platform) and a URL, empty when not shown.
function readLinks(rows: Partial<SiteLink>[]): SiteLink[] {
  return rows
    .filter((row) => row.id && /^https:\/\/\S+$/.test(row.url ?? ""))
    .map((row, index) => {
      const platform = row.platform ?? row.id!;
      return {
        id: row.id!,
        kind:
          row.kind ??
          (platform === "glovo" || platform === "klit" ? "order" : "social"),
        platform,
        label: row.label ?? "",
        url: row.url!,
        available: row.available ?? true,
        sort_order: row.sort_order ?? index,
      };
    })
    .sort(bySortOrder);
}
type Rows = { data: any[] | null; error: unknown };
// The full-menu page starts these public requests before the app has
// downloaded (vite.config.ts); the first refresh takes their responses.
function takeEarlyRequests() {
  const page = window as { __lmaContent?: Record<string, Promise<Rows>> };
  const early = page.__lmaContent;
  delete page.__lmaContent;
  return early;
}
// An early request that failed is made again through the client, which
// retries as usual.
const orEarly = (
  early: Promise<Rows> | undefined,
  query: () => PromiseLike<Rows>,
): PromiseLike<Rows> =>
  early ? early.then((rows) => (rows.error ? query() : rows)) : query();
// Reads a table that may not exist yet without failing the menu request:
// null means "could not be read".
const readOptional = <T,>(
  db: Reader,
  table: string,
  read: (rows: any[]) => T,
  early?: Promise<Rows>,
) =>
  orEarly(early, () => db.from(table).select("*")).then(
    ({ data: rows, error: failure }) => (failure || !rows ? null : read(rows)),
    () => null,
  );
// Keeps the previous reference when a poll returns identical data.
const same = <T,>(previous: T, next: T) =>
  JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
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
  Content & {
    /** Null until the links table has been read successfully. */
    links: SiteLink[] | null;
    linksError: boolean;
    /** Null until the posts table has been read successfully. */
    posts: SocialPost[] | null;
    postsError: boolean;
    loading: boolean;
    error: boolean;
    refresh: () => Promise<void>;
  }
>({
  ...empty,
  links: null,
  linksError: false,
  posts: null,
  postsError: false,
  loading: true,
  error: false,
  refresh: async () => {},
});
export function ContentProvider({
  admin,
  children,
}: {
  /** The dashboard reads and follows changes with the signed-in user's rights. */
  admin: boolean;
  children: ReactNode;
}) {
  const [data, setData] = useState(publicDb ? empty : defaults);
  const [links, setLinks] = useState<SiteLink[] | null>(null);
  const [linksError, setLinksError] = useState(false);
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [postsError, setPostsError] = useState(false);
  const [loading, setLoading] = useState(!!publicDb);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    if (!publicDb) return;
    const version = ++request.current;
    const early = takeEarlyRequests();
    let update: () => void;
    try {
      // A dashboard user, here or on the public page, reads with their own
      // rights through supabase-js; visitors read anonymously.
      const db: Reader =
        admin || hasStoredSession()
          ? ((await loadSupabase()) ?? publicDb)
          : publicDb;
      const [results, nextLinks, nextPosts] = await Promise.all([
        Promise.all(
          ["categories", "menu_items", "locations"].map((table) =>
            orEarly(early?.[table], () =>
              db.from(table).select("*").order("sort_order").order("id"),
            ),
          ),
        ),
        // Links and posts live in their own tables. Failing to read them (for
        // example before their migration is applied) must not take the menu
        // down. Sorted here: older link tables have no sort_order column.
        readOptional(db, "site_links", readLinks, early?.site_links),
        readOptional(
          db,
          "social_posts",
          (rows: SocialPost[]) => [...rows].sort(bySortOrder),
          early?.social_posts,
        ),
      ]);
      update = () => {
        if (nextLinks) setLinks((previous) => same(previous, nextLinks));
        setLinksError(!nextLinks);
        if (nextPosts) setPosts((previous) => same(previous, nextPosts));
        setPostsError(!nextPosts);
        const failed = results.some((r) => r.error);
        if (!failed) {
          const next = {
            categories: results[0].data as Category[],
            items: results[1].data as MenuItem[],
            locations: results[2].data as Location[],
          };
          // Polls often return identical content. Preserve references so menu
          // filtering, reveal observers and open previews do not rerender.
          setData((previous) => same(previous, next));
        }
        setError(failed);
        setLoading(false);
      };
    } catch {
      update = () => {
        setError(true);
        setLoading(false);
      };
    }
    if (version !== request.current) return;
    // Background data: as a transition, React renders the filled-in page in
    // short slices instead of one long task that blocks input.
    startTransition(update);
  }, [admin]);
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
    if (!publicDb) return;
    const stopReturn = onWindowReturn(scheduleRefresh);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    // Live changes and sign-in events come through supabase-js. A visitor's
    // page connects on their first interaction instead of during the page
    // load; until then the poll and returning to the tab keep it current.
    let disconnect = () => {};
    const connect = () =>
      void loadSupabase().then((supabase) => {
        if (!active || !supabase) return;
        const channel = supabase.channel("website-content");
        for (const table of ["categories", "menu_items", "locations"])
          channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            scheduleRefresh,
          );
        channel.subscribe();
        const { data: auth } = supabase.auth.onAuthStateChange(
          (event, session) => {
            const user = session?.user.id ?? null;
            // INITIAL_SESSION is already covered by the mount request.
            // SIGNED_IN can fire again just because the same user returns to
            // the tab.
            const sameUser = user === authUser;
            authUser = user;
            if (
              event === "INITIAL_SESSION" ||
              (event === "SIGNED_IN" && sameUser)
            )
              return;
            request.current++;
            if (
              !sameUser ||
              event === "SIGNED_OUT" ||
              event === "USER_UPDATED"
            ) {
              setData(empty);
              setLoading(true);
            }
            scheduleRefresh();
          },
        );
        disconnect = () => {
          void supabase.removeChannel(channel);
          auth.subscription.unsubscribe();
        };
      });
    let stopWaiting = () => {};
    if (admin || hasStoredSession()) connect();
    else stopWaiting = onFirstInput(connect);
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      request.current++;
      stopWaiting();
      disconnect();
      stopReturn();
      clearInterval(timer);
    };
  }, [admin, refresh]);
  const value = useMemo(
    () => ({
      ...data,
      links,
      linksError,
      posts,
      postsError,
      loading,
      error,
      refresh,
    }),
    [data, links, linksError, posts, postsError, loading, error, refresh],
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
      // The admin's session also reads hidden rows; visitors never see them.
      links: (content.links ?? defaultLinks).filter((l) => l.available),
      posts: (content.posts ?? []).filter((p) => p.available),
    };
  }, [content]);
}
