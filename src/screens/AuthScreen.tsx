import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark } from "../components/LogoMark";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { brand, colors, fonts, radius, space, type } from "../theme";

type Mode = "register" | "login";

export function AuthScreen() {
  const { startLocal, register, login } = useAuth();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("register");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await register({
          username: username.trim(),
          email: email.trim(),
          password,
        });
      } else {
        await login({ email: email.trim(), password });
      }
    } catch (e: any) {
      setError(e?.message || t("connectionError"));
    } finally {
      setBusy(false);
    }
  };

  const guest = async () => {
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
      style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 12 }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <LogoMark size={84} style={styles.logo} />
            <Text style={styles.brand}>{t("appName")}</Text>
            <Text style={styles.tagline}>{t("authTagline")}</Text>
          </View>

          <View style={styles.tabs}>
            <SoftPressable
              style={[styles.tab, mode === "register" && styles.tabActive]}
              onPress={() => setMode("register")}
            >
              <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>
                {t("createAccount")}
              </Text>
            </SoftPressable>
            <SoftPressable
              style={[styles.tab, mode === "login" && styles.tabActive]}
              onPress={() => setMode("login")}
            >
              <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>
                {t("signIn")}
              </Text>
            </SoftPressable>
          </View>

          <View style={styles.form}>
            {mode === "register" ? (
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("username")}
                placeholderTextColor={colors.textDim}
                value={username}
                onChangeText={setUsername}
              />
            ) : null}
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder={t("email")}
              placeholderTextColor={colors.textDim}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder={t("password")}
              placeholderTextColor={colors.textDim}
              value={password}
              onChangeText={setPassword}
            />

            <SoftPressable
              style={[styles.primaryBtn, busy && styles.disabled]}
              onPress={submit}
              disabled={busy}
            >
              <Text style={styles.primaryText}>
                {mode === "register" ? t("createAccount") : t("signIn")}
              </Text>
            </SoftPressable>

            <SoftPressable
              style={[styles.ghostBtn, busy && styles.disabled]}
              onPress={guest}
              disabled={busy}
            >
              <Text style={styles.ghostText}>{t("continueGuest")}</Text>
            </SoftPressable>

            {busy ? (
              <ActivityIndicator color={colors.mintDeep} style={{ marginTop: 14 }} />
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <Text style={styles.disclaimer}>{t("independentFan")}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.xxl },
  scroll: { flexGrow: 1, justifyContent: "space-between", paddingBottom: 8 },
  hero: { marginTop: 28 },
  logo: { marginBottom: space.lg },
  brand: {
    ...type.hero,
    fontSize: 38,
    lineHeight: 42,
    color: colors.text,
    marginBottom: space.sm,
  },
  tagline: {
    ...type.body,
    color: colors.textMuted,
    maxWidth: 320,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.checkbox,
    borderColor: colors.checkbox,
  },
  tabText: { fontFamily: fonts.semibold, color: colors.textMuted, fontSize: 13 },
  tabTextActive: { color: colors.white },
  form: { marginBottom: 16 },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  primaryBtn: {
    backgroundColor: colors.checkbox,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  ghostBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  ghostText: {
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    fontSize: 14,
  },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, marginTop: 12, fontFamily: fonts.semibold },
  disclaimer: {
    ...type.micro,
    color: colors.textDim,
    textAlign: "center",
    marginTop: 8,
  },
});
