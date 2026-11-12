import React from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { LogoMark } from "../components/LogoMark";
import { Screen } from "../components/ui/Screen";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useAuth } from "../context/AuthContext";
import { LOCALE_LABELS, LOCALES, type Locale } from "../i18n";
import { useLocale } from "../i18n/LocaleContext";
import { setOnboardingDone } from "../services/brandPrefs";
import {
  exportCollectionFile,
  importCollectionFile,
} from "../services/collectionTransfer";
import { PRIVACY_URL, SUPPORT_URL } from "../services/links";
import { colors, fonts, radius, space, type } from "../theme";

const APP_VERSION = Constants.expoConfig?.version ?? null;

function SettingsRow({
  label,
  onPress,
  danger,
  icon,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <SoftPressable style={styles.row} onPress={onPress} scaleTo={0.985}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.mintDeep} />
      </View>
      <Text style={[styles.rowText, danger && { color: colors.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
    </SoftPressable>
  );
}

export function SettingsScreen() {
  const { clearLocalData } = useAuth();
  const { t, setLocale } = useLocale();

  const pickLanguage = () => {
    Alert.alert(
      t("changeLanguage"),
      undefined,
      [
        ...LOCALES.map((code: Locale) => ({
          text: LOCALE_LABELS[code],
          onPress: () => {
            void setLocale(code);
          },
        })),
        { text: t("cancel"), style: "cancel" as const },
      ],
    );
  };

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t("settings")}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t("account")}</Text>
          <Text style={styles.value}>{t("guest")}</Text>
          <Text style={styles.meta}>{t("guestMeta")}</Text>
        </View>

        <View style={styles.group}>
          <SettingsRow
            label={t("changeLanguage")}
            icon="language-outline"
            onPress={pickLanguage}
          />

          <SettingsRow
            label={t("redoBrands")}
            icon="heart-outline"
            onPress={() => {
              Alert.alert(t("redoBrands"), t("redoBrandsBody"), [
                { text: t("cancel"), style: "cancel" },
                {
                  text: t("ok"),
                  onPress: () =>
                    setOnboardingDone(false).then(() =>
                      Alert.alert(t("ok"), t("redoBrandsDone")),
                    ),
                },
              ]);
            }}
          />

          <SettingsRow
            label={t("exportCollection")}
            icon="share-outline"
            onPress={() =>
              exportCollectionFile()
                .then(() => Alert.alert(t("ok"), t("exportOk")))
                .catch((e) => Alert.alert(t("connectionError"), e?.message || t("importFail")))
            }
          />

          <SettingsRow
            label={t("importCollection")}
            icon="download-outline"
            onPress={() =>
              importCollectionFile()
                .then((r) => {
                  if (r.count > 0) Alert.alert(t("ok"), t("importOk", { count: r.count }));
                })
                .catch((e) => Alert.alert(t("importFail"), e?.message || t("importFail")))
            }
          />

          <SettingsRow
            label={t("privacyPolicy")}
            icon="shield-checkmark-outline"
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />

          <SettingsRow
            label={t("support")}
            icon="help-buoy-outline"
            onPress={() => Linking.openURL(SUPPORT_URL)}
          />
        </View>

        <View style={[styles.group, { marginTop: space.lg }]}>
          <SettingsRow
            danger
            icon="trash-outline"
            label={t("clearLocalData")}
            onPress={() =>
              Alert.alert(t("clearLocalData"), t("clearLocalDataConfirm"), [
                { text: t("cancel"), style: "cancel" },
                {
                  text: t("clearLocalData"),
                  style: "destructive",
                  onPress: async () => {
                    await AsyncStorage.removeItem("bbc_local_collection");
                    await clearLocalData();
                  },
                },
              ])
            }
          />
        </View>

        <View style={styles.about}>
          <LogoMark size={44} />
          <View style={styles.aboutText}>
            <Text style={styles.aboutName}>{t("appName")}</Text>
            {APP_VERSION ? <Text style={styles.aboutVersion}>v{APP_VERSION}</Text> : null}
          </View>
        </View>
        <Text style={styles.disclaimer}>{t("independentFan")}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48, paddingTop: space.sm },
  title: { ...type.hero, fontSize: 34, color: colors.text, marginBottom: space.xl },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.xl,
  },
  label: { ...type.micro, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },
  value: { ...type.subtitle, color: colors.text, marginTop: 6 },
  meta: { ...type.caption, color: colors.textDim, marginTop: 4 },
  group: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.mintWash,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: "rgba(217,96,96,0.12)" },
  rowText: { flex: 1, ...type.bodyStrong, color: colors.text },
  about: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: space.xxl,
  },
  aboutText: { flex: 1 },
  aboutName: { ...type.bodyStrong, color: colors.text },
  aboutVersion: { ...type.caption, color: colors.textDim },
  disclaimer: {
    ...type.micro,
    color: colors.textDim,
    marginTop: space.md,
    lineHeight: 18,
  },
});
