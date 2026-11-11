/** Main checklist series (default visible). */
export const MAIN_FORMS = new Set([
  "blind_box_mini",
  "hippers",
  "hanging",
]);

/** Secondary / accessory series (Extras toggle). */
export const EXTRA_FORMS = new Set([
  "strap",
  "bath_ball",
  "keychain",
  "accessory",
  "light",
  "plush",
  "other",
]);

export type SeriesBucket = "main" | "extras";

export function seriesBucket(productForm: string | null | undefined): SeriesBucket {
  const form = (productForm || "blind_box_mini").toLowerCase();
  if (MAIN_FORMS.has(form)) return "main";
  return "extras";
}

export function isMainForm(productForm: string | null | undefined): boolean {
  return seriesBucket(productForm) === "main";
}

export function seriesCategoryLabel(productForm: string | null | undefined): string {
  const form = (productForm || "blind_box_mini").toLowerCase();
  switch (form) {
    case "blind_box_mini":
      return "Core Series";
    case "hippers":
      return "Hippers";
    case "hanging":
      return "Hanging";
    case "strap":
      return "Strap";
    case "bath_ball":
      return "Bath Ball";
    case "keychain":
      return "Keychain";
    case "accessory":
      return "Accessory";
    case "light":
      return "Light";
    case "plush":
      return "Plush";
    default:
      return "Extras";
  }
}

export function filterByBucket<T extends { product_form?: string | null }>(
  items: T[],
  bucket: SeriesBucket,
): T[] {
  return items.filter((item) => seriesBucket(item.product_form) === bucket);
}
