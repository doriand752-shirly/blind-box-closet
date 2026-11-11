import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  const [step, setStep] = useState(0);
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

  const canContinue = selected.length > 0;

  const finish = async () => {
    await setFavoriteBrands(selected);
    await setOnboardingDone(true);
    onDone();
  };

  const skip = async () => {
    await setFavoriteBrands(selected.length ? selected : ["smiski"]);
    await setOnboardingDone(true);
    onDone();
  };

  const progress = useMemo(() => [0, 1, 2].map((i) => i <= step), [step]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.top}>
        <Text style={styles.kicker}>{t("appNameUpper")}</Text>
        <SoftPressable onPress={skip} hitSlop={8}>
          <Text style={styles.skip}>{t("skip")}</Text>
        </SoftPressable>
      </View>

      <View style={styles.progressRow}>
        {progress.map((on, i) => (
          <View key={i} style={[styles.seg, on && styles.segOn]} />
        ))}
      </View>

      {step === 0 ? (
        <>
          <Text style={styles.headline}>{t("onboardingHeadline1")}</Text>
          <Text style={styles.prompt}>{t("onboardingPrompt")}</Text>
          {loading ? (
            <ActivityIndicator color={colors.progressActive} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            >
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
        </>
      ) : null}

      {step === 1 ? (
        <View style={styles.mid}>
          <Text style={styles.headline}>{t("onboardingHeadline2")}</Text>
          <Text style={styles.body}>{t("onboardingBody2")}</Text>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.mid}>
          <Text style={styles.headline}>{t("onboardingHeadline3")}</Text>
          <Text style={styles.body}>{t("onboardingBody3")}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.count}>
          {t("collectionsSelected", { count: selected.length })}
        </Text>
        <View style={styles.footerRow}>
          {step > 0 ? (
            <SoftPressable style={styles.backCircle} onPress={() => setStep((s) => s - 1)}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </SoftPressable>
          ) : (
            <View style={{ width: 48 }} />
          )}
          <SoftPressable
            style={[styles.continue, !canContinue && styles.continueOff]}
            disabled={!canContinue}
            onPress={() => {
              if (step < 2) setStep((s) => s + 1);
              else finish();
            }}
          >
            <Text style={styles.continueText}>
              {step < 2 ? t("continue") : t("startCollecting")}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </SoftPressable>
        </View>
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
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: {
    ...type.micro,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  skip: { ...type.caption, color: colors.textMuted },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: space.md,
    marginBottom: space.xl,
  },
  seg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.progressTrack,
  },
  segOn: { backgroundColor: colors.progressActive },
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
  mid: { flex: 1, paddingTop: space.md },
  body: { ...type.body, color: colors.textMuted, marginBottom: space.xl },
  footer: { paddingTop: space.md },
  count: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: space.sm,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  backCircle: {
    width: 48,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  continue: {
    flex: 1,
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
