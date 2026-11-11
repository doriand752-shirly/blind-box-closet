import React from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/ui/Screen";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../services/api";
import { colors, fonts, radius, space, type } from "../theme";

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
  const { user, isGuest, signOut, deleteAccount, continueAsGuest, signInWithApple } = useAuth();
  const navigation = useNavigation<any>();

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Réglages</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Compte</Text>
          <Text style={styles.value}>
            {isGuest ? "Mode local" : user?.display_name || "Collector"}
          </Text>
          <Text style={styles.meta}>
            {isGuest
              ? "Collection stockée sur cet appareil"
              : user?.email || user?.apple_sub}
          </Text>
          {user?.is_admin ? <Text style={styles.admin}>Admin</Text> : null}
        </View>

        <View style={styles.group}>
          {user?.is_admin ? (
            <SettingsRow
              label="Interface admin"
              icon="construct-outline"
              onPress={() => navigation.navigate("Admin")}
            />
          ) : null}

          {isGuest ? (
            <SettingsRow
              label="Se connecter avec Apple"
              icon="logo-apple"
              onPress={() =>
                signInWithApple().catch((e) => {
                  if (e?.code !== "ERR_REQUEST_CANCELED") {
                    Alert.alert("Connexion", e?.message || "Impossible de se connecter");
                  }
                })
              }
            />
          ) : null}

          <SettingsRow
            label="Politique de confidentialité"
            icon="shield-checkmark-outline"
            onPress={() =>
              Linking.openURL("https://appigeek.github.io/blind-box-closet/privacy.html")
            }
          />

          <SettingsRow
            label="Statut API"
            icon="pulse-outline"
            onPress={() => Linking.openURL(API_URL + "/health")}
          />

          <SettingsRow
            label={isGuest ? "Quitter le mode local" : "Se déconnecter"}
            icon="log-out-outline"
            onPress={() => signOut()}
          />
        </View>

        <View style={[styles.group, { marginTop: space.lg }]}>
          <SettingsRow
            danger
            icon="trash-outline"
            label={isGuest ? "Effacer ma collection locale" : "Supprimer mon compte"}
            onPress={() =>
              Alert.alert(
                isGuest ? "Effacer la collection locale ?" : "Supprimer le compte ?",
                isGuest
                  ? "Tes figurines marquées sur cet appareil seront perdues."
                  : "Ta collection sera effacée.",
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: async () => {
                      if (isGuest) {
                        await AsyncStorage.removeItem("bbc_local_collection");
                        await continueAsGuest();
                      } else {
                        await deleteAccount();
                      }
                    },
                  },
                ],
              )
            }
          />
        </View>

        <Text style={styles.disclaimer}>
          Blind Box Closet est une app collector indépendante, non affiliée à Dreams Inc. / Smiski.
        </Text>
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
  admin: { color: colors.mintDeep, marginTop: 10, fontFamily: fonts.bold },
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
  disclaimer: {
    ...type.micro,
    color: colors.textDim,
    marginTop: space.xxl,
    lineHeight: 18,
  },
});
