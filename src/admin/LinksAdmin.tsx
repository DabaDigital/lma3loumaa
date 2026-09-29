import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Select } from "../components";
import type { LinkKind, SiteLink } from "../content";
import type { Locale } from "../data";
import { linkName, platformCatalog, platformOf } from "../links";
import { supabase } from "../supabase";
import { copy } from "./copy";
import { move, RowActions, SaveBar, saveRows, useDraft } from "./listTools";

const kinds: LinkKind[] = ["social", "order"];
// The row every "Order on Glovo" button relies on; the database keeps it.
const isGlovo = (link: SiteLink) => link.id === "glovo";

export function LinksAdmin({
  locale,
  links,
  failed,
  onRetry,
  onSaved,
}: {
  locale: Locale;
  links: SiteLink[];
  failed: boolean;
  onRetry: () => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const t = (key: keyof typeof copy) => copy[key][locale];
  // Glovo leads the ordering links whatever its stored position, so moving
  // the others never passes it.
  const source = useMemo(
    () => [...links].sort((a, b) => Number(isGlovo(b)) - Number(isGlovo(a))),
    [links],
  );
  const { rows, dirty, edit, reset, saved } = useDraft(source);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const update = (id: string, patch: Partial<SiteLink>) =>
    edit(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const platformsFor = (kind: LinkKind) =>
    Object.keys(platformCatalog).filter(
      (key) => platformCatalog[key].kinds.includes(kind) && key !== "glovo",
    );
  const add = (kind: LinkKind) => {
    const used = new Set(rows.map((row) => row.platform));
    const platform =
      platformsFor(kind).find((key) => key !== "other" && !used.has(key)) ??
      "other";
    edit([
      ...rows,
      {
        id: crypto.randomUUID(),
        kind,
        platform,
        label: "",
        url: "",
        available: true,
        sort_order: 0,
        isNew: true,
      },
    ]);
  };
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !supabase || !dirty) return;
    setBusy(true);
    setError(false);
    try {
      // Each list is numbered from 0 in the order shown.
      const ordered = kinds.flatMap((kind) =>
        rows
          .filter((row) => row.kind === kind)
          .map((row, index) => ({
            ...row,
            url: row.url.trim(),
            label: row.platform === "other" ? row.label.trim() : "",
            sort_order: index,
          })),
      );
      await saveRows("site_links", links, ordered, [
        "kind",
        "platform",
        "label",
        "url",
        "available",
        "sort_order",
      ]);
      await onSaved();
      saved();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
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
          {kinds.map((kind) => {
            const list = rows.filter((row) => row.kind === kind);
            return (
              <section
                className="admin-list-group"
                key={kind}
                aria-labelledby={`links-${kind}`}
              >
                <div className="admin-list-heading">
                  <h2 id={`links-${kind}`}>
                    {t(kind === "social" ? "socialLinks" : "orderLinks")}
                  </h2>
                  <p>
                    {t(kind === "social" ? "socialLinksHelp" : "orderLinksHelp")}
                  </p>
                </div>
                {list.length ? (
                  <ol className="admin-list">
                    {list.map((row, index) => {
                      const info = platformOf(row.platform);
                      const locked = isGlovo(row);
                      const name = linkName(row) || `#${index + 1}`;
                      const above = list[index - 1];
                      return (
                        <li
                          key={row.id}
                          className={`admin-list-row ${row.available ? "" : "is-hidden"}`}
                        >
                          <span
                            className="admin-brand-badge"
                            style={{ background: info.color, color: info.ink }}
                          >
                            <info.Icon size={20} />
                          </span>
                          <div className="admin-list-fields">
                            <div className="admin-list-line">
                              {locked ? (
                                <span className="admin-list-fixed">
                                  {info.name}
                                  <span className="admin-badge">
                                    {t("mainLink")}
                                  </span>
                                </span>
                              ) : (
                                <Select
                                  className="admin-platform-select"
                                  label={`${t("platform")} · ${name}`}
                                  value={row.platform}
                                  onChange={(platform) =>
                                    update(row.id, {
                                      platform,
                                      label:
                                        platform === "other" ? row.label : "",
                                    })
                                  }
                                  options={platformsFor(kind).map((key) => ({
                                    value: key,
                                    label:
                                      key === "other"
                                        ? t("otherPlatform")
                                        : platformCatalog[key].name,
                                  }))}
                                />
                              )}
                              {row.platform === "other" && (
                                <input
                                  className="admin-list-input"
                                  aria-label={`${t("linkLabel")} · ${index + 1}`}
                                  placeholder={t("linkLabel")}
                                  required
                                  maxLength={40}
                                  value={row.label}
                                  onChange={(e) =>
                                    update(row.id, { label: e.target.value })
                                  }
                                />
                              )}
                              {!row.available && (
                                <span className="admin-badge is-hidden">
                                  {t("hidden")}
                                </span>
                              )}
                            </div>
                            <input
                              className="admin-list-input"
                              type="url"
                              dir="ltr"
                              aria-label={`${t("linkUrl")} · ${name}`}
                              required
                              pattern="https://\S+"
                              maxLength={500}
                              placeholder={info.placeholder}
                              autoFocus={row.isNew}
                              value={row.url}
                              onChange={(e) =>
                                update(row.id, { url: e.target.value })
                              }
                            />
                            {locked && <small>{t("glovoLinkHelp")}</small>}
                          </div>
                          <RowActions
                            t={t}
                            name={name}
                            available={row.available}
                            url={row.url}
                            locked={locked}
                            canMoveUp={!!above && !isGlovo(above)}
                            canMoveDown={index < list.length - 1}
                            onToggle={() =>
                              update(row.id, { available: !row.available })
                            }
                            onMove={(step) =>
                              edit(
                                move(
                                  rows,
                                  row.id,
                                  step,
                                  (other) => other.kind === kind,
                                ),
                              )
                            }
                            onRemove={() =>
                              edit(rows.filter((other) => other.id !== row.id))
                            }
                          />
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="admin-list-empty">{t("noLinks")}</p>
                )}
                <button
                  type="button"
                  className="admin-add-row"
                  onClick={() => add(kind)}
                >
                  <Plus size={17} />
                  {t(kind === "social" ? "addSocial" : "addOrder")}
                </button>
              </section>
            );
          })}
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
