import React from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../services/api";
import { colors } from "../theme/colors";

export function SettingsScreen() {
  const { user, isGuest, signOut, deleteAccount, continueAsGuest, signInWithApple } =
    useAuth();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.root}>
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

      {user?.is_admin ? (
        <Pressable style={styles.row} onPress={() => navigation.navigate("Admin")}>
          <Text style={styles.rowText}>Interface admin</Text>
        </Pressable>
      ) : null}

      {isGuest ? (
        <Pressable
          style={styles.row}
          onPress={() =>
            signInWithApple().catch((e) => {
              if (e?.code !== "ERR_REQUEST_CANCELED") {
                Alert.alert("Connexion", e?.message || "Impossible de se connecter");
              }
            })
          }
        >
          <Text style={styles.rowText}>Se connecter avec Apple (optionnel)</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.row}
        onPress={() => Linking.openURL("https://appigeek.github.io/blind-box-closet/privacy.html")}
      >
        <Text style={styles.rowText}>Politique de confidentialité</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => Linking.openURL(API_URL + "/health")}>
        <Text style={styles.rowText}>Statut API</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => signOut()}>
        <Text style={styles.rowText}>{isGuest ? "Quitter le mode local" : "Se déconnecter"}</Text>
      </Pressable>

      <Pressable
        style={[styles.row, styles.danger]}
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
      >
        <Text style={[styles.rowText, { color: colors.danger }]}>
          {isGuest ? "Effacer ma collection locale" : "Supprimer mon compte"}
        </Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        Blind Box Closet est une app collector indépendante, non affiliée à Dreams Inc. / Smiski.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  title: { color: colors.mintSoft, fontSize: 28, fontWeight: "800", marginBottom: 16 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  label: { color: colors.textMuted, fontSize: 12 },
  value: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 4 },
  meta: { color: colors.textDim, marginTop: 4 },
  admin: { color: colors.glow, marginTop: 8, fontWeight: "700" },
  row: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  danger: { marginTop: 12 },
  disclaimer: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 28,
    lineHeight: 18,
  },
});
