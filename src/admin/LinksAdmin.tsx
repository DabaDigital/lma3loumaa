import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, RefreshCw, Save } from "lucide-react";
import { Button } from "../components";
import { linkIds } from "../content";
import type { LinkId, Links } from "../content";
import type { Locale } from "../data";
import { platforms } from "../links";
import { supabase } from "../supabase";
import { copy } from "./copy";

const toValues = (links: Links) =>
  Object.fromEntries(linkIds.map((id) => [id, links[id] ?? ""])) as Record<
    LinkId,
    string
  >;

export function LinksAdmin({
  locale,
  links,
  failed,
  onRetry,
  onSaved,
}: {
  locale: Locale;
  links: Links;
  failed: boolean;
  onRetry: () => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const t = (key: keyof typeof copy) => copy[key][locale];
  const [values, setValues] = useState(() => toValues(links));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Follow refreshed links (a retry, another admin's edit) until the form is
  // touched, so a background poll never overwrites what is being typed.
  useEffect(() => {
    if (!dirty) setValues(toValues(links));
  }, [links]);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !supabase) return;
    const changed = linkIds.filter(
      (id) => values[id].trim() !== (links[id] ?? ""),
    );
    setBusy(true);
    setError(false);
    try {
      const results = await Promise.all(
        changed.map((id) =>
          supabase!
            .from("site_links")
            .update({ url: values[id].trim() })
            .eq("id", id)
            .select("id")
            .single(),
        ),
      );
      // An update refused by row-level security returns no row, not an error.
      if (results.some((r) => r.error || !r.data)) throw new Error();
      setDirty(false);
      await onSaved();
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
      <form className="admin-panel admin-links" onSubmit={save}>
        <fieldset className="admin-form-body" disabled={busy}>
          {(["social", "order"] as const).map((kind) => (
            <fieldset className="admin-links-group" key={kind}>
              <legend>
                {t(kind === "social" ? "socialLinks" : "orderLinks")}
              </legend>
              {linkIds
                .filter((id) => platforms[id].kind === kind)
                .map((id) => {
                  const { name, placeholder, Icon } = platforms[id];
                  const url = values[id].trim();
                  return (
                    <div className="admin-link" key={id}>
                      <span className="admin-link-icon">
                        <Icon size={20} />
                      </span>
                      <label className="admin-field">
                        {name}
                        <input
                          type="url"
                          name={id}
                          aria-label={name}
                          aria-describedby={`link-${id}-help`}
                          dir="ltr"
                          pattern="https://\S+"
                          maxLength={500}
                          required={id === "glovo"}
                          placeholder={placeholder}
                          value={values[id]}
                          onChange={(e) => {
                            setValues({ ...values, [id]: e.target.value });
                            setDirty(true);
                          }}
                        />
                        <small id={`link-${id}-help`}>
                          {t(id === "glovo" ? "glovoLinkHelp" : "linkHelp")}
                        </small>
                      </label>
                      {/^https:\/\/\S+$/.test(url) && (
                        <a
                          className="admin-icon-button"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${t("openLink")} · ${name}`}
                          title={t("openLink")}
                        >
                          <ArrowUpRight size={16} />
                        </a>
                      )}
                    </div>
                  );
                })}
            </fieldset>
          ))}
        </fieldset>
        {error && (
          <p className="admin-error admin-links-error" role="alert">
            {t("error")}
          </p>
        )}
        <div className="admin-form-actions">
          <Button type="submit" disabled={busy}>
            <Save size={17} />
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </>
  );
}
