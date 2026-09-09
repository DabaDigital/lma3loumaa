import { LoadingImage } from "../LoadingImage";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  LayoutDashboard,
  Utensils,
  Layers,
  MapPin,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Search,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Eye,
  EyeOff,
  MessageSquare,
} from "lucide-react";
import { Button, Dropdown, FoodVisual, Modal, Select } from "../components";
import { supabase } from "../supabase";
import { useContent } from "../content";
import type { Category, MenuItem, Location, Managed } from "../content";
import type { Locale } from "../data";
import { copy } from "./copy";
import { Editor } from "./Editor";
import { ReviewsAdmin } from "./ReviewsAdmin";
import "./admin.css";
import { ContentSkeleton } from "../Skeleton";

export type ContentSection = "items" | "categories" | "locations";
export type Section = "overview" | ContentSection | "reviews";
function isContentSection(section: Section): section is ContentSection {
  return (
    section === "items" || section === "categories" || section === "locations"
  );
}
export type Entry = Category | MenuItem | Location;
export const tables = {
  items: "menu_items",
  categories: "categories",
  locations: "locations",
};
export default function Admin() {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || "fr") as Locale;
  const t = (key: keyof typeof copy) => copy[key][locale];
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(!!supabase);
  const [allowed, setAllowed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>(() => {
    const path = window.location.pathname.split("/")[2];
    return ["items", "categories", "locations", "reviews"].includes(path)
      ? (path as Section)
      : "overview";
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("");
  const [editing, setEditing] = useState<Entry | "new" | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [notice, setNotice] = useState<"saved" | "deleted" | "">("");
  const [failure, setFailure] = useState("");
  const content = useContent();
  const authVersion = useRef(0);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.title = `${t("dashboard")} — Lma3louma`;
    try {
      localStorage.setItem("lma-language", locale);
    } catch {
      /* optional preference */
    }
  }, [locale]);
  useEffect(() => {
    if (!supabase) return;
    const check = async (next: User | null, reset: boolean) => {
      const version = ++authVersion.current;
      setUser(next);
      if (reset) {
        setAllowed(false);
        setChecking(true);
      }
      try {
        if (next) {
          const { data, error } = await supabase!
            .from("admin_users")
            .select("user_id")
            .eq("user_id", next.id)
            .maybeSingle();
          if (version !== authVersion.current) return;
          setAllowed(!error && !!data);
        }
      } catch {
        if (version === authVersion.current) setAllowed(false);
      } finally {
        if (version === authVersion.current) setChecking(false);
      }
    };
    let active = true;
    let currentUser: string | null | undefined;
    let checkTimer: number | undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user ?? null;
      const reset =
        currentUser === undefined ||
        currentUser !== (next?.id ?? null) ||
        event === "SIGNED_OUT";
      currentUser = next?.id ?? null;
      authVersion.current++;
      if (reset) {
        setAllowed(false);
        setChecking(true);
      }
      // Revalidate membership on every auth event, but keep the same user's
      // editor mounted while that background check is pending.
      window.clearTimeout(checkTimer);
      checkTimer = window.setTimeout(() => {
        if (active) void check(next, reset);
      }, 0);
    });
    return () => {
      active = false;
      window.clearTimeout(checkTimer);
      authVersion.current++;
      data.subscription.unsubscribe();
    };
  }, []);
  const navigate = (next: Section) => {
    setSection(next);
    setQuery("");
    setCategory("");
    setVisibility("");
    setNotice("");
    setFailure("");
    setEditing(null);
    setDeleting(null);
    history.pushState({}, "", `/admin${next === "overview" ? "" : `/${next}`}`);
  };
  useEffect(() => {
    const pop = () => {
      const path = location.pathname.split("/")[2];
      setSection(
        ["items", "categories", "locations", "reviews"].includes(path)
          ? (path as Section)
          : "overview",
      );
      setEditing(null);
      setDeleting(null);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const signIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (error) setAuthError(t("loginError"));
    } catch {
      setAuthError(t("loginError"));
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    setBusy(true);
    setAuthError("");
    setFailure("");
    try {
      const result = await supabase!.auth.signOut();
      if (result.error) throw result.error;
      setAllowed(false);
      setUser(null);
      setEditing(null);
      setDeleting(null);
    } catch {
      setFailure(t("error"));
      setAuthError(t("error"));
    } finally {
      setBusy(false);
    }
  };
  const brand = (
    <a href="/" className="admin-brand">
      <span className="brand-mark">
        <LoadingImage
          src="/assets/lma3louma-logo.png"
          alt="Shawarma Lma3louma"
        />
      </span>
      <small>
        SHAWARMA <b>LMA3LOUMA</b>
      </small>
    </a>
  );
  const language = (
    <Dropdown
      value={locale}
      onChange={(lng) => void i18n.changeLanguage(lng)}
    />
  );
  if (!supabase || !allowed || checking)
    return (
      <div className="admin-login">
        <aside className="login-story">
          {brand}
          <div>
            <span className="eyebrow">L’ESPRIT CASA, LE GOÛT LMA3LOUMA</span>
            <h1 lang="ar" dir="rtl">
              <em>مكتنساش!</em>
            </h1>
            <p>{t("intro")}</p>
          </div>
          <span className="login-flower" aria-hidden="true">
            ✳
          </span>
          <small>CASABLANCA · DEPUIS TOUJOURS, AVEC GOÛT</small>
        </aside>
        <main className="login-main">
          <div className="login-top">
            <a href="/">
              {t("website")} <ArrowUpRight size={15} />
            </a>
            {language}
          </div>
          <div className="login-card">
            <span className="admin-icon">
              <ShieldCheck size={25} />
            </span>
            <p className="eyebrow">LMA3LOUMA · ADMIN</p>
            <h2>{!supabase ? t("setup") : t("login")}</h2>
            <p>{!supabase ? t("setupSub") : t("loginSub")}</p>
            {!supabase ? null : checking ? (
              <ContentSkeleton kind="login" />
            ) : user ? (
              <>
                <p role="alert">{t("denied")}</p>
                <Button disabled={busy} onClick={() => void signOut()}>
                  {t("logout")}
                </Button>
              </>
            ) : (
              <form onSubmit={signIn}>
                <label className="admin-field">
                  {t("email")}
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="vous@lma3louma.ma"
                  />
                </label>
                <label className="admin-field">
                  {t("password")}
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                {authError && (
                  <p className="admin-error" role="alert">
                    {authError}
                  </p>
                )}
                <Button className="full-width" disabled={busy}>
                  {busy ? t("loading") : t("signin")}
                  <ArrowRight size={18} />
                </Button>
              </form>
            )}
            <small className="login-private">
              <ShieldCheck size={14} />
              {t("private")}
            </small>
          </div>
          <small className="login-copyright">
            © {new Date().getFullYear()} Shawarma Lma3louma
          </small>
        </main>
      </div>
    );

  const contentLinks = [
    { id: "items", label: "menu", icon: Utensils },
    { id: "categories", label: "categories", icon: Layers },
    { id: "locations", label: "locations", icon: MapPin },
  ] as const;
  const links = [
    { id: "overview", label: "overview", icon: LayoutDashboard },
    ...contentLinks,
    { id: "reviews", label: "reviews", icon: MessageSquare },
  ] as const;
  const rows = !isContentSection(section)
    ? []
    : content[section].filter(
        (row: Managed) =>
          Object.values(row.name)
            .join(" ")
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()) &&
          (!visibility || row.available === (visibility === "visible")) &&
          (section !== "items" ||
            !category ||
            (row as MenuItem).category === category),
      );
  const add = () => {
    setFailure("");
    setNotice("");
    setEditing("new");
  };
  const remove = async () => {
    if (!deleting || !isContentSection(section) || busy) return;
    setBusy(true);
    setFailure("");
    try {
      const { data, error } = await supabase!
        .from(tables[section])
        .delete()
        .eq("id", deleting.id)
        .select("id")
        .single();
      if (error || !data) {
        if (error?.code === "23503") throw new Error(t("categoryInUse"));
        throw new Error(t("error"));
      }
      setDeleting(null);
      setNotice("deleted");
      await content.refresh();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t("error"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main">
        {t("dashboard")}
      </a>
      <aside className="admin-sidebar">
        {brand}
        <span className="admin-workspace">{t("dashboard")}</span>
        <nav aria-label={t("dashboard")}>
          {links.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              aria-current={section === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {t(label)}
              {isContentSection(id) && <small>{content[id].length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>✦</span>
          <strong>{t("quick")}</strong>
          <p>{t("quickSub")}</p>
          <a href="/" target="_blank" rel="noopener noreferrer">
            {t("website")}
            <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="admin-account">
          <span className="avatar">
            {user?.email?.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>Admin</strong>
            <small>{user?.email}</small>
          </div>
          <button
            aria-label={t("logout")}
            title={t("logout")}
            disabled={busy}
            onClick={() => void signOut()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="admin-body">
        <header className="admin-topbar">
          <div>
            <span>LMA3LOUMA</span>
            <span>/</span>
            <strong>{t(section === "items" ? "menu" : section)}</strong>
          </div>
          <div>
            {language}
            <a
              className="admin-website"
              href="/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("website")}
              <ArrowUpRight size={16} />
            </a>
          </div>
        </header>
        <main id="admin-main" className="admin-main">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">
                {t("live")} <span>✦</span>
              </p>
              <h1>
                {section === "overview"
                  ? t("welcome")
                  : t(section === "items" ? "menu" : section)}
              </h1>
              <p>
                {section === "overview"
                  ? t("intro")
                  : section === "reviews"
                    ? t("reviewsHelp")
                    : t("visibleHelp")}
              </p>
            </div>
            {isContentSection(section) && (
              <Button
                onClick={add}
                disabled={
                  content.loading ||
                  content.error ||
                  (section === "items" && !content.categories.length)
                }
              >
                <Plus size={18} />
                {t("add")}
              </Button>
            )}
          </div>
          {notice && (
            <p role="status" className="admin-notice">
              {t(notice)}
            </p>
          )}
          {failure && !deleting && (
            <p role="alert" className="admin-error">
              {failure}
            </p>
          )}
          {section !== "reviews" && content.error && (
            <div className="admin-error" role="alert">
              {t("loadError")}{" "}
              <button onClick={() => void content.refresh()}>
                <RefreshCw size={15} />
                {t("retry")}
              </button>
            </div>
          )}
          {section === "reviews" ? (
            <ReviewsAdmin locale={locale} />
          ) : content.loading ? (
            <ContentSkeleton
              kind={section === "overview" ? "overview" : "table"}
            />
          ) : section === "overview" ? (
            <>
              <div className="admin-stats">
                {contentLinks.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => navigate(id)}>
                    <span className="stat-label">
                      {t(label)}
                      <Icon size={20} />
                    </span>
                    <strong>
                      {content[id].length.toString().padStart(2, "0")}
                    </strong>
                    <span className="stat-caption">
                      <span className="status-dot" />
                      {content[id].filter((row) => row.available).length}{" "}
                      {t("published")}
                      <ArrowUpRight size={18} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="admin-overview-grid">
                <section className="admin-panel">
                  <div className="panel-heading">
                    <h2>{t("recent")}</h2>
                    <button onClick={() => navigate("items")}>
                      {t("manage")}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {content.items.slice(0, 5).map((item) => (
                    <div className="overview-dish" key={item.id}>
                      <div className="admin-food-thumb">
                        <FoodVisual
                          kind={item.image}
                          label={item.name[locale]}
                        />
                      </div>
                      <div>
                        <strong>{item.name[locale]}</strong>
                        <small>
                          {
                            content.categories.find(
                              (c) => c.id === item.category,
                            )?.name[locale]
                          }
                        </small>
                      </div>
                      <b>
                        {item.price} <small>DH</small>
                      </b>
                      <button
                        className="admin-icon-button"
                        aria-label={`${t("edit")} ${item.name[locale]}`}
                        onClick={() => {
                          navigate("items");
                          setEditing(item);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  ))}
                  {!content.items.length && (
                    <p className="admin-empty">{t("empty")}</p>
                  )}
                </section>
                <section className="admin-promo">
                  <span className="eyebrow">FAIT AVEC GOÛT</span>
                  <span className="promo-spark">✳</span>
                  <h2>{t("quick")}</h2>
                  <p>{t("quickSub")}</p>
                  <Button
                    onClick={() => {
                      navigate("items");
                      if (content.categories.length) add();
                    }}
                  >
                    <Plus size={17} />
                    {t("add")}
                    <Utensils size={17} />
                  </Button>
                  <div className="promo-caption">
                    LMA3LOUMA <span>✦</span> CASABLANCA
                  </div>
                </section>
              </div>
              <section className="admin-panel overview-locations">
                <div className="panel-heading">
                  <h2>{t("locations")}</h2>
                  <button onClick={() => navigate("locations")}>
                    {t("edit")}
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                <div>
                  {content.locations.map((loc) => (
                    <article key={loc.id}>
                      <LoadingImage src={loc.image} alt="" />
                      <div>
                        <strong>{loc.name[locale]}</strong>
                        <p>{loc.address[locale]}</p>
                        <span
                          className={`admin-badge ${!loc.available ? "is-hidden" : ""}`}
                        >
                          {t(loc.available ? "published" : "hidden")}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="admin-panel">
              <div className="admin-filters">
                <label className="admin-search">
                  <Search size={18} />
                  <input
                    aria-label={t("search")}
                    placeholder={t("search")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {section === "items" && (
                  <Select
                    className="admin-filter-select"
                    label={t("category")}
                    value={category}
                    onChange={setCategory}
                    options={[
                      { value: "", label: t("all") },
                      ...content.categories.map((c) => ({
                        value: c.id,
                        label: c.name[locale],
                      })),
                    ]}
                  />
                )}
                <Select
                  className="admin-filter-select"
                  label={t("status")}
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                    { value: "", label: t("allStatus") },
                    { value: "visible", label: t("published") },
                    { value: "hidden", label: t("hidden") },
                  ]}
                />
                <span className="result-count">{rows.length}</span>
              </div>
              {section === "items" && !content.categories.length && (
                <p className="admin-empty">{t("noCategory")}</p>
              )}
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("name")}</th>
                      <th>
                        {t(
                          section === "items"
                            ? "category"
                            : section === "locations"
                              ? "address"
                              : "menu",
                        )}
                      </th>
                      {section === "items" && <th>{t("price")}</th>}
                      <th>{t("status")}</th>
                      <th>
                        <span className="sr-only">{t("edit")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="admin-entry-name">
                            {section === "items" ? (
                              <div className="admin-food-thumb">
                                <FoodVisual kind={(row as MenuItem).image} />
                              </div>
                            ) : section === "locations" ? (
                              <LoadingImage
                                className="admin-location-thumb"
                                src={(row as Location).image}
                                alt=""
                              />
                            ) : (
                              <span className="admin-category-icon">
                                {(row as Category).icon}
                              </span>
                            )}
                            <div>
                              <strong>{row.name[locale]}</strong>
                              <small>
                                {row.name[locale === "ar" ? "fr" : "ar"]}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {section === "items"
                            ? content.categories.find(
                                (c) => c.id === (row as MenuItem).category,
                              )?.name[locale]
                            : section === "locations"
                              ? (row as Location).address[locale]
                              : content.items.filter(
                                  (i) => i.category === row.id,
                                ).length}
                        </td>
                        {section === "items" && (
                          <td className="admin-price">
                            {(row as MenuItem).price} <small>DH</small>
                          </td>
                        )}
                        <td>
                          <span
                            className={`admin-badge ${!row.available ? "is-hidden" : ""}`}
                          >
                            {row.available ? (
                              <Eye size={12} />
                            ) : (
                              <EyeOff size={12} />
                            )}
                            {t(row.available ? "published" : "hidden")}
                          </span>
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              className="admin-icon-button"
                              aria-label={`${t("edit")} ${row.name[locale]}`}
                              onClick={() => {
                                setEditing(row);
                                setFailure("");
                              }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="admin-icon-button danger"
                              aria-label={`${t("delete")} ${row.name[locale]}`}
                              onClick={() => {
                                setDeleting(row);
                                setFailure("");
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <div className="admin-empty">
                  <Search size={28} />
                  <h3>{t("empty")}</h3>
                  <p>{t("emptySub")}</p>
                </div>
              )}
            </section>
          )}
          <div className="admin-bottom">
            <span>SHAWARMA LMA3LOUMA</span>
            <span>✦ {t("private")}</span>
          </div>
        </main>
      </div>
      {editing && isContentSection(section) && (
        <Editor
          section={section}
          entry={editing}
          categories={content.categories}
          locale={locale}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setNotice("saved");
            await content.refresh();
          }}
        />
      )}
      {deleting && (
        <Modal
          title={t("deleteTitle")}
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
          className="admin-dialog"
        >
          <div className="admin-delete">
            <span className="admin-icon">
              <Trash2 />
            </span>
            <h2>{t("deleteTitle")}</h2>
            <strong>{deleting.name[locale]}</strong>
            <p>{t("deleteSub")}</p>
            {section === "categories" &&
              content.items.some((i) => i.category === deleting.id) && (
                <p className="admin-error">{t("categoryInUse")}</p>
              )}
            {failure && (
              <p role="alert" className="admin-error">
                {failure}
              </p>
            )}
            <div className="admin-form-actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                {t("cancel")}
              </Button>
              <Button
                className="admin-danger-button"
                disabled={
                  busy ||
                  (section === "categories" &&
                    content.items.some((i) => i.category === deleting.id))
                }
                onClick={() => void remove()}
              >
                {busy ? t("saving") : t("delete")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
