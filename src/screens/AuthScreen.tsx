import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark } from "../components/LogoMark";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { brand, colors, fonts, radius, space, type } from "../theme";

export function AuthScreen() {
  const { startLocal } = useAuth();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await startLocal();
    } catch (e: any) {
      setError(e?.message || t("connectionError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.bg, brand.sageWash, colors.bgElevated]}
      locations={[0, 0.55, 1]}
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}
    >
      <View style={styles.hero}>
        <LogoMark size={96} style={styles.logo} />
        <Text style={styles.brand}>{t("appName")}</Text>
        <Text style={styles.tagline}>{t("authTagline")}</Text>
        <Text style={styles.localHint}>{t("localOnlyHint")}</Text>
      </View>

      <View style={styles.actions}>
        <SoftPressable
          style={[styles.primaryBtn, busy && styles.disabled]}
          onPress={start}
          disabled={busy}
        >
          <Text style={styles.primaryText}>{t("startCollecting")}</Text>
        </SoftPressable>

        {busy ? <ActivityIndicator color={colors.mintDeep} style={{ marginTop: 18 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.disclaimer}>{t("independentFan")}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.xxl, justifyContent: "space-between" },
  hero: { marginTop: 40 },
  logo: { marginBottom: space.xl },
  brand: {
    ...type.hero,
    fontSize: 42,
    lineHeight: 46,
    color: colors.text,
    marginBottom: space.md,
  },
  tagline: {
    ...type.body,
    color: colors.textMuted,
    maxWidth: 320,
  },
  localHint: {
    ...type.caption,
    color: colors.textDim,
    marginTop: space.md,
    maxWidth: 320,
  },
  actions: { marginBottom: 24 },
  primaryBtn: {
    backgroundColor: colors.checkbox,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, marginTop: 14, fontFamily: fonts.semibold },
  disclaimer: {
    ...type.micro,
    color: colors.textDim,
    textAlign: "center",
  },
});
