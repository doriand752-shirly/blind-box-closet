export const colors = {
  bg: "#F7F3EC",
  bgElevated: "#FBF8F2",
  bgCard: "#FFFFFF",
  text: "#3A2A1F",
  textMuted: "#7A6A5C",
  textDim: "#A39486",
  border: "rgba(58, 42, 31, 0.08)",
  borderStrong: "rgba(58, 42, 31, 0.14)",

  mint: "#6FCB9A",
  mintSoft: "#D8F3E4",
  mintDeep: "#246B4A",
  mintWash: "#EAF7F0",
  smiskiCard: "#D6F0DF",
  smiskiBar: "#6FCB9A",
  smiskiBarTrack: "#E6F6EC",
  figureTile: "#F3EEE6",

  accent: "#3A2A1F",
  accentSoft: "#E8DFD4",
  continueDisabled: "#D9D0C6",
  progressTrack: "#E8DFD4",
  progressActive: "#7A9B5A",

  glow: "#6FCB9A",
  glowDim: "rgba(111, 203, 154, 0.22)",
  owned: "#246B4A",
  missing: "#E8E2D8",
  wishlist: "#6FA8FF",
  wishlistSoft: "#E8F1FF",
  trade: "#E09A62",
  tradeSoft: "#FFF0E4",
  danger: "#D96060",
  warning: "#E0B14A",
  secret: "#C9A227",
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

export const brandThemes: Record<string, BrandTheme> = {
  smiski: {
    slug: "smiski",
    label: "Smiskis",
    card: "#D8F0C8",
    cardEnd: "#EAF6DE",
    accent: "#3F6B3A",
    bar: "#7A9B5A",
    status: "live",
  },
  "sonny-angel": {
    slug: "sonny-angel",
    label: "Sonny Angels",
    card: "#F6D5DE",
    cardEnd: "#FBE8ED",
    accent: "#A85A72",
    bar: "#D48AA0",
    status: "live",
  },
  labubu: {
    slug: "labubu",
    label: "Labubus",
    card: "#E4D8F2",
    cardEnd: "#F1EAF8",
    accent: "#6B4F8A",
    bar: "#A48BC4",
    status: "live",
  },
  chiikawa: {
    slug: "chiikawa",
    label: "Chiikawa",
    card: "#D5E8F6",
    cardEnd: "#EAF4FB",
    accent: "#4A7394",
    bar: "#7AA8C4",
    status: "coming_soon",
  },
  hirono: {
    slug: "hirono",
    label: "Hironos",
    card: "#D5EDEB",
    cardEnd: "#EAF6F5",
    accent: "#3F7A74",
    bar: "#6AAAA4",
    status: "coming_soon",
  },
  skullpanda: {
    slug: "skullpanda",
    label: "Skull Pandas",
    card: "#E2D8F0",
    cardEnd: "#F0EAF7",
    accent: "#6A5588",
    bar: "#9B86B8",
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
