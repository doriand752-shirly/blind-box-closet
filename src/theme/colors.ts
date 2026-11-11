/**
 * Brand palette, taken from the logo: five hexagonal blind boxes on two oak
 * shelves against a cream wall. Each colour has a `deep` variant dark enough
 * for text and icons, and a `wash` for large backgrounds.
 */
export const brand = {
  wall: "#F4E8D8",
  oak: "#E7C8A5",
  oakDeep: "#B98A55",
  ink: "#3A2A1F",

  sage: "#B5BE9F",
  sageDeep: "#5F6B45",
  sageWash: "#EEF1E4",

  blush: "#F4D4CA",
  blushDeep: "#A3604F",
  blushWash: "#FBEEEA",

  butter: "#F3DCA9",
  butterDeep: "#8C6A1E",
  butterWash: "#FBF3DF",

  sky: "#B5CCDE",
  skyDeep: "#4A6C86",
  skyWash: "#E8F0F6",

  lavender: "#D7C5D8",
  lavenderDeep: "#735B79",
  lavenderWash: "#F3ECF4",
} as const;

export const colors = {
  bg: "#F7F3EC",
  bgElevated: "#FBF8F2",
  bgCard: "#FFFFFF",
  text: brand.ink,
  textMuted: "#7A6A5C",
  textDim: "#A39486",
  border: "rgba(58, 42, 31, 0.08)",
  borderStrong: "rgba(58, 42, 31, 0.14)",

  // Sage is the product's main accent (the "mint" names predate the logo).
  mint: "#8FA070",
  mintSoft: "#DDE3CD",
  mintDeep: brand.sageDeep,
  mintWash: brand.sageWash,
  smiskiCard: "#DDE3CD",
  smiskiBar: "#8FA070",
  smiskiBarTrack: "#E9EDDD",
  figureTile: "#F3EEE6",

  accent: brand.ink,
  accentSoft: "#E8DFD4",
  continueDisabled: "#D9D0C6",
  progressTrack: "#E8DFD4",
  progressActive: "#7D8F5E",

  glow: "#8FA070",
  glowDim: "rgba(143, 160, 112, 0.22)",
  owned: brand.sageDeep,
  missing: "#E8E2D8",
  wishlist: "#6C93B3",
  wishlistSoft: brand.skyWash,
  trade: "#C08A52",
  tradeSoft: "#F8EBDD",
  danger: "#D96060",
  warning: "#E0B14A",
  secret: "#C49A2E",
  checkbox: "#3A2A1F",
  sheet: "#FBF8F2",
  tabActive: "#FFFFFF",
  tabInactive: "transparent",
  overlay: "rgba(40, 28, 20, 0.36)",
  white: "#FFFFFF",
};

export type BrandTheme = {
  slug: string;
  label: string;
  card: string;
  cardEnd: string;
  accent: string;
  bar: string;
  status: "live" | "coming_soon";
};

// One box colour per collection, like the boxes on the logo's shelves.
export const brandThemes: Record<string, BrandTheme> = {
  smiski: {
    slug: "smiski",
    label: "Smiskis",
    card: "#D5DDC2",
    cardEnd: "#E9EDDD",
    accent: brand.sageDeep,
    bar: "#7D8F5E",
    status: "live",
  },
  "sonny-angel": {
    slug: "sonny-angel",
    label: "Sonny Angels",
    card: brand.blush,
    cardEnd: "#FAE7E1",
    accent: brand.blushDeep,
    bar: "#CF8C7A",
    status: "live",
  },
  labubu: {
    slug: "labubu",
    label: "Labubus",
    card: brand.lavender,
    cardEnd: "#EDE2EE",
    accent: brand.lavenderDeep,
    bar: "#A286A8",
    status: "live",
  },
  chiikawa: {
    slug: "chiikawa",
    label: "Chiikawa",
    card: "#C9DAE8",
    cardEnd: "#E3EDF4",
    accent: brand.skyDeep,
    bar: "#7FA3BF",
    status: "coming_soon",
  },
  hirono: {
    slug: "hirono",
    label: "Hironos",
    card: brand.butter,
    cardEnd: "#FAEFD0",
    accent: brand.butterDeep,
    bar: "#CFA748",
    status: "coming_soon",
  },
  skullpanda: {
    slug: "skullpanda",
    label: "Skull Pandas",
    card: brand.oak,
    cardEnd: "#F3E2CC",
    accent: "#8A6135",
    bar: brand.oakDeep,
    status: "coming_soon",
  },
};

export function getBrandTheme(slug: string): BrandTheme {
  return (
    brandThemes[slug] || {
      slug,
      label: slug,
      card: "#EDE6DC",
      cardEnd: "#F7F3EC",
      accent: colors.text,
      bar: colors.progressActive,
      status: "coming_soon",
    }
  );
}
