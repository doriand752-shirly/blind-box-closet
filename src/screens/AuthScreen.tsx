import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useAuth } from "../context/AuthContext";
import { colors, fonts, radius, space, type } from "../theme";

export function AuthScreen() {
  const { signInWithApple, signInDev, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        setError(e?.message || "Connexion impossible");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={["#F7F3EC", "#E8F0D8", "#FBF8F2"]}
      locations={[0, 0.55, 1]}
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}
    >
      <View style={styles.hero}>
        <Text style={styles.brand}>Blind Box Closet</Text>
        <Text style={styles.tagline}>
          Suis Smiski, Sonny Angel, Labubu et plus — Main, Extras, wishlist et échanges.
        </Text>
      </View>

      <View style={styles.actions}>
        <SoftPressable
          style={[styles.primaryBtn, busy && styles.disabled]}
          onPress={() => run(continueAsGuest)}
          disabled={busy}
        >
          <Text style={styles.primaryText}>Continuer sans compte</Text>
        </SoftPressable>

        {Platform.OS === "ios" ? (
          <View style={{ marginTop: space.md }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={16}
              style={[styles.apple, busy && styles.disabled]}
              onPress={() => run(signInWithApple)}
            />
            <Text style={styles.optionalHint}>Optionnel — sync multi-appareils</Text>
          </View>
        ) : null}

        {__DEV__ ? (
          <SoftPressable
            style={[styles.devBtn, busy && styles.disabled]}
            onPress={() => run(signInDev)}
            disabled={busy}
          >
            <Text style={styles.devText}>Continuer (dev / admin)</Text>
          </SoftPressable>
        ) : null}

        {busy ? <ActivityIndicator color={colors.mintDeep} style={{ marginTop: 18 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.disclaimer}>
        App collector indépendante, non affiliée à Dreams Inc.
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.xxl, justifyContent: "space-between" },
  hero: { marginTop: 48 },
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
  actions: { marginBottom: 24 },
  primaryBtn: {
    backgroundColor: colors.checkbox,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  apple: { width: "100%", height: 52 },
  optionalHint: {
    ...type.micro,
    color: colors.textDim,
    textAlign: "center",
    marginTop: 8,
  },
  devBtn: {
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  devText: { color: colors.mintDeep, fontFamily: fonts.semibold },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, marginTop: 14, fontFamily: fonts.semibold },
  disclaimer: {
    ...type.micro,
    color: colors.textDim,
    textAlign: "center",
  },
});
