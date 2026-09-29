import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "../components";
import { supabase } from "../supabase";
import type { copy } from "./copy";

// Shared by the links and posts lists: an ordered set of rows, edited as a
// draft and saved in one go.
type Translate = (key: keyof typeof copy) => string;
export type ListRow = { id: string; available: boolean; sort_order: number };
export type Draft<R> = R & { isNew?: boolean };

/** An editable copy of a list that follows fresh data until it is edited. */
export function useDraft<R extends ListRow>(source: R[]) {
  const [rows, setRows] = useState<Draft<R>[]>(source);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setRows(source);
  }, [source, dirty]);
  return {
    rows,
    dirty,
    edit: (next: Draft<R>[]) => {
      setRows(next);
      setDirty(true);
    },
    reset: () => {
      setRows(source);
      setDirty(false);
    },
    /** Call once the saved rows have been reloaded. */
    saved: () => setDirty(false),
  };
}

/** Moves a row past its nearest neighbour for which `sameList` holds. */
export function move<R extends { id: string }>(
  rows: R[],
  id: string,
  step: -1 | 1,
  sameList: (row: R) => boolean = () => true,
) {
  const from = rows.findIndex((row) => row.id === id);
  let to = from + step;
  while (rows[to] && !sameList(rows[to])) to += step;
  if (from < 0 || !rows[to]) return rows;
  const next = [...rows];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/**
 * Writes the difference between `original` and `rows`: deletions first (which
 * frees room under a row limit), then edits, then additions. Each request must
 * report its row, since row-level security refuses silently.
 */
export async function saveRows<R extends ListRow>(
  table: string,
  original: R[],
  rows: Draft<R>[],
  fields: (keyof R)[],
) {
  const before = new Map(original.map((row) => [row.id, row]));
  const kept = new Set(rows.map((row) => row.id));
  const pick = (row: R) =>
    Object.fromEntries(fields.map((field) => [field, row[field]]));
  const changed = (row: R) =>
    fields.some(
      (field) =>
        JSON.stringify(row[field]) !== JSON.stringify(before.get(row.id)?.[field]),
    );
  const run = async (
    requests: PromiseLike<{ data: unknown; error: unknown }>[],
  ) => {
    const results = await Promise.all(requests);
    if (results.some((result) => result.error || !result.data))
      throw new Error("save failed");
  };
  await run(
    original
      .filter((row) => !kept.has(row.id))
      .map((row) =>
        supabase!.from(table).delete().eq("id", row.id).select("id").single(),
      ),
  );
  await run(
    rows
      .filter((row) => !row.isNew && changed(row))
      .map((row) =>
        supabase!
          .from(table)
          .update(pick(row))
          .eq("id", row.id)
          .select("id")
          .single(),
      ),
  );
  await run(
    rows
      .filter((row) => row.isNew)
      .map((row) =>
        supabase!
          .from(table)
          .insert({ id: row.id, ...pick(row) })
          .select("id")
          .single(),
      ),
  );
}

export function RowActions({
  t,
  name,
  available,
  url,
  canMoveUp,
  canMoveDown,
  locked = false,
  onToggle,
  onMove,
  onRemove,
}: {
  t: Translate;
  name: string;
  available: boolean;
  url: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** A permanent row: no hiding, moving or deleting. */
  locked?: boolean;
  onToggle: () => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}) {
  const href = url.trim();
  return (
    <div className="admin-list-actions">
      {!locked && (
        <>
          <button
            type="button"
            className="admin-icon-button"
            aria-label={`${t(available ? "hideFromSite" : "showOnSite")} · ${name}`}
            title={t(available ? "hideFromSite" : "showOnSite")}
            onClick={onToggle}
          >
            {available ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            type="button"
            className="admin-icon-button"
            aria-label={`${t("moveUp")} · ${name}`}
            title={t("moveUp")}
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            className="admin-icon-button"
            aria-label={`${t("moveDown")} · ${name}`}
            title={t("moveDown")}
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={16} />
          </button>
        </>
      )}
      {/^https:\/\/\S+$/.test(href) && (
        <a
          className="admin-icon-button"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t("openLink")} · ${name}`}
          title={t("openLink")}
        >
          <ArrowUpRight size={16} />
        </a>
      )}
      {!locked && (
        <button
          type="button"
          className="admin-icon-button danger"
          aria-label={`${t("delete")} · ${name}`}
          title={t("delete")}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

export function SaveBar({
  t,
  dirty,
  busy,
  onReset,
}: {
  t: Translate;
  dirty: boolean;
  busy: boolean;
  onReset: () => void;
}) {
  return (
    <div className="admin-form-actions admin-save-bar">
      {dirty && <span className="admin-unsaved">{t("unsaved")}</span>}
      {dirty && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onReset}
        >
          <RotateCcw size={16} />
          {t("discard")}
        </Button>
      )}
      <Button type="submit" disabled={busy || !dirty}>
        <Save size={17} />
        {busy ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
