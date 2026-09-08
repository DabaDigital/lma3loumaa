import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Plus, Trash2, Save, Upload } from "lucide-react";
import { Button, foodImages, FoodVisual, Modal, Select } from "../components";
import { l } from "../data";
import type { Locale, Localized } from "../data";
import type { Category, MenuItem, Location } from "../content";
import { supabase } from "../supabase";
import { copy } from "./copy";
import type { Entry, Section } from "./Admin";

const languages = { fr: "Français", en: "English", ar: "العربية" };
// Mirrors the bucket limits set in supabase/storage.sql. Both are enforced
// server-side too; these only give a clearer message before the round trip.
const IMAGE_BUCKET = "menu-images";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function Editor({
  section,
  entry,
  categories,
  locale,
  onClose,
  onSaved,
}: {
  section: Exclude<Section, "overview">;
  entry: Entry | "new";
  categories: Category[];
  locale: Locale;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = (key: keyof typeof copy) => copy[key][locale];
  const existing = entry === "new" ? null : entry;
  const item = existing as MenuItem | null;
  const location = existing as Location | null;
  const [name, setName] = useState(existing?.name ?? l("", "", ""));
  const [description, setDescription] = useState(
    item?.description ?? l("", "", ""),
  );
  const [area, setArea] = useState(location?.area ?? l("", "", ""));
  const [address, setAddress] = useState(location?.address ?? l("", "", ""));
  const [image, setImage] = useState(
    section === "items"
      ? (item?.image ?? "classic")
      : (location?.image ?? "/assets/maarif.png"),
  );
  const [customImage, setCustomImage] = useState(!(image in foodImages));
  const [variants, setVariants] = useState(item?.variants ?? []);
  const [category, setCategory] = useState(
    item?.category ?? categories[0]?.id ?? "",
  );
  const [tag, setTag] = useState(item?.tag ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState("");
  // Upload failures are reported next to the upload button: the form-level
  // error sits below the fold, where a failed pick looks like nothing happened.
  const [uploadError, setUploadError] = useState("");
  const [uploadDetail, setUploadDetail] = useState("");
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Let the same file be picked again after a failure.
    if (!file || !supabase || uploading) return;
    setUploaded(false);
    setUploadDetail("");
    if (!IMAGE_TYPES.includes(file.type)) {
      setUploadError(t("imageType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(t("imageSize"));
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const extension = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${section}/${crypto.randomUUID()}.${extension}`;
      const { error: failure } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "31536000",
        });
      if (failure) throw failure;
      const { publicUrl } = supabase.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(path).data;
      // The database only accepts https:// or /assets/ images.
      if (!publicUrl.startsWith("https://")) throw new Error(publicUrl);
      setImage(publicUrl);
      setCustomImage(true);
      setUploaded(true);
    } catch (failure) {
      // Storage explains refusals precisely (missing policy, bucket, MIME type);
      // that reason is worth more to an administrator than a generic apology.
      setUploadError(t("uploadError"));
      setUploadDetail(failure instanceof Error ? failure.message : "");
    } finally {
      setUploading(false);
    }
  };
  const localized = (
    label: string,
    value: Localized,
    update: (v: Localized) => void,
    multiline = false,
  ) => (
    <fieldset className="admin-localized">
      <legend>{label}</legend>
      <div>
        {(["fr", "en", "ar"] as const).map((lng) => (
          <label className="admin-field" key={lng}>
            <span>{languages[lng]}</span>
            {multiline ? (
              <textarea
                aria-label={`${label} · ${languages[lng]}`}
                dir={lng === "ar" ? "rtl" : "ltr"}
                lang={lng}
                rows={3}
                required
                maxLength={1500}
                value={value[lng]}
                onChange={(e) => update({ ...value, [lng]: e.target.value })}
              />
            ) : (
              <input
                aria-label={`${label} · ${languages[lng]}`}
                dir={lng === "ar" ? "rtl" : "ltr"}
                lang={lng}
                required
                maxLength={240}
                value={value[lng]}
                onChange={(e) => update({ ...value, [lng]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || uploading || !supabase) return;
    const form = new FormData(e.currentTarget);
    const trimmed = (value: Localized) =>
      Object.fromEntries(
        Object.entries(value).map(([key, text]) => [key, text.trim()]),
      ) as Localized;
    if (Object.values(name).some((text) => !text.trim())) {
      setError(t("error"));
      return;
    }
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = {
      name: trimmed(name),
      available: form.get("available") === "on",
      sort_order: Number(form.get("sort_order")),
    };
    if (section === "categories")
      payload.icon = String(form.get("icon")).trim() || "✦";
    if (section === "items")
      Object.assign(payload, {
        description: trimmed(description),
        category: form.get("category"),
        price: Number(form.get("price")),
        menuPrice: form.get("menuPrice") ? Number(form.get("menuPrice")) : null,
        image: image.trim(),
        tag: form.get("tag") || null,
        variants: variants.length
          ? variants.map((v) => ({ name: trimmed(v.name), price: v.price }))
          : null,
      });
    if (section === "locations")
      Object.assign(payload, {
        area: trimmed(area),
        address: trimmed(address),
        map: String(form.get("map")).trim(),
        image: image.trim(),
      });
    try {
      const table = section === "items" ? "menu_items" : section;
      const request = existing
        ? supabase.from(table).update(payload).eq("id", existing.id)
        : supabase.from(table).insert({ ...payload, id: crypto.randomUUID() });
      const { data, error: failure } = await request.select("id").single();
      if (failure || !data) throw failure;
      await onSaved();
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`${t(existing ? "edit" : "add")} · ${t(section === "items" ? "menu" : section)}`}
      className="admin-dialog admin-editor"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={save}>
        <div className="admin-editor-heading">
          <p className="eyebrow">
            LMA3LOUMA · {t(section === "items" ? "menu" : section)}
          </p>
          <h2>{t(existing ? "edit" : "add")}</h2>
          <p>{t("translations")}</p>
        </div>
        <fieldset className="admin-form-body" disabled={busy}>
          {localized(t("name"), name, setName)}
          {section === "items" && (
            <>
              {localized(t("description"), description, setDescription, true)}
              <div className="admin-form-grid">
                <div className="admin-field">
                  <span>{t("category")}</span>
                  <Select
                    name="category"
                    label={t("category")}
                    value={category}
                    onChange={setCategory}
                    options={categories.map((c) => ({
                      value: c.id,
                      label: c.name[locale],
                    }))}
                  />
                </div>
                <div className="admin-field">
                  <span>{t("tag")}</span>
                  <Select
                    name="tag"
                    label={t("tag")}
                    value={tag}
                    onChange={setTag}
                    options={[
                      { value: "", label: t("none") },
                      ...(["signature", "spicy", "sharing"] as const).map(
                        (key) => ({ value: key, label: t(key) }),
                      ),
                    ]}
                  />
                </div>
                <label className="admin-field">
                  {t("price")}
                  <input
                    type="number"
                    name="price"
                    min="0"
                    max="100000"
                    step="0.01"
                    required
                    defaultValue={item?.price ?? ""}
                  />
                </label>
                <label className="admin-field">
                  {t("menuPrice")}
                  <input
                    type="number"
                    name="menuPrice"
                    min="0"
                    max="100000"
                    step="0.01"
                    defaultValue={item?.menuPrice ?? ""}
                  />
                </label>
              </div>
            </>
          )}
          {section === "categories" && (
            <label className="admin-field">
              {t("icon")}
              <input
                name="icon"
                maxLength={8}
                required
                defaultValue={(existing as Category)?.icon ?? "✦"}
              />
            </label>
          )}
          {section === "locations" && (
            <>
              {localized(t("area"), area, setArea)}
              {localized(t("address"), address, setAddress)}
              <label className="admin-field">
                {t("map")}
                <input
                  type="url"
                  name="map"
                  required
                  pattern="https://.*"
                  defaultValue={location?.map ?? ""}
                  placeholder="https://www.google.com/maps/…"
                />
              </label>
            </>
          )}
          {section !== "categories" && (
            <div className="admin-image-field">
              <div>
                {section === "items" && (
                  <div className="admin-field">
                    <span>{t("image")}</span>
                    <Select
                      label={t("image")}
                      value={customImage ? "custom" : image}
                      onChange={(v) => {
                        setCustomImage(v === "custom");
                        setImage(v === "custom" ? "" : v);
                      }}
                      options={[
                        ...Object.keys(foodImages).map((kind) => ({
                          value: kind,
                          label: kind,
                        })),
                        { value: "custom", label: t("custom") },
                      ]}
                    />
                  </div>
                )}
                {/* Uploading is offered from the start: picking a file is
                    itself the switch to a custom photo. */}
                <div className="admin-upload">
                  <label
                    className={`admin-upload-button ${uploading ? "is-busy" : ""}`}
                  >
                    <Upload size={16} />
                    {uploading ? t("uploading") : t("upload")}
                    <input
                      type="file"
                      accept={IMAGE_TYPES.join(",")}
                      disabled={uploading}
                      onChange={(e) => void upload(e)}
                    />
                  </label>
                  <small>{t("uploadHelp")}</small>
                  {uploaded && (
                    <small className="admin-upload-done" role="status">
                      {t("uploaded")}
                    </small>
                  )}
                  {uploadError && (
                    <p className="admin-upload-error" role="alert">
                      {uploadError}
                      {uploadDetail && <small>{uploadDetail}</small>}
                    </p>
                  )}
                </div>
                {(customImage || section === "locations") && (
                  <label className="admin-field">
                    <span>
                      {t("imageUrl")} <em>{t("uploadOr")}</em>
                    </span>
                    <input
                      required
                      pattern="(https://.*|/assets/.*)"
                      value={image}
                      onChange={(e) => {
                        setImage(e.target.value);
                        setUploaded(false);
                      }}
                      placeholder="https://…"
                    />
                    <small>{t("imageHelp")}</small>
                  </label>
                )}
              </div>
              {image && (
                <div className="admin-image-preview">
                  {section === "items" ? (
                    <FoodVisual kind={image} label={name[locale]} />
                  ) : (
                    <img
                      src={
                        image.startsWith("https://") ||
                        image.startsWith("/assets/")
                          ? image
                          : undefined
                      }
                      alt=""
                    />
                  )}
                </div>
              )}
            </div>
          )}
          {section === "items" && (
            <section className="admin-variants">
              <div className="panel-heading">
                <h3>{t("variants")}</h3>
                <button
                  type="button"
                  onClick={() =>
                    setVariants([
                      ...variants,
                      { name: l("", "", ""), price: 0 },
                    ])
                  }
                >
                  <Plus size={16} />
                  {t("addVariant")}
                </button>
              </div>
              {variants.map((variant, index) => (
                <div className="admin-variant" key={index}>
                  {localized(
                    `${t("name")} ${index + 1}`,
                    variant.name,
                    (value) =>
                      setVariants(
                        variants.map((v, i) =>
                          i === index ? { ...v, name: value } : v,
                        ),
                      ),
                  )}
                  <div className="admin-variant-bottom">
                    <label className="admin-field">
                      {t("price")}
                      <input
                        aria-label={`${t("price")} ${index + 1}`}
                        type="number"
                        min="0"
                        max="100000"
                        step="0.01"
                        required
                        value={variant.price}
                        onChange={(e) =>
                          setVariants(
                            variants.map((v, i) =>
                              i === index
                                ? { ...v, price: e.target.valueAsNumber }
                                : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-icon-button danger"
                      aria-label={`${t("delete")} ${index + 1}`}
                      onClick={() =>
                        setVariants(variants.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
          <div className="admin-form-grid">
            <label className="admin-field">
              {t("order")}
              <input
                type="number"
                name="sort_order"
                min="0"
                max="100000"
                step="1"
                required
                defaultValue={existing?.sort_order ?? 0}
              />
            </label>
            <label className="admin-publish">
              <input
                name="available"
                type="checkbox"
                defaultChecked={existing?.available ?? true}
              />
              <span>
                <strong>{t("published")}</strong>
                <small>{t("visibleHelp")}</small>
              </span>
            </label>
          </div>
        </fieldset>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={busy || uploading}>
            <Save size={17} />
            {busy ? t("saving") : uploading ? t("uploading") : t("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
