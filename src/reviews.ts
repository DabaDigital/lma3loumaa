import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { loadSupabase, publicDb } from "./database";
import { onWindowReturn } from "./windowReturn";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type Review = {
  id: string;
  title: string;
  description: string;
  rating: number;
  image_path: string | null;
  status: ReviewStatus;
  created_at: string;
};
export const REVIEW_BUCKET = "review-images";
export const REVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const REVIEW_MAX_BYTES = 5 * 1024 * 1024;

export function useReviewList(admin = false) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(!!publicDb);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!publicDb) return;
    const request = ++version.current;
    try {
      // The dashboard's list: unapproved reviews need the moderator's rights.
      const supabase = (await loadSupabase())!;
      const rows: Review[] = [];
      const pageSize = 200;
      for (let offset = 0; ; offset += pageSize) {
        let query = supabase
          .from("reviews")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id");
        if (!admin) query = query.eq("status", "approved");
        const result = await query.range(offset, offset + pageSize - 1);
        if (request !== version.current) return;
        if (result.error) throw result.error;
        rows.push(...((result.data ?? []) as Review[]));
        if ((result.data?.length ?? 0) < pageSize) break;
      }
      const next = admin
        ? rows
        : rows.filter((row) => row.status === "approved");
      setReviews((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
      setError(false);
    } catch {
      if (request === version.current) {
        setReviews([]);
        setError(true);
      }
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [admin]);
  useEffect(() => {
    let active = true;
    let authUser: string | null | undefined;
    let authTimer: number | undefined;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    let unsubscribe = () => {};
    void loadSupabase().then((supabase) => {
      if (!active || !supabase) return;
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user.id ?? null;
        const sameUser = user === authUser;
        authUser = user;
        if (event === "INITIAL_SESSION" || (event === "SIGNED_IN" && sameUser))
          return;
        version.current++;
        if (!sameUser || event === "SIGNED_OUT" || event === "USER_UPDATED") {
          setReviews([]);
          setLoading(true);
        }
        window.clearTimeout(authTimer);
        authTimer = window.setTimeout(() => {
          if (active) void refresh();
        }, 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      active = false;
      window.clearTimeout(authTimer);
      version.current++;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [refresh]);
  return { reviews, loading, error, refresh };
}

export type ReviewSort = "all" | "recent" | "top";
export const REVIEW_PAGE_SIZE = 6;
export type ReviewStats = {
  total: number;
  average: number | null;
  /** counts[n - 1] is the number of approved n-star reviews. */
  counts: number[];
};

const PUBLIC_COLUMNS =
  "id,title,description,rating,image_path,status,created_at";
// Until the pagination migration adds detail_rank, "all" falls back to newest.
let detailRankMissing = false;

async function fetchReviewStats(): Promise<ReviewStats> {
  const counts = await Promise.all(
    [1, 2, 3, 4, 5].map(async (rating) => {
      const { count, error } = await publicDb!
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .eq("rating", rating);
      if (error) throw error;
      return count ?? 0;
    }),
  );
  const total = counts.reduce((sum, count) => sum + count, 0);
  const stars = counts.reduce(
    (sum, count, index) => sum + count * (index + 1),
    0,
  );
  return { total, average: total ? stars / total : null, counts };
}

async function fetchReviewPage(sort: ReviewSort, page: number) {
  const from = (page - 1) * REVIEW_PAGE_SIZE;
  const query = (byDetail: boolean) => {
    let request = publicDb!
      .from("reviews")
      .select(PUBLIC_COLUMNS)
      .eq("status", "approved");
    if (sort === "top") request = request.order("rating", { ascending: false });
    if (byDetail) request = request.order("detail_rank", { ascending: false });
    return request
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + REVIEW_PAGE_SIZE - 1);
  };
  const byDetail = sort === "all" && !detailRankMissing;
  let result = await query(byDetail);
  if (byDetail && result.error?.code === "42703") {
    detailRankMissing = true;
    result = await query(false);
  }
  if (result.error) throw result.error;
  // Fail closed even if the API ever returns unapproved rows.
  return ((result.data ?? []) as Review[]).filter(
    (row) => row.status === "approved",
  );
}

/** One server-sorted page of approved reviews, plus rating totals, read once
 * `enabled` (until then it stays loading). */
export function usePublicReviews(
  sort: ReviewSort,
  page: number,
  enabled: boolean,
) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [list, setList] = useState<{ key: string; reviews: Review[] } | null>(
    null,
  );
  const [statsError, setStatsError] = useState(false);
  const [pageError, setPageError] = useState(false);
  const key = `${sort}:${page}`;
  const statsRequest = useRef(0);
  const pageRequest = useRef(0);
  const loadStats = useCallback(async () => {
    if (!publicDb) return;
    const request = ++statsRequest.current;
    try {
      const next = await fetchReviewStats();
      if (request !== statsRequest.current) return;
      // Background data renders in short slices (see content.tsx).
      startTransition(() => {
        setStats((previous) =>
          JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
        );
        setStatsError(false);
      });
    } catch {
      if (request === statsRequest.current) setStatsError(true);
    }
  }, []);
  const loadPage = useCallback(async () => {
    if (!publicDb) return;
    const request = ++pageRequest.current;
    setPageError(false);
    try {
      const reviews = await fetchReviewPage(sort, page);
      if (request !== pageRequest.current) return;
      startTransition(() =>
        setList((previous) =>
          previous?.key === key &&
          JSON.stringify(previous.reviews) === JSON.stringify(reviews)
            ? previous
            : { key, reviews },
        ),
      );
    } catch {
      if (request === pageRequest.current) setPageError(true);
    }
  }, [sort, page, key]);
  const refresh = useCallback(
    () => Promise.all([loadStats(), loadPage()]),
    [loadStats, loadPage],
  );
  useEffect(() => {
    if (enabled) void loadStats();
  }, [enabled, loadStats]);
  useEffect(() => {
    if (enabled) void loadPage();
  }, [enabled, loadPage]);
  // Moderation changes appear when the visitor returns or after a minute.
  useEffect(() => {
    if (!enabled) return;
    const stopReturn = onWindowReturn(() => void refresh());
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    return () => {
      stopReturn();
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);
  // A failed background refresh keeps the reviews already on screen.
  const error =
    (statsError && !stats) || (pageError && (!list || list.key !== key));
  return {
    stats,
    reviews: list?.reviews ?? [],
    /** A different page or order is on its way; the previous one stays shown. */
    pending: !!list && list.key !== key && !error,
    loading: !!publicDb && (!stats || !list) && !error,
    error,
    refresh,
  };
}

export async function setReviewStatus(
  id: string,
  status: "approved" | "rejected",
) {
  const supabase = await loadSupabase();
  if (!supabase) throw new Error("Reviews are not configured");
  const { data, error } = await supabase
    .from("reviews")
    .update({ status })
    .eq("id", id)
    .select("id,status")
    .single();
  if (error || !data || data.status !== status)
    throw error ?? new Error("Review was not updated");
}

export type ReviewPreparation = {
  id: string;
  completed: boolean;
  uploaded?: boolean;
  upload?: { path: string; token: string };
};

export async function reviewRequest(
  body: Record<string, unknown>,
): Promise<ReviewPreparation> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "UNAVAILABLE");
  if (typeof data.id !== "string" || typeof data.completed !== "boolean")
    throw new Error("UNAVAILABLE");
  return data;
}
