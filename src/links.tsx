import type { ReactNode } from "react";
import {
  Bike,
  Ghost,
  Globe,
  MessageCircle,
  Send,
  ShoppingBag,
} from "lucide-react";
import { glovoUrl } from "./data";
import type { Locale } from "./data";
import type { LinkKind, SiteLink } from "./content";

// lucide-react no longer ships brand marks; these follow its 24px stroke style.
function Glyph({ size = 24, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
type IconProps = { size?: number };
function Instagram({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </Glyph>
  );
}
function Facebook({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Glyph>
  );
}
function TikTok({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 3c.4 2.6 2.4 4.6 5 4.9" />
    </Glyph>
  );
}
function YouTube({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </Glyph>
  );
}
function X({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4 4l11.7 16H20L8.3 4z" />
      <path d="M4 20l6.8-6.8" />
      <path d="M13.2 10.8 20 4" />
    </Glyph>
  );
}
function LinkedIn({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </Glyph>
  );
}

export type PlatformInfo = {
  name: string;
  /** The lists (social profiles, ordering links) this platform is offered in. */
  kinds: LinkKind[];
  placeholder: string;
  /** Badge background and glyph colors, from each brand's own palette. */
  color: string;
  ink: string;
  Icon: (props: IconProps) => ReactNode;
};
const teal = "#074d57";
export const platformCatalog: Record<string, PlatformInfo> = {
  instagram: {
    name: "Instagram",
    kinds: ["social"],
    placeholder: "https://www.instagram.com/…",
    color:
      "linear-gradient(45deg, #feda75, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5)",
    ink: "#fff",
    Icon: Instagram,
  },
  facebook: {
    name: "Facebook",
    kinds: ["social"],
    placeholder: "https://www.facebook.com/…",
    color: "#1877f2",
    ink: "#fff",
    Icon: Facebook,
  },
  tiktok: {
    name: "TikTok",
    kinds: ["social"],
    placeholder: "https://www.tiktok.com/@…",
    color: "#010101",
    ink: "#fff",
    Icon: TikTok,
  },
  youtube: {
    name: "YouTube",
    kinds: ["social"],
    placeholder: "https://www.youtube.com/@…",
    color: "#ff0000",
    ink: "#fff",
    Icon: YouTube,
  },
  snapchat: {
    name: "Snapchat",
    kinds: ["social"],
    placeholder: "https://www.snapchat.com/add/…",
    color: "#fffc00",
    ink: "#111",
    Icon: Ghost,
  },
  x: {
    name: "X",
    kinds: ["social"],
    placeholder: "https://x.com/…",
    color: "#000",
    ink: "#fff",
    Icon: X,
  },
  linkedin: {
    name: "LinkedIn",
    kinds: ["social"],
    placeholder: "https://www.linkedin.com/company/…",
    color: "#0a66c2",
    ink: "#fff",
    Icon: LinkedIn,
  },
  telegram: {
    name: "Telegram",
    kinds: ["social"],
    placeholder: "https://t.me/…",
    color: "#26a5e4",
    ink: "#fff",
    Icon: Send,
  },
  glovo: {
    name: "Glovo",
    kinds: ["order"],
    placeholder: "https://glovoapp.com/…",
    color: "#ffc244",
    ink: "#00a082",
    Icon: ShoppingBag,
  },
  klit: {
    name: "Klit",
    kinds: ["order"],
    placeholder: "https://app.klit.ma/restaurants/…",
    color: teal,
    ink: "#fff",
    Icon: Bike,
  },
  kooul: {
    name: "Kooul",
    kinds: ["order"],
    placeholder: "https://…",
    color: teal,
    ink: "#fff",
    Icon: Bike,
  },
  whatsapp: {
    name: "WhatsApp",
    kinds: ["social", "order"],
    placeholder: "https://wa.me/212…",
    color: "#25d366",
    ink: "#fff",
    Icon: MessageCircle,
  },
  other: {
    name: "",
    kinds: ["social", "order"],
    placeholder: "https://…",
    color: teal,
    ink: "#fff",
    Icon: Globe,
  },
};
export const platformOf = (key: string) =>
  platformCatalog[key] ?? platformCatalog.other;
/** The name shown for a link: the brand, or the admin's label for "other". */
export const linkName = (link: Pick<SiteLink, "platform" | "label">) =>
  platformCatalog[link.platform]?.name ||
  link.label.trim() ||
  (link.platform === "other" ? "" : link.platform);

export const socialLinks = (links: SiteLink[]) =>
  links.filter((link) => link.kind === "social");
/** Ordering links besides Glovo, which has its own buttons. */
export const extraOrderLinks = (links: SiteLink[]) =>
  links.filter((link) => link.kind === "order" && link.platform !== "glovo");
// Every "Order on Glovo" button needs a destination, even without a database.
export const orderUrl = (links: SiteLink[], locale: Locale) =>
  links.find((link) => link.kind === "order" && link.platform === "glovo")
    ?.url ?? glovoUrl(locale);

// The account name shown for a profile link, read from the saved URL:
// instagram.com/lma3loumaa → @lma3loumaa, wa.me/2126… → +2126…,
// threads.net/@lma3loumaa → @lma3loumaa.
export function profileHandle(link: SiteLink) {
  try {
    const url = new URL(link.url);
    const parts = url.pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const at = (name?: string) => (name ? `@${name.replace(/^@/, "")}` : "");
    const handle =
      link.platform === "instagram" ||
      link.platform === "tiktok" ||
      link.platform === "x" ||
      link.platform === "telegram"
        ? at(parts[0])
        : link.platform === "youtube"
          ? parts[0]?.startsWith("@")
            ? parts[0]
            : (parts[1] ?? "")
          : link.platform === "facebook"
            ? parts[0] === "people"
              ? (parts[1] ?? "")
              : (parts[0] ?? "")
            : link.platform === "snapchat"
              ? parts[0] === "add"
                ? (parts[1] ?? "")
                : (parts[0] ?? "")
              : link.platform === "linkedin"
                ? (parts[1] ?? parts[0] ?? "")
                : link.platform === "whatsapp"
                  ? /^\d{6,15}$/.test(parts[0] ?? "")
                    ? `+${parts[0]}`
                    : ""
                  : // Elsewhere, a /@name path (Threads, Medium…) or the site.
                    parts[0]?.startsWith("@")
                    ? parts[0]
                    : url.hostname.replace(/^www\./, "");
    if (handle && !handle.includes(".php")) return handle;
  } catch {
    // Unparseable links still work; they just show the platform name.
  }
  return linkName(link);
}

export type PostPlatform = "instagram" | "facebook" | "tiktok";
export type ParsedPost = {
  platform: PostPlatform;
  /** A reel or video, as opposed to a photo post. */
  video: boolean;
  /** Official embed page, when the platform offers one for this link. */
  embed?: string;
  /** TikTok's id, for its controllable player. */
  tiktokId?: string;
};
/**
 * Recognizes a post or reel link and how it can be shown. Returns null for
 * anything else, including TikTok short links (vm.tiktok.com), which carry no
 * video id.
 */
export function parsePost(raw: string): ParsedPost | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m|web|mobile)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "instagram.com") {
    const at = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p));
    const code = parts[at + 1];
    if (at < 0 || !code || !/^[\w-]+$/.test(code)) return null;
    const video = parts[at] !== "p";
    return {
      platform: "instagram",
      video,
      embed: `https://www.instagram.com/${video ? "reel" : "p"}/${code}/embed/`,
    };
  }
  if (host === "tiktok.com") {
    const at = parts.findIndex((p) => p === "video" || p === "photo");
    const id = parts[at + 1] ?? "";
    if (at < 0 || !/^\d{8,25}$/.test(id)) return null;
    return { platform: "tiktok", video: parts[at] === "video", tiktokId: id };
  }
  if (host === "facebook.com" || host === "fb.watch") {
    if (!parts.length) return null;
    const video =
      host === "fb.watch" ||
      parts.some((p) => ["videos", "reel", "reels", "watch"].includes(p));
    const href =
      host === "fb.watch"
        ? url.href
        : `https://www.facebook.com${url.pathname}${url.search}`;
    return {
      platform: "facebook",
      video,
      // Facebook's post plugin needs at least 350px, wider than a reel card,
      // so photo posts are shown as a link card with their cover instead.
      embed: video
        ? `https://www.facebook.com/plugins/video.php?show_text=false&href=${encodeURIComponent(href)}`
        : undefined,
    };
  }
  return null;
}

/** TikTok's embed player, started muted with the site's own controls. */
export const tiktokPlayer = (id: string) =>
  `https://www.tiktok.com/player/v1/${id}?${new URLSearchParams({
    autoplay: "0",
    muted: "1",
    loop: "1",
    controls: "0",
    progress_bar: "0",
    play_button: "0",
    volume_control: "0",
    fullscreen_button: "0",
    timestamp: "0",
    music_info: "0",
    description: "0",
    rel: "0",
    native_context_menu: "0",
    closed_caption: "0",
  })}`;
