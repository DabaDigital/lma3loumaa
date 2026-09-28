import { Fragment } from "react";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "./components";
import type { Links } from "./content";
import { socialPosts } from "./data";
import type { Locale } from "./data";
import { LoadingImage } from "./LoadingImage";
import { platforms, profileHandle } from "./links";
import "./socialSection.css";

const socialIds = ["instagram", "facebook"] as const;
// Lets a long handle such as "shawarma.lma3louma" wrap after its dot rather
// than mid-word on a narrow phone.
const breakable = (handle: string) =>
  handle.split(/(?<=[._])/).map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));

/** "Follow us" band between the reviews and the locations. */
export function SocialSection({
  links,
  locale,
}: {
  links: Links;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const socials = socialIds.filter((id) => links[id]);
  if (!socials.length) return null;
  // Joined by hand: Arabic list formatting glues "و" to the Latin names.
  const names = socials
    .map((id) => platforms[id].name)
    .join(` ${t("and")} `);
  return (
    <section className="social-section" aria-labelledby="social-title">
      <div className="container social-inner reveal">
        <header className="social-heading">
          <h2 id="social-title">
            {t("socialTitle")} <span>{t("socialBrand")}</span>
          </h2>
          <p>{t("socialDesc", { platforms: names })}</p>
        </header>
        <div className="social-profiles">
          {socials.map((id) => {
            const { name, Icon } = platforms[id];
            const url = links[id]!;
            return (
              <a
                key={id}
                className="social-profile"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={`social-badge social-badge--${id}`}>
                  <Icon size={22} />
                </span>
                <span className="social-profile-name">
                  <strong>{name}</strong>
                  <bdi>{breakable(profileHandle(id, url))}</bdi>
                </span>
                <span className="social-follow">
                  {t("follow")}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </span>
              </a>
            );
          })}
        </div>
        <ul className="social-posts" aria-label={t("socialPosts")}>
          {socialPosts.map((post) => {
            // A post shown for an unconfigured platform moves to one that is.
            const id = links[post.platform] ? post.platform : socials[0];
            const { name, Icon } = platforms[id];
            const url = links[id]!;
            return (
              <li className="social-post" key={post.id}>
                <div className="social-post-top">
                  <span className={`social-badge social-badge--${id}`}>
                    <Icon size={14} />
                  </span>
                  <bdi>{profileHandle(id, url)}</bdi>
                </div>
                <div className="social-post-photo">
                  <LoadingImage
                    src={post.image}
                    alt=""
                    loading="lazy"
                    sizes="(max-width: 850px) 50vw, 290px"
                  />
                  <span className="social-post-tag">{post.tag[locale]}</span>
                </div>
                <p>{post.caption[locale]}</p>
                {/* Stretched over the whole card, so the card is one link. */}
                <a
                  className="social-post-link"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("viewOn", { platform: name })}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
        <div className="social-more">
          {socials.map((id) => (
            <ExternalLink key={id} href={links[id]!}>
              {t("seeMore", { platform: platforms[id].name })}
            </ExternalLink>
          ))}
        </div>
      </div>
    </section>
  );
}
