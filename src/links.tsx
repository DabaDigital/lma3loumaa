import type { ReactNode } from "react";
import { Bike, ShoppingBag } from "lucide-react";
import { glovoUrl } from "./data";
import type { Locale } from "./data";
import type { LinkId, Links } from "./content";

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
function Instagram({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </Glyph>
  );
}
function Facebook({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Glyph>
  );
}

export const platforms: Record<
  LinkId,
  {
    name: string;
    kind: "social" | "order";
    placeholder: string;
    Icon: (props: { size?: number }) => ReactNode;
  }
> = {
  instagram: {
    name: "Instagram",
    kind: "social",
    placeholder: "https://www.instagram.com/…",
    Icon: Instagram,
  },
  facebook: {
    name: "Facebook",
    kind: "social",
    placeholder: "https://www.facebook.com/…",
    Icon: Facebook,
  },
  glovo: {
    name: "Glovo",
    kind: "order",
    placeholder: "https://glovoapp.com/…",
    Icon: ShoppingBag,
  },
  klit: {
    name: "Klit",
    kind: "order",
    placeholder: "https://app.klit.ma/restaurants/…",
    Icon: Bike,
  },
};

// Every "Order on Glovo" button needs a destination, even without a database.
export const orderUrl = (links: Links, locale: Locale) =>
  links.glovo ?? glovoUrl(locale);
