import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

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
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const request = ++version.current;
    try {
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
    const auth = supabase?.auth.onAuthStateChange((event, session) => {
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
    return () => {
      active = false;
      window.clearTimeout(authTimer);
      version.current++;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
      auth?.data.subscription.unsubscribe();
    };
  }, [refresh]);
  return { reviews, loading, error, refresh };
}

export async function setReviewStatus(
  id: string,
  status: "approved" | "rejected",
) {
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
