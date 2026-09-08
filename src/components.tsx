import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  CSSProperties,
  RefObject,
} from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FoodImage, Locale } from "./data";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Input({
  label,
  icon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <label className="input-wrap" htmlFor={id}>
      <span className="sr-only">{label}</span>
      {icon}
      <input id={id} {...props} />
    </label>
  );
}
export type Option = { value: string; label: string };

/** Close a popup when a pointer lands outside it. */
function useOutsideClose(
  open: boolean,
  close: () => void,
  ref: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", fn);
    return () => document.removeEventListener("pointerdown", fn);
  }, [open, close, ref]);
}

/**
 * Position a popup against its trigger using fixed coordinates.
 * `.modal` sets overflow-y, which clips absolutely positioned children, so the
 * panels have to escape that containing block. Rects are physical, so reading
 * `left`/`width` keeps this correct in RTL without a separate branch.
 */
function usePopoverPosition(
  open: boolean,
  trigger: RefObject<HTMLElement | null>,
  minWidth = 0,
) {
  const [style, setStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = trigger.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 14;
      const above = r.top - 14;
      const flip = below < 240 && above > below;
      const width = Math.max(r.width, minWidth);
      // Anchor to the trigger's leading edge, which is its right in Arabic.
      const rtl = getComputedStyle(el).direction === "rtl";
      const start = rtl ? r.right - width : r.left;
      setStyle({
        position: "fixed",
        left: Math.round(
          Math.min(Math.max(8, start), window.innerWidth - width - 8),
        ),
        width,
        maxHeight: Math.round(Math.max(170, flip ? above : below)),
        ...(flip
          ? { bottom: Math.round(window.innerHeight - r.top + 7) }
          : { top: Math.round(r.bottom + 7) }),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, trigger, minWidth]);
  return style;
}

/**
 * Listbox styled with the site's own tokens, replacing the native `<select>`
 * whose option list the browser paints in its own chrome (and in LTR, which
 * reads as broken inside the Arabic layout).
 */
export function Select({
  label,
  value,
  onChange,
  options,
  name,
  disabled,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, close, wrap);
  const style = usePopoverPosition(open, trigger);
  const selected = options.find((o) => o.value === value);
  const items = () =>
    Array.from(
      panel.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ??
        [],
    );
  useEffect(() => {
    if (!open) return;
    const list = items();
    const target = list.find((el) => el.dataset.value === value) ?? list[0];
    // The measured max-height lands in a later commit, so the panel is not yet
    // scrollable when focus moves; bring the option into view once it is.
    target?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() =>
      target?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const dismiss = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className={`select-wrap ${className}`} ref={wrap}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        ref={trigger}
        className="select-trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {selected?.label ?? ""}
      </button>
      <ChevronDown size={15} aria-hidden="true" />
      {open && (
        <div
          id={id}
          ref={panel}
          className="select-panel"
          role="listbox"
          aria-label={label}
          style={style}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Tab") {
              e.preventDefault();
              dismiss();
              return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
              return;
            e.preventDefault();
            const list = items();
            const at = list.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? list.length - 1
                  : (at + (e.key === "ArrowUp" ? -1 : 1) + list.length) %
                    list.length;
            list[next]?.focus();
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              data-value={option.value}
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                dismiss();
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track">
        <span />
      </span>
      <span>
        {label}
        {description && <small>{description}</small>}
      </span>
    </button>
  );
}
export function Dropdown({
  value,
  onChange,
}: {
  value: Locale;
  onChange: (v: Locale) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const fn = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", fn);
    return () => document.removeEventListener("pointerdown", fn);
  }, []);
  return (
    <div
      className="dropdown"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
        if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const opts = Array.from(
            ref.current!.querySelectorAll<HTMLButtonElement>(
              '[role="menuitemradio"]',
            ),
          );
          let n = opts.indexOf(document.activeElement as HTMLButtonElement);
          n =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? 2
                : (n + (e.key === "ArrowUp" ? -1 : 1) + 3) % 3;
          opts[n].focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="language-button"
        aria-label={t("language")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() =>
              ref.current
                ?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')
                ?.focus(),
            );
          }
        }}
      >
        <Globe size={17} />
        <span>{value.toUpperCase()}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          id={id}
          className="dropdown-panel"
          role="menu"
          aria-label={t("language")}
        >
          {(["fr", "en", "ar"] as const).map((lng, i) => (
            <button
              key={lng}
              role="menuitemradio"
              aria-checked={value === lng}
              lang={lng}
              onClick={() => {
                onChange(lng);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span>{["Français", "English", "العربية"][i]}</span>
              {value === lng && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// Casablanca reads dates in Moroccan Arabic (شتنبر) with Latin digits, which is
// what ar-MA gives; the browser's own picker ignores the app's language entirely.
const tags: Record<string, string> = {
  fr: "fr-MA",
  en: "en-GB",
  ar: "ar-MA",
};
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
// Parsed as local time on purpose: `new Date("2026-09-06")` is UTC midnight and
// lands on the previous day for anyone behind Greenwich.
const parse = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date();
};
const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

export function DatePicker({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: string;
}) {
  const { t, i18n } = useTranslation();
  const tag = tags[i18n.resolvedLanguage || "fr"] || "fr-MA";
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parse(value));
  const [cursor, setCursor] = useState(value);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, close, wrap);
  const style = usePopoverPosition(open, trigger, 290);
  useEffect(() => {
    if (open) {
      setMonth(parse(value));
      setCursor(value);
    }
  }, [open, value]);
  useEffect(() => {
    if (open)
      grid.current
        ?.querySelector<HTMLButtonElement>('[tabindex="0"]')
        ?.focus({ preventScroll: true });
  }, [open, cursor]);

  const monthLabel = new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
  }).format(month);
  // 1 Jan 2024 is a Monday, so this yields a Monday-first week for fr/en/ar.
  const weekdays = [...Array(7)].map((_, i) => {
    const day = new Date(2024, 0, 1 + i);
    return {
      narrow: new Intl.DateTimeFormat(tag, { weekday: "narrow" }).format(day),
      full: new Intl.DateTimeFormat(tag, { weekday: "long" }).format(day),
    };
  });
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const total = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const days = [
    ...Array(lead).fill(null),
    ...[...Array(total)].map((_, i) => i + 1),
  ];
  const today = iso(new Date());

  const shift = (by: number) => {
    const next = parse(cursor || value);
    next.setDate(next.getDate() + by);
    if (iso(next) < min) return;
    setCursor(iso(next));
    if (
      next.getMonth() !== month.getMonth() ||
      next.getFullYear() !== month.getFullYear()
    )
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  };
  const dismiss = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="field" ref={wrap}>
      <span id={`${id}-label`}>{label}</span>
      <button
        type="button"
        ref={trigger}
        className="picker-trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span id={`${id}-value`}>
          {new Intl.DateTimeFormat(tag, {
            weekday: "short",
            day: "numeric",
            month: "long",
          }).format(parse(value))}
        </span>
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="picker-panel"
          role="dialog"
          aria-label={label}
          style={style}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              dismiss();
              return;
            }
            const by: Record<string, number> = {
              ArrowRight: 1,
              ArrowLeft: -1,
              ArrowDown: 7,
              ArrowUp: -7,
            };
            if (e.key in by) {
              e.preventDefault();
              shift(by[e.key]);
            }
          }}
        >
          <div className="picker-head">
            <button
              type="button"
              aria-label={t("prevMonth")}
              disabled={
                iso(new Date(month.getFullYear(), month.getMonth(), 0)) < min
              }
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <strong>{monthLabel}</strong>
            <button
              type="button"
              aria-label={t("nextMonth")}
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="picker-weekdays" aria-hidden="true">
            {weekdays.map((d) => (
              <span key={d.full} title={d.full}>
                {d.narrow}
              </span>
            ))}
          </div>
          <div
            className="picker-grid"
            ref={grid}
            role="grid"
            aria-label={monthLabel}
          >
            {days.map((day, i) => {
              if (!day) return <span key={`pad-${i}`} />;
              const date = new Date(month.getFullYear(), month.getMonth(), day);
              const stamp = iso(date);
              const disabled = stamp < min;
              return (
                <button
                  key={stamp}
                  type="button"
                  disabled={disabled}
                  aria-selected={stamp === value}
                  aria-current={stamp === today ? "date" : undefined}
                  className={stamp === today ? "is-today" : undefined}
                  tabIndex={stamp === (cursor || value) ? 0 : -1}
                  aria-label={new Intl.DateTimeFormat(tag, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(date)}
                  onClick={() => {
                    onChange(stamp);
                    dismiss();
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Times the restaurants actually serve, so the field cannot hold 03:00. */
export function TimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const options: Option[] = [];
  for (let m = 11 * 60; m <= 23 * 60 + 45; m += 15) {
    const slot = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
      m % 60,
    ).padStart(2, "0")}`;
    options.push({ value: slot, label: slot });
  }
  // Keep a previously stored value selectable rather than silently rewriting it.
  if (value && !options.some((o) => o.value === value))
    options.unshift({ value, label: value });
  return (
    <div className="field">
      <span>{label}</span>
      <Select
        label={label}
        value={value}
        onChange={onChange}
        options={options}
      />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current!;
    const previous = document.activeElement as HTMLElement;
    el.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="close-button"
        aria-label={t("close")}
        onClick={onClose}
      >
        <X size={22} />
      </button>
      <h2 id={id} className="sr-only">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
/**
 * The restaurant's own cut-out photography, one transparent PNG per dish.
 * These replace sub-regions cropped out of the printed-menu sheets: those
 * regions were 68x68 to 298x148 for tiles rendered at 145-259 CSS pixels, so
 * every card upscaled its photo 1.4x-2.1x (2.9x-4.3x on a retina screen) and
 * needed a hand-drawn clip-path to hide the sheet background behind it.
 * Dimensions are the intrinsic pixel size, used to reserve space (no CLS).
 */
export const foodImages: Record<FoodImage, [string, number, number]> = {
  classic: ["01-original-shawarma", 945, 645],
  cheddar: ["02-cheddar-shawarma", 519, 462],
  jalapeno: ["03-jalapenos-shawarma", 573, 390],
  mexican: ["05-mexicaine-shawarma", 576, 378],
  plate: ["06-shawarma-plate", 846, 636],
  rolls: ["07-family-box-coke", 801, 645],
  family: ["08-family-box-large", 1110, 984],
  drink: ["09-drinks-assortment", 309, 216],
  fries: ["12-fries", 264, 138],
  lemonade: ["15-lemonade", 237, 264],
  mezze: ["23-spread-06", 268, 280],
  baba: ["20-spread-03", 288, 288],
  moutabal: ["18-spread-01", 292, 292],
  muhammara: ["21-spread-04", 288, 288],
  spicy: ["19-spread-02", 288, 288],
  beetroot: ["22-spread-05", 284, 284],
  houmousShawarma: ["24-spread-07", 288, 284],
  // Both desserts are mahalabia; only the pistachio-topped bowl was supplied,
  // so the plain one borrows it until a photo of its own exists.
  kunafa: ["16-hummus", 246, 243],
  dessert: ["16-hummus", 246, 243],
};
export function FoodVisual({
  kind,
  className = "",
  label = "",
}: {
  kind: string;
  className?: string;
  label?: string;
}) {
  if (!(kind in foodImages))
    return (
      <div className={`food-visual food-custom ${className}`}>
        <img
          src={
            kind.startsWith("https://") || kind.startsWith("/assets/")
              ? kind
              : `/assets/menu/${foodImages.classic[0]}.png`
          }
          alt={label}
          loading="lazy"
        />
      </div>
    );
  const [file, w, h] = foodImages[kind as FoodImage];
  return (
    <div
      className={`food-visual food-${kind} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={!label}
      style={{ "--food-ratio": `${w}/${h}` } as CSSProperties}
    >
      <div className="food-crop" style={{ aspectRatio: `${w}/${h}` }}>
        <img
          src={`/assets/menu/${file}.png`}
          alt=""
          width={w}
          height={h}
          loading={className.includes("hero") ? "eager" : "lazy"}
          draggable={false}
        />
      </div>
    </div>
  );
}
export function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={`button ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={18} aria-hidden="true" />
    </a>
  );
}
