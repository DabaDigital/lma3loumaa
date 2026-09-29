import { useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Plus, RefreshCw, Upload } from "lucide-react";
import type { SocialPost } from "../content";
import type { Locale } from "../data";
import { parsePost, platformOf } from "../links";
import type { ParsedPost } from "../links";
import { supabase } from "../supabase";
import { copy } from "./copy";
import { move, RowActions, SaveBar, saveRows, useDraft } from "./listTools";

// Mirrors supabase/social-storage.sql and the migration's row limit; both are
// enforced server-side too.
export const MAX_POSTS = 4;
const BUCKET = "social-media";
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
type Media = "video" | "poster";
type Translate = (key: keyof typeof copy) => string;
const media = (field: Media, value: string): Partial<SocialPost> =>
  field === "video" ? { video: value } : { poster: value };

/** How the website will show a post, in the admin's words. */
function playback(post: SocialPost, parsed: ParsedPost | null) {
  if (post.video || parsed?.tiktokId) return "playsMuted";
  if (parsed?.embed) return "playsEmbed";
  return "playsLink";
}

// A link the site cannot show is refused by the browser's own form check,
// with the reason, before anything is sent.
function PostUrlInput({
  t,
  number,
  value,
  onChange,
}: {
  t: Translate;
  number: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    input.current?.setCustomValidity(
      !value.trim() || parsePost(value) ? "" : t("postUrlInvalid"),
    );
  }, [value, t]);
  return (
    <input
      ref={input}
      className="admin-list-input"
      type="url"
      dir="ltr"
      aria-label={`${t("postUrl")} ${number}`}
      required
      maxLength={500}
      placeholder="https://www.instagram.com/reel/…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Preview({ post, parsed }: { post: SocialPost; parsed: ParsedPost | null }) {
  const info = platformOf(parsed?.platform ?? "other");
  if (post.video)
    return (
      <video
        src={post.video}
        poster={post.poster ?? undefined}
        muted
        playsInline
        preload="metadata"
      />
    );
  if (post.poster) return <img src={post.poster} alt="" />;
  return (
    <span
      className="admin-post-placeholder"
      style={{ background: info.color, color: info.ink }}
    >
      <info.Icon size={26} />
    </span>
  );
}

export function PostsAdmin({
  locale,
  posts,
  failed,
  onRetry,
  onSaved,
}: {
  locale: Locale;
  posts: SocialPost[];
  failed: boolean;
  onRetry: () => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const t = (key: keyof typeof copy) => copy[key][locale];
  const { rows, dirty, edit, reset, saved } = useDraft(posts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  // Media options open by themselves only where a file is already attached.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(posts.filter((p) => p.video || p.poster).map((p) => p.id)),
  );
  const update = (id: string, patch: Partial<SocialPost>) =>
    edit(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const full = rows.length >= MAX_POSTS;
  const add = () => {
    if (full) return;
    edit([
      ...rows,
      {
        id: crypto.randomUUID(),
        url: "",
        video: null,
        poster: null,
        caption: "",
        available: true,
        sort_order: 0,
        isNew: true,
      },
    ]);
  };
  const upload = async (
    id: string,
    field: Media,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Let the same file be picked again after a failure.
    const slot = `${id}:${field}`;
    if (!file || !supabase || uploading) return;
    const types = field === "video" ? VIDEO_TYPES : IMAGE_TYPES;
    const limit = field === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const refuse = (message: string) =>
      setUploadErrors((errors) => ({ ...errors, [slot]: message }));
    if (!types.includes(file.type))
      return refuse(t(field === "video" ? "videoType" : "imageType"));
    if (file.size > limit)
      return refuse(t(field === "video" ? "videoSize" : "imageSize"));
    setUploading(slot);
    setUploadErrors((errors) => {
      const next = { ...errors };
      delete next[slot];
      return next;
    });
    try {
      const extension = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `posts/${crypto.randomUUID()}.${extension}`;
      const { error: failure } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (failure) throw failure;
      const { publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path).data;
      if (!publicUrl.startsWith("https://")) throw new Error(publicUrl);
      update(id, media(field, publicUrl));
    } catch (failure) {
      refuse(
        `${t("uploadError")} ${failure instanceof Error ? failure.message : ""}`.trim(),
      );
    } finally {
      setUploading(null);
    }
  };
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !supabase || !dirty) return;
    setBusy(true);
    setError(false);
    try {
      const clean = (value: string | null) => value?.trim() || null;
      await saveRows(
        "social_posts",
        posts,
        rows.map((row, index) => ({
          ...row,
          url: row.url.trim(),
          caption: row.caption.trim(),
          video: clean(row.video),
          poster: clean(row.poster),
          sort_order: index,
        })),
        ["url", "video", "poster", "caption", "available", "sort_order"],
      );
      await onSaved();
      saved();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const mediaField = (row: SocialPost, field: Media, number: number) => {
    const slot = `${row.id}:${field}`;
    const label = t(field === "video" ? "postVideo" : "postPoster");
    return (
      <div className="admin-field admin-media-field">
        <span>{label}</span>
        <div className="admin-media-input">
          <input
            className="admin-list-input"
            dir="ltr"
            aria-label={`${label} ${number}`}
            pattern="(https://|/assets/)\S+"
            maxLength={500}
            placeholder="https://…"
            value={row[field] ?? ""}
            onChange={(e) => update(row.id, media(field, e.target.value))}
          />
          <label
            className={`admin-upload-button ${uploading === slot ? "is-busy" : ""}`}
          >
            <Upload size={16} />
            {uploading === slot
              ? t("uploading")
              : t(field === "video" ? "uploadVideo" : "upload")}
            <input
              type="file"
              aria-label={`${t(field === "video" ? "uploadVideo" : "upload")} ${number}`}
              accept={(field === "video" ? VIDEO_TYPES : IMAGE_TYPES).join(",")}
              disabled={!!uploading}
              onChange={(e) => void upload(row.id, field, e)}
            />
          </label>
        </div>
        <small>{t(field === "video" ? "videoHelp" : "uploadHelp")}</small>
        {uploadErrors[slot] && (
          <p className="admin-upload-error" role="alert">
            {uploadErrors[slot]}
          </p>
        )}
      </div>
    );
  };
  return (
    <>
      {failed && (
        <div className="admin-error" role="alert">
          {t("loadError")}{" "}
          <button onClick={() => void onRetry()}>
            <RefreshCw size={15} />
            {t("retry")}
          </button>
        </div>
      )}
      <form className="admin-panel admin-list-panel" onSubmit={save}>
        <fieldset className="admin-list-body" disabled={busy}>
          <section className="admin-list-group" aria-labelledby="posts-title">
            <div className="admin-list-heading">
              <h2 id="posts-title">
                {t("posts")}
                <span className="admin-count">
                  {rows.length} / {MAX_POSTS}
                </span>
              </h2>
              <p>{t("postsHelp")}</p>
            </div>
            {rows.length ? (
              <ol className="admin-list admin-post-list">
                {rows.map((row, index) => {
                  const parsed = parsePost(row.url);
                  const info = platformOf(parsed?.platform ?? "other");
                  const number = index + 1;
                  const kind = !parsed
                    ? ""
                    : `${t(parsed.video ? (parsed.platform === "instagram" ? "reel" : "video") : "post")} ${info.name}`;
                  return (
                    <li
                      key={row.id}
                      className={`admin-list-row admin-post ${row.available ? "" : "is-hidden"}`}
                    >
                      <div className="admin-post-preview">
                        <Preview post={row} parsed={parsed} />
                        <span className="admin-post-number">{number}</span>
                      </div>
                      <div className="admin-list-fields">
                        <div className="admin-field">
                          <span>{t("postUrl")}</span>
                          <PostUrlInput
                            t={t}
                            number={number}
                            value={row.url}
                            onChange={(url) => update(row.id, { url })}
                          />
                          {parsed ? (
                            <small className="admin-post-kind">
                              <strong>{kind}</strong> ·{" "}
                              {t(playback(row, parsed))}
                            </small>
                          ) : (
                            row.url.trim() && (
                              <small className="admin-post-invalid">
                                {t("postUrlInvalid")}
                              </small>
                            )
                          )}
                        </div>
                        <label className="admin-field">
                          <span>{t("postCaption")}</span>
                          <textarea
                            className="admin-list-input"
                            aria-label={`${t("postCaption")} ${number}`}
                            dir="auto"
                            rows={2}
                            maxLength={300}
                            value={row.caption}
                            onChange={(e) =>
                              update(row.id, { caption: e.target.value })
                            }
                          />
                        </label>
                        <details
                          className="admin-post-media"
                          open={expanded.has(row.id) || undefined}
                          onToggle={(e) => {
                            const open = e.currentTarget.open;
                            setExpanded((current) => {
                              const next = new Set(current);
                              if (open) next.add(row.id);
                              else next.delete(row.id);
                              return next;
                            });
                          }}
                        >
                          <summary>{t("postMedia")}</summary>
                          <p>{t("postMediaHelp")}</p>
                          {mediaField(row, "video", number)}
                          {mediaField(row, "poster", number)}
                        </details>
                      </div>
                      <RowActions
                        t={t}
                        name={`${kind || t("post")} ${number}`}
                        available={row.available}
                        url={row.url}
                        canMoveUp={index > 0}
                        canMoveDown={index < rows.length - 1}
                        onToggle={() =>
                          update(row.id, { available: !row.available })
                        }
                        onMove={(step) => edit(move(rows, row.id, step))}
                        onRemove={() =>
                          edit(rows.filter((other) => other.id !== row.id))
                        }
                      />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="admin-list-empty">{t("postsEmpty")}</p>
            )}
            <button
              type="button"
              className="admin-add-row"
              disabled={full}
              onClick={add}
            >
              <Plus size={17} />
              {t("addPost")}
            </button>
            {full && <p className="admin-list-note">{t("postsLimit")}</p>}
          </section>
        </fieldset>
        {error && (
          <p className="admin-error admin-list-error" role="alert">
            {t("error")}
          </p>
        )}
        <SaveBar t={t} dirty={dirty} busy={busy} onReset={reset} />
      </form>
    </>
  );
}
