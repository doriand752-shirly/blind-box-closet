import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITES_KEY = "bbc_favorite_brands";
const ONBOARDING_KEY = "bbc_onboarding_done";

export const LIVE_BRAND_SLUGS = ["smiski", "sonny-angel", "labubu"] as const;
export const COMING_SOON_SLUGS = ["chiikawa", "hirono", "skullpanda"] as const;

export async function getFavoriteBrands(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return ["smiski"];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.filter((s) => typeof s === "string");
    }
  } catch {
    /* ignore */
  }
  return ["smiski"];
}

export async function setFavoriteBrands(slugs: string[]): Promise<void> {
  const unique = [...new Set(slugs.filter(Boolean))];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(unique.length ? unique : ["smiski"]));
}

export async function isOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "1";
}

export async function setOnboardingDone(done = true): Promise<void> {
  if (done) await AsyncStorage.setItem(ONBOARDING_KEY, "1");
  else await AsyncStorage.removeItem(ONBOARDING_KEY);
}

export function sortBrandsByFavorites<T extends { slug: string }>(
  brands: T[],
  favorites: string[],
): T[] {
  const favIndex = new Map(favorites.map((s, i) => [s, i]));
  return [...brands].sort((a, b) => {
    const ai = favIndex.has(a.slug) ? favIndex.get(a.slug)! : 999;
    const bi = favIndex.has(b.slug) ? favIndex.get(b.slug)! : 999;
    if (ai !== bi) return ai - bi;
    return a.slug.localeCompare(b.slug);
  });
}
