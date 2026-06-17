import Image from "next/image";

import { cn } from "@/lib/utils";

// Firm brand marks. Fixed PNG assets in `public/` (not DB-driven). Two variants:
//   - `mark`        → the MQ monogram alone (tight spots: auth hero, collapsed rails)
//   - `horizontal`  → logo + "MAQUIN / Engineering Services" lockup (side nav, login)
// Light/dark assets swap by CSS (`dark:` off the `.dark` class on <html>) — no
// `useTheme()`, so there's no hydration flash. Pass `theme` to force a single asset
// in fixed-background contexts (e.g. the always-dark auth panel).
//
// The light/dark toggle classes live on the <Image> elements (NOT merged with the
// caller's className), so a caller passing a `display` utility like `flex` can't
// collide with `block`/`hidden` via tailwind-merge and reveal both images. The
// caller's className sizes the WRAPPER — pass a height (e.g. `h-8`); the images
// fill it (`h-full w-auto`).

type BrandVariant = "mark" | "horizontal";

const ASSETS: Record<
  BrandVariant,
  {
    light: { src: string; w: number; h: number };
    dark: { src: string; w: number; h: number };
    alt: string;
  }
> = {
  mark: {
    light: { src: "/light_logo.png", w: 444, h: 683 },
    dark: { src: "/dark_logo.png", w: 274, h: 422 },
    alt: "MAQUIN",
  },
  horizontal: {
    light: { src: "/light_horizontal.png", w: 1636, h: 400 },
    dark: { src: "/dark_horizontal.png", w: 1654, h: 400 },
    alt: "MAQUIN Engineering Services",
  },
};

export function Brand({
  variant = "mark",
  theme,
  priority = false,
  className,
}: {
  variant?: BrandVariant;
  /** Force a single asset (fixed-background contexts). Omit to swap with the app theme. */
  theme?: "light" | "dark";
  priority?: boolean;
  className?: string;
}) {
  const asset = ASSETS[variant];

  if (theme) {
    const a = asset[theme];
    return (
      <span className={cn("inline-flex", className)}>
        <Image
          src={a.src}
          alt={asset.alt}
          width={a.w}
          height={a.h}
          priority={priority}
          className="h-full w-auto"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex", className)}>
      <Image
        src={asset.light.src}
        alt={asset.alt}
        width={asset.light.w}
        height={asset.light.h}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src={asset.dark.src}
        alt={asset.alt}
        width={asset.dark.w}
        height={asset.dark.h}
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
