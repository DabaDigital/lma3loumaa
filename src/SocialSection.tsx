import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, RefObject } from "react";
import {
  ArrowUpRight,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SiteLink, SocialPost } from "./content";
import { socialPosts } from "./data";
import type { Locale } from "./data";
import { LoadingImage } from "./LoadingImage";
import {
  linkName,
  parsePost,
  platformOf,
  profileHandle,
  socialLinks,
  tiktokPlayer,
} from "./links";
import type { ParsedPost } from "./links";
import "./socialSection.css";

/** The section shows four posts, like the dashboard allows. */
const SHOWN_POSTS = 4;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
// Lets a long handle such as "shawarma.lma3louma" wrap after its dot rather
// than mid-word on a narrow phone.
const breakable = (handle: string) =>
  handle.split(/(?<=[._])/).map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));
const joinNames = (names: string[], and: string, comma: string) =>
  names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(comma)} ${and} ${names.at(-1)}`;

type Zone = "in" | "edge" | "away";
/**
 * Where a card sits: "in" once 60% shows, "away" below 20% (or while the
 * tab is hidden), and "edge" in between, where nothing changes. The gap
 * keeps a video from flickering between playing and paused at the border.
 */
function useZone(ref: RefObject<HTMLElement | null>) {
  const [zone, setZone] = useState<Zone>("away");
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let ratio = 0;
    const apply = () =>
      setZone(
        document.hidden || ratio < 0.2 ? "away" : ratio >= 0.6 ? "in" : "edge",
      );
    const observer = new IntersectionObserver(
      ([entry]) => {
        ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
        if (ratio > 0) setSeen(true);
        apply();
      },
      { threshold: [0, 0.2, 0.6] },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", apply);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, [ref]);
  return { zone, seen };
}

/** Each reel rests in place for part of its scroll before the next slides in. */
function settle(position: number) {
  const step = Math.floor(position);
  const t = clamp((position - step - 0.15) / 0.7, 0, 1);
  return step + t * t * (3 - 2 * t);
}
/**
 * Phones: like the menu's shawarmas, a native sticky runway pins the reels
 * under the header and turns vertical scroll into sliding from one reel to
 * the next, then releases the page after the last. Nothing locks the wheel
 * or touch, so every way of scrolling keeps working. Elsewhere, or with
 * motion off, the cards stay a grid (or a swipeable row on phones).
 */
function useReelRunway(
  runway: RefObject<HTMLDivElement | null>,
  count: number,
  enabled: boolean,
  rtl: boolean,
) {
  useLayoutEffect(() => {
    const root = runway.current;
    const stage = root?.querySelector<HTMLElement>(".social-stage");
    const track = root?.querySelector<HTMLElement>(".social-track");
    if (!root || !stage || !track) return;
    const phone = window.matchMedia("(max-width: 650px)");
    const header = document.querySelector<HTMLElement>(".header");
    const dock = document.querySelector<HTMLElement>(".mobile-order-bar");
    let pinned = false;
    let pinTop = 0;
    let travel = 0;
    let step = 0;
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (!pinned) return;
      const progress = clamp(
        (pinTop - root.getBoundingClientRect().top) / travel,
        0,
        1,
      );
      const position = settle(progress * (count - 1));
      track.style.transform = `translate3d(${((rtl ? 1 : -1) * position * step).toFixed(1)}px, 0, 0)`;
      root.style.setProperty("--reel-progress", (position / (count - 1)).toFixed(4));
    };
    const requestPaint = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const measure = () => {
      const headerHeight = header?.offsetHeight ?? 0;
      const view = document.documentElement.clientHeight;
      // Phones keep an order bar fixed over the bottom of the screen.
      const covered =
        dock && getComputedStyle(dock).position === "fixed"
          ? dock.offsetHeight
          : 0;
      const room = view - headerHeight - covered;
      root.style.setProperty("--social-room", `${room}px`);
      pinned = enabled && phone.matches && count > 1 && room >= 440;
      root.dataset.pinned = String(pinned);
      if (pinned) {
        const first = track.firstElementChild as HTMLElement | null;
        step =
          (first?.offsetWidth ?? 0) +
          parseFloat(getComputedStyle(track).columnGap || "0");
        pinTop = headerHeight;
        travel = Math.round(clamp(view * 0.6, 320, 520) * (count - 1));
        root.style.setProperty("--social-pin-top", `${pinTop}px`);
        root.style.setProperty("--social-travel", `${travel}px`);
        paint();
      } else {
        track.style.transform = "";
        root.style.removeProperty("--social-pin-top");
        root.style.removeProperty("--social-travel");
        root.style.removeProperty("--reel-progress");
      }
    };
    // Tabbing to a reel's link scrolls the page to that reel.
    const onFocus = (event: FocusEvent) => {
      if (!pinned) return;
      const card = (event.target as HTMLElement).closest("li");
      const index = [...track.children].indexOf(card as Element);
      if (index < 0) return;
      window.scrollTo({
        top: Math.round(
          scrollY +
            root.getBoundingClientRect().top -
            pinTop +
            (travel * index) / (count - 1),
        ),
        behavior: "instant",
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(stage);
    if (header) resize.observe(header);
    if (dock) resize.observe(dock);
    phone.addEventListener("change", measure);
    track.addEventListener("focusin", onFocus);
    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      phone.removeEventListener("change", measure);
      track.removeEventListener("focusin", onFocus);
      window.removeEventListener("scroll", requestPaint);
      window.removeEventListener("resize", measure);
      track.style.transform = "";
      delete root.dataset.pinned;
    };
  }, [runway, count, enabled, rtl]);
}

/** A video file the site plays itself. */
function VideoMedia({
  src,
  poster,
  playing,
  muted,
  title,
  onBlocked,
}: {
  src: string;
  poster: string | null;
  playing: boolean;
  muted: boolean;
  title: string;
  onBlocked: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  // Muting is applied before playing: browsers only autoplay muted video.
  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (playing) void element.play().catch(onBlocked);
    else element.pause();
  }, [playing]);
  return (
    <video
      ref={video}
      src={src}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={title}
    />
  );
}

const TIKTOK = "https://www.tiktok.com";
/** TikTok's player, driven through its documented postMessage API. */
function TikTokMedia({
  id,
  playing,
  muted,
  title,
}: {
  id: string;
  playing: boolean;
  muted: boolean;
  title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const send = useCallback((type: string) => {
    frame.current?.contentWindow?.postMessage(
      { "x-tiktok-player": true, type },
      TIKTOK,
    );
  }, []);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== TIKTOK || event.source !== frame.current?.contentWindow)
        return;
      let data = event.data;
      if (typeof data === "string")
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      if (data?.["x-tiktok-player"] && data.type === "onPlayerReady")
        setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  useEffect(() => {
    if (ready) send(muted ? "mute" : "unMute");
  }, [ready, muted, send]);
  useEffect(() => {
    if (ready) send(playing ? "play" : "pause");
  }, [ready, playing, send]);
  return (
    <iframe
      ref={frame}
      src={tiktokPlayer(id)}
      title={title}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

const INSTAGRAM_ORIGIN = /^https:\/\/([\w-]+\.)*instagram\.com$/;
/**
 * Instagram's and Facebook's official players. Neither lets a site change
 * their sound, so once a visitor has used one, it is reloaded when it
 * scrolls away: whatever was playing stops, and it comes back silent.
 *
 * Instagram's embed is taller than a reel card. It reports its height (the
 * MEASURE message its own embed script reads), so it is shown whole, scaled
 * to the card, without a scrollbar and without cropping any of it.
 */
function EmbedMedia({
  src,
  platform,
  away,
  title,
}: {
  src: string;
  platform: "instagram" | "facebook";
  away: boolean;
  title: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const engaged = useRef(false);
  const [generation, setGeneration] = useState(0);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [natural, setNatural] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const read = () => {
      const width = Math.round(element.clientWidth);
      const height = Math.round(element.clientHeight);
      if (width && height)
        setSize((current) =>
          current?.width === width && current.height === height
            ? current
            : { width, height },
        );
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        !INSTAGRAM_ORIGIN.test(event.origin) ||
        event.source !== frame.current?.contentWindow
      )
        return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "MEASURE" && typeof data.details?.height === "number")
          setNatural(data.details.height);
      } catch {
        // Other messages from the embed are not ours to read.
      }
    };
    // A click inside a cross-origin frame blurs this window and focuses it.
    const onBlur = () =>
      window.setTimeout(() => {
        if (document.activeElement === frame.current) engaged.current = true;
      });
    window.addEventListener("message", onMessage);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  useEffect(() => {
    if (away && engaged.current) {
      engaged.current = false;
      setGeneration((current) => current + 1);
    }
  }, [away]);
  let url = src;
  let style: CSSProperties | undefined;
  if (size && platform === "facebook")
    url = `${src}&width=${size.width}&height=${size.height}`;
  else if (size) {
    // Until Instagram reports it, estimate: header, 4:5 media and footer.
    const height = natural ?? Math.round(size.width * 1.25 + 200);
    const scale = Math.min(1, size.height / height);
    style = {
      width: size.width,
      height,
      transform: `translateX(-50%) scale(${scale.toFixed(4)})`,
    };
  }
  return (
    <div className="social-reel-embed" ref={box}>
      {size && (
        <iframe
          key={generation}
          ref={frame}
          className={platform === "instagram" ? "social-reel-fit" : undefined}
          src={url}
          title={title}
          scrolling="no"
          style={style}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}

function Chip({ platform, label }: { platform: string; label: string }) {
  const { Icon } = platformOf(platform);
  return (
    <span className="social-chip">
      <Icon size={14} />
      {label}
    </span>
  );
}

function PostCard({
  post,
  parsed,
  number,
  motion,
  sound,
  onSound,
}: {
  post: SocialPost;
  parsed: ParsedPost;
  number: number;
  motion: boolean;
  sound: boolean;
  onSound: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  const card = useRef<HTMLLIElement>(null);
  const { zone, seen } = useZone(card);
  const info = platformOf(parsed.platform);
  const title = `${t(parsed.video ? "videoOn" : "postOn", { platform: info.name })} ${number}`;
  const mode = post.video
    ? "video"
    : parsed.tiktokId
      ? "tiktok"
      : parsed.embed
        ? "embed"
        : "link";
  const controllable = mode === "video" || (mode === "tiktok" && parsed.video);
  const chip = (
    <Chip
      platform={parsed.platform}
      label={t(
        !parsed.video
          ? "chipPost"
          : parsed.platform === "instagram"
            ? "chipReel"
            : "chipVideo",
      )}
    />
  );
  // Playback follows the visitor's motion setting until they press play.
  const [wanted, setWanted] = useState(motion);
  useEffect(() => setWanted(motion), [motion]);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (zone === "in") setActive(true);
    if (zone === "away") {
      setActive(false);
      onSound(false);
    }
  }, [zone]);
  const playing = active && wanted;
  return (
    <li className="social-reel" ref={card}>
      <div className={`social-reel-media social-reel-media--${mode}`}>
        {mode === "link" && (
          <a
            className="social-reel-cover"
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            aria-hidden="true"
          >
            {post.poster ? (
              <LoadingImage src={post.poster} alt="" loading="lazy" />
            ) : (
              <span style={{ background: info.color, color: info.ink }}>
                <info.Icon size={44} />
              </span>
            )}
          </a>
        )}
        {mode === "video" ? (
          <VideoMedia
            src={post.video!}
            poster={post.poster}
            playing={playing}
            muted={!sound}
            title={title}
            onBlocked={() => setWanted(false)}
          />
        ) : !seen ? null : mode === "tiktok" ? (
          <TikTokMedia
            id={parsed.tiktokId!}
            playing={playing}
            muted={!sound}
            title={title}
          />
        ) : mode === "embed" ? (
          <EmbedMedia
            src={parsed.embed!}
            platform={parsed.platform === "facebook" ? "facebook" : "instagram"}
            away={zone === "away"}
            title={title}
          />
        ) : null}
        {/* Official players carry their own header; the chip moves below. */}
        {mode !== "embed" && chip}
        {controllable && (
          <div className="social-reel-controls">
            <button
              type="button"
              aria-label={t(playing ? "pauseVideo" : "playVideo")}
              onClick={() => {
                setWanted(!playing);
                if (!playing) setActive(true);
              }}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              type="button"
              aria-label={t(sound ? "soundOff" : "soundOn")}
              onClick={() => {
                onSound(!sound);
                if (!sound) {
                  setWanted(true);
                  setActive(true);
                }
              }}
            >
              {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        )}
      </div>
      <div className="social-reel-body">
        {mode === "embed" && chip}
        {post.caption && <p dir="auto">{post.caption}</p>}
        <a
          className="social-reel-link"
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("seePost")}
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

/** The restaurant's own photos, shown until the dashboard has posts. */
function PhotoCard({
  post,
  link,
  locale,
}: {
  post: (typeof socialPosts)[number];
  link: SiteLink;
  locale: Locale;
}) {
  const { t } = useTranslation();
  return (
    <li className="social-reel">
      <div className="social-reel-media social-reel-media--link">
        <a
          className="social-reel-cover"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          aria-hidden="true"
        >
          <LoadingImage
            src={post.image}
            alt=""
            loading="lazy"
            sizes="(max-width: 650px) 100vw, 290px"
          />
        </a>
        <Chip platform={link.platform} label={post.tag[locale]} />
      </div>
      <div className="social-reel-body">
        <p>{post.caption[locale]}</p>
        <a
          className="social-reel-link"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("viewOn", { platform: linkName(link) })}
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

/** Hand-drawn touches from the design: a stamp, leaves and gold strokes. */
function Doodles() {
  const leaf = (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M14 108C38 82 64 52 104 14" />
      <path d="M34 86c-14-2-24-12-24-26 14 0 24 10 24 26zM34 86c2-14 12-24 26-24 0 14-10 24-26 24z" />
      <path d="M58 60c-14-2-24-12-24-26 14 0 24 10 24 26zM58 60c2-14 12-24 26-24 0 14-10 24-26 24z" />
      <path d="M82 34c-12-2-20-10-20-22 12 0 20 8 20 22zM82 34c2-12 10-20 22-20 0 12-8 20-22 20z" />
    </svg>
  );
  return (
    <div className="social-doodles" aria-hidden="true">
      <span className="social-stamp" lang="ar" dir="rtl">
        شاورما
        <br />
        بروحنا
      </span>
      <span className="social-doodle social-doodle--leaf-top">{leaf}</span>
      <span className="social-doodle social-doodle--leaf-bottom">{leaf}</span>
      <svg className="social-doodle social-doodle--arc-start" viewBox="0 0 60 300">
        <path d="M50 4C8 80 8 220 50 296" />
      </svg>
      <svg className="social-doodle social-doodle--arc-end" viewBox="0 0 60 300">
        <path d="M10 4c42 76 42 216 0 292" />
      </svg>
    </div>
  );
}

/** "Follow us" band between the reviews and the locations. */
export function SocialSection({
  links,
  posts,
  locale,
  motion,
}: {
  links: SiteLink[];
  posts: SocialPost[];
  locale: Locale;
  motion: boolean;
}) {
  const { t } = useTranslation();
  const runway = useRef<HTMLDivElement>(null);
  const [soundId, setSoundId] = useState<string | null>(null);
  const socials = socialLinks(links);
  const shown = posts
    .map((post) => ({ post, parsed: parsePost(post.url) }))
    .filter(
      (entry): entry is { post: SocialPost; parsed: ParsedPost } =>
        !!entry.parsed,
    )
    .slice(0, SHOWN_POSTS);
  const count = shown.length || (socials.length ? socialPosts.length : 0);
  useReelRunway(runway, count, motion, locale === "ar");
  if (!count) return null;
  const names = [
    ...new Set(
      socials.length
        ? socials.map(linkName)
        : shown.map(({ parsed }) => platformOf(parsed.platform).name),
    ),
  ];
  const [primary, secondary] = socials;
  // Only one card plays sound at a time.
  const soundFor = (id: string) => (on: boolean) =>
    setSoundId((current) => (on ? id : current === id ? null : current));
  return (
    <section className="social-section" aria-labelledby="social-title">
      <Doodles />
      <div className="container social-inner">
        <header className="social-heading reveal">
          <h2 id="social-title">
            {t("socialTitle")} <span>{t("socialBrand")}</span>
            <svg className="social-spark" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M8 30l9-7M6 16l10 4M20 4l1 11" />
            </svg>
          </h2>
          <p>
            {t("socialDesc", {
              platforms: joinNames(names, t("and"), locale === "ar" ? "، " : ", "),
            })}
          </p>
        </header>
        {socials.length > 0 && (
          <div className="social-profiles reveal">
            {socials.map((link) => {
              const info = platformOf(link.platform);
              return (
                <a
                  key={link.id}
                  className="social-profile"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span
                    className="social-badge"
                    style={{ background: info.color, color: info.ink }}
                  >
                    <info.Icon size={22} />
                  </span>
                  <span className="social-profile-name">
                    <strong>{linkName(link)}</strong>
                    <bdi>{breakable(profileHandle(link))}</bdi>
                  </span>
                  <span className="social-follow">
                    {t("follow")}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </span>
                </a>
              );
            })}
          </div>
        )}
        <div
          className="social-runway"
          ref={runway}
          style={{ "--reel-count": count } as CSSProperties}
        >
          <div className="social-stage">
            <ul className="social-track" aria-label={t("socialPosts")}>
              {shown.length
                ? shown.map(({ post, parsed }, index) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      parsed={parsed}
                      number={index + 1}
                      motion={motion}
                      sound={soundId === post.id}
                      onSound={soundFor(post.id)}
                    />
                  ))
                : socialPosts.map((post) => (
                    <PhotoCard
                      key={post.id}
                      post={post}
                      link={
                        socials.find((link) => link.platform === post.platform) ??
                        socials[0]
                      }
                      locale={locale}
                    />
                  ))}
            </ul>
            <span className="social-progress" aria-hidden="true" />
          </div>
        </div>
        {primary && (
          <div className="social-cta">
            <a
              className="button button--primary social-cta-main"
              href={primary.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {(() => {
                const { Icon } = platformOf(primary.platform);
                return <Icon size={20} />;
              })()}
              {t("seeMoreOn", { platform: linkName(primary) })}
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            {secondary && (
              <a
                className="social-cta-alt"
                href={secondary.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("orFollowOn", { platform: linkName(secondary) })}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
