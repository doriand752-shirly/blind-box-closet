import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import type { Dictionary, Locale, TranslationKey } from "./types";

export type { Locale, TranslationKey, Dictionary };

export const LOCALES: Locale[] = ["fr", "en", "es"];

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
};

const dictionaries: Record<Locale, Dictionary> = { fr, en, es };

export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  let text = dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}
