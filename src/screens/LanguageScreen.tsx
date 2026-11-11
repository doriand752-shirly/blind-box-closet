import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LogoMark } from "../components/LogoMark";
import { SoftPressable } from "../components/ui/SoftPressable";
import { LOCALE_LABELS, LOCALES, type Locale } from "../i18n";
import { useLocale } from "../i18n/LocaleContext";
import { brand, colors, fonts, radius, space, type } from "../theme";

export function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const { setLocale, t } = useLocale();
  const [picked, setPicked] = useState<Locale>("fr");

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <LogoMark size={76} style={styles.logo} />
      <Text style={styles.kicker}>{t("appNameUpper")}</Text>
      <Text style={styles.title}>{t("languageTitle")}</Text>
      <Text style={styles.subtitle}>{t("languageSubtitle")}</Text>

      <View style={styles.list}>
        {LOCALES.map((code) => {
          const on = picked === code;
          return (
            <SoftPressable
              key={code}
              style={[styles.row, on && styles.rowOn]}
              onPress={() => setPicked(code)}
              scaleTo={0.98}
            >
              <Text style={styles.rowLabel}>{LOCALE_LABELS[code]}</Text>
              <View style={[styles.radio, on && styles.radioOn]}>
                {on ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
            </SoftPressable>
          );
        })}
      </View>

      <SoftPressable style={styles.cta} onPress={() => setLocale(picked)}>
        <Text style={styles.ctaText}>{t("languageContinue")}</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.white} />
      </SoftPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.xl,
  },
  logo: { marginBottom: space.xl },
  kicker: {
    ...type.micro,
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginBottom: space.md,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    marginTop: space.sm,
    marginBottom: space.xxl,
  },
  list: { gap: space.md, flex: 1 },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowOn: {
    borderColor: colors.progressActive,
    backgroundColor: brand.sageWash,
  },
  rowLabel: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: {
    backgroundColor: colors.progressActive,
    borderColor: colors.progressActive,
  },
  cta: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
  },
});
