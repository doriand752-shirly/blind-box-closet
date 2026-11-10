import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/colors";

export function AuthScreen() {
  const { signInWithApple, signInDev, continueAsGuest } = useAuth();
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
    <LinearGradient colors={["#F6F1E8", "#E7F5EC", "#F6F1E8"]} style={styles.root}>
      <Text style={styles.brand}>Blind Box Closet</Text>
      <Text style={styles.tagline}>
        Track every Smiski — owned, duplicates, wishlist and trades.
      </Text>

      <Pressable style={styles.primaryBtn} onPress={() => run(continueAsGuest)} disabled={busy}>
        <Text style={styles.primaryText}>Continue without account</Text>
      </Pressable>

      {Platform.OS === "ios" ? (
        <View style={{ marginTop: 14 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={styles.apple}
            onPress={() => run(signInWithApple)}
          />
          <Text style={styles.optionalHint}>Optional — sync across devices</Text>
        </View>
      ) : null}

      {__DEV__ ? (
        <Pressable style={styles.devBtn} onPress={() => run(signInDev)} disabled={busy}>
          <Text style={styles.devText}>Continue (dev / admin)</Text>
        </Pressable>
      ) : null}

      {busy ? <ActivityIndicator color={colors.mintDeep} style={{ marginTop: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.disclaimer}>
        Independent collector app, not affiliated with Dreams Inc.
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 28 },
  brand: {
    fontSize: 40,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 12,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 36,
    maxWidth: 320,
  },
  primaryBtn: {
    backgroundColor: colors.checkbox,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  apple: { width: "100%", height: 48 },
  optionalHint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  devBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  devText: { color: colors.mintDeep, fontWeight: "600" },
  error: { color: colors.danger, marginTop: 14 },
  disclaimer: {
    position: "absolute",
    bottom: 40,
    left: 28,
    right: 28,
    color: colors.textDim,
    fontSize: 12,
    textAlign: "center",
  },
});
