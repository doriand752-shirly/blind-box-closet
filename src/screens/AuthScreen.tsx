import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark } from "../components/LogoMark";
import { SoftPressable } from "../components/ui/SoftPressable";
import { appleAuthErrorMessage, useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { brand, colors, fonts, radius, space, type } from "../theme";

export function AuthScreen() {
  const {
    signInWithApple,
    signInWithEmail,
    registerWithEmail,
    signInDev,
    continueAsGuest,
  } = useAuth();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("register");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        setError(appleAuthErrorMessage(e, e?.message || t("connectionError")));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () =>
    run(async () => {
      const trimmed = email.trim();
      if (!trimmed || !password) {
        throw new Error(t("emailPasswordRequired"));
      }
      if (password.length < 8) {
        throw new Error(t("passwordTooShort"));
      }
      if (mode === "register") await registerWithEmail(trimmed, password);
      else await signInWithEmail(trimmed, password);
    });

  return (
    <LinearGradient
      colors={[colors.bg, brand.sageWash, colors.bgElevated]}
      locations={[0, 0.55, 1]}
      style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.hero}>
          <LogoMark size={96} style={styles.logo} />
          <Text style={styles.brand}>{t("appName")}</Text>
          <Text style={styles.tagline}>{t("authTagline")}</Text>
        </View>

        <View style={styles.actions}>
          <SoftPressable
            style={[styles.primaryBtn, busy && styles.disabled]}
            onPress={() => run(continueAsGuest)}
            disabled={busy}
          >
            <Text style={styles.primaryText}>{t("continueGuest")}</Text>
          </SoftPressable>

          <View style={styles.emailBlock}>
            <Text style={styles.emailHint}>{t("emailAuthHint")}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("emailPlaceholder")}
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              style={styles.input}
              editable={!busy}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("passwordPlaceholder")}
              placeholderTextColor={colors.textDim}
              secureTextEntry
              textContentType={mode === "register" ? "newPassword" : "password"}
              autoComplete={mode === "register" ? "password-new" : "password"}
              style={styles.input}
              editable={!busy}
            />
            <SoftPressable
              style={[styles.emailBtn, busy && styles.disabled]}
              onPress={submitEmail}
              disabled={busy}
            >
              <Text style={styles.emailBtnText}>
                {mode === "register" ? t("createAccount") : t("signInEmail")}
              </Text>
            </SoftPressable>
            <SoftPressable
              onPress={() => setMode((m) => (m === "register" ? "login" : "register"))}
              disabled={busy}
            >
              <Text style={styles.switchMode}>
                {mode === "register" ? t("haveAccount") : t("needAccount")}
              </Text>
            </SoftPressable>
          </View>

          {Platform.OS === "ios" ? (
            <View style={{ marginTop: space.md }}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={16}
                style={[styles.apple, busy && styles.disabled]}
                onPress={() => run(signInWithApple)}
              />
              <Text style={styles.optionalHint}>{t("appleOptional")}</Text>
            </View>
          ) : null}

          {__DEV__ ? (
            <SoftPressable
              style={[styles.devBtn, busy && styles.disabled]}
              onPress={() => run(signInDev)}
              disabled={busy}
            >
              <Text style={styles.devText}>{t("continueDev")}</Text>
            </SoftPressable>
          ) : null}

          {busy ? <ActivityIndicator color={colors.mintDeep} style={{ marginTop: 18 }} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Text style={styles.disclaimer}>{t("independentFan")}</Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.xxl, justifyContent: "space-between" },
  hero: { marginTop: 24 },
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
  actions: { marginBottom: 16 },
  primaryBtn: {
    backgroundColor: colors.checkbox,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  emailBlock: { marginTop: space.lg, gap: 10 },
  emailHint: {
    ...type.micro,
    color: colors.textMuted,
    marginBottom: 2,
  },
  input: {
    ...type.body,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
  },
  emailBtn: {
    backgroundColor: colors.mintDeep,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: "center",
  },
  emailBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  switchMode: {
    ...type.micro,
    color: colors.mintDeep,
    textAlign: "center",
    marginTop: 4,
    fontFamily: fonts.semibold,
  },
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
