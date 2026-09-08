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
      setReviews(
        admin ? rows : rows.filter((row) => row.status === "approved"),
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
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    const auth = supabase?.auth.onAuthStateChange(() => {
      version.current++;
      setReviews([]);
      setLoading(true);
      window.setTimeout(() => {
        if (active) void refresh();
      }, 0);
    });
    return () => {
      active = false;
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

export async function submitReview(
  review: Pick<
    Review,
    "id" | "title" | "description" | "rating" | "image_path"
  >,
) {
  if (!supabase) throw new Error("Reviews are not configured");
  // No SELECT here: pending reviews cannot be read by visitors.
  const { error } = await supabase.from("reviews").insert(review);
  if (error) throw error;
}
