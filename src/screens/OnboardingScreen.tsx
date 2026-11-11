import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BrandSelectCard } from "../components/BrandSelectCard";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useLocale } from "../i18n/LocaleContext";
import { api } from "../services/api";
import {
  COMING_SOON_SLUGS,
  LIVE_BRAND_SLUGS,
  setFavoriteBrands,
  setOnboardingDone,
} from "../services/brandPrefs";
import { colors, fonts, space, type } from "../theme";
import type { Brand } from "../types/models";

type Props = {
  onDone: () => void;
};

const PICKABLE = new Set<string>(LIVE_BRAND_SLUGS);

export function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selected, setSelected] = useState<string[]>(["smiski"]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.brands();
        const map = new Map(res.brands.map((b) => [b.slug, b]));
        const ordered: Brand[] = [];
        for (const slug of [...LIVE_BRAND_SLUGS, ...COMING_SOON_SLUGS]) {
          const b = map.get(slug);
          if (b) ordered.push(b);
          else {
            ordered.push({
              id: slug,
              slug,
              name: slug,
              name_ja: null,
              logo_url: null,
              status: PICKABLE.has(slug) ? "live" : "coming_soon",
            });
          }
        }
        setBrands(ordered);
      } catch {
        setBrands(
          [...LIVE_BRAND_SLUGS, ...COMING_SOON_SLUGS].map((slug) => ({
            id: slug,
            slug,
            name: slug,
            name_ja: null,
            logo_url: null,
            status: PICKABLE.has(slug) ? "live" : "coming_soon",
          })),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = useCallback((slug: string) => {
    if (!PICKABLE.has(slug)) return;
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  const finish = async () => {
    if (!selected.length) return;
    await setFavoriteBrands(selected);
    await setOnboardingDone(true);
    onDone();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Text style={styles.kicker}>{t("appNameUpper")}</Text>
      <Text style={styles.headline}>{t("onboardingHeadline1")}</Text>
      <Text style={styles.prompt}>{t("onboardingPrompt")}</Text>

      {loading ? (
        <ActivityIndicator color={colors.progressActive} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {brands.map((b) => (
            <BrandSelectCard
              key={b.slug}
              slug={b.slug}
              coverUrl={b.hero_image_url}
              selected={selected.includes(b.slug)}
              disabled={!PICKABLE.has(b.slug)}
              comingSoonLabel={t("comingSoon")}
              onPress={() => toggle(b.slug)}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Text style={styles.count}>
          {t("collectionsSelected", { count: selected.length })}
        </Text>
        <SoftPressable
          style={[styles.continue, !selected.length && styles.continueOff]}
          disabled={!selected.length}
          onPress={finish}
        >
          <Text style={styles.continueText}>{t("startCollecting")}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </SoftPressable>
        <Text style={styles.hint}>{t("pickAtLeastOne")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.xl,
  },
  kicker: {
    ...type.micro,
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginBottom: space.md,
  },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: space.lg,
  },
  prompt: {
    ...type.bodyStrong,
    color: colors.text,
    marginBottom: space.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom: 24,
  },
  footer: { paddingTop: space.md },
  count: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: space.sm,
  },
  continue: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueOff: { backgroundColor: colors.continueDisabled },
  continueText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
  },
  hint: {
    ...type.micro,
    color: colors.textDim,
    textAlign: "center",
    marginTop: space.sm,
  },
});
