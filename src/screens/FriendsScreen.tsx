import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../components/ui/EmptyState";
import { Screen } from "../components/ui/Screen";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { api } from "../services/api";
import { colors, fonts, radius, space, type } from "../theme";
import type { Friendship } from "../types/models";

export function FriendsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLocale();
  const { token, isGuest } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (soft = false) => {
      if (!token || isGuest) {
        setFriends([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await api.friends(token);
        setFriends(res.friends);
      } catch (e: any) {
        setError(e?.message || t("connectionError"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, isGuest, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sendRequest = async () => {
    if (!token || !username.trim()) return;
    setBusy(true);
    try {
      await api.friendRequest(token, username.trim());
      setUsername("");
      await load(true);
    } catch (e: any) {
      Alert.alert(t("ok"), e?.message || t("connectionError"));
    } finally {
      setBusy(false);
    }
  };

  const accept = async (id: string) => {
    if (!token) return;
    try {
      await api.acceptFriend(token, id);
      await load(true);
    } catch (e: any) {
      Alert.alert(t("ok"), e?.message || t("connectionError"));
    }
  };

  const reject = async (id: string) => {
    if (!token) return;
    try {
      await api.rejectFriend(token, id);
      await load(true);
    } catch (e: any) {
      Alert.alert(t("ok"), e?.message || t("connectionError"));
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    Alert.alert(t("removeFriend"), t("removeFriend"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("removeFriend"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.removeFriend(token, id);
            await load(true);
          } catch (e: any) {
            Alert.alert(t("ok"), e?.message || t("connectionError"));
          }
        },
      },
    ]);
  };

  if (isGuest || !token) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.title}>{t("friends")}</Text>
          <Text style={styles.subtitle}>{t("friendsSubtitle")}</Text>
        </View>
        <EmptyState title={t("loginRequiredFriends")} subtitle={t("friendsSubtitle")} />
      </Screen>
    );
  }

  const incoming = friends.filter(
    (f) => f.status === "pending" && f.direction === "incoming",
  );
  const outgoing = friends.filter(
    (f) => f.status === "pending" && f.direction === "outgoing",
  );
  const accepted = friends.filter((f) => f.status === "accepted");

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("friends")}</Text>
          <Text style={styles.subtitle}>{t("friendsSubtitle")}</Text>
        </View>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("addFriendPlaceholder")}
            placeholderTextColor={colors.textDim}
            value={username}
            onChangeText={setUsername}
          />
          <SoftPressable
            style={[styles.addBtn, busy && styles.disabled]}
            onPress={sendRequest}
            disabled={busy}
          >
            <Text style={styles.addBtnText}>{t("addFriend")}</Text>
          </SoftPressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.mintDeep} style={{ marginTop: 24 }} />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {incoming.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("friendRequests")}</Text>
            {incoming.map((f) => (
              <View key={f.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {f.user.username || f.user.display_name || "—"}
                  </Text>
                </View>
                <SoftPressable style={styles.miniBtn} onPress={() => accept(f.id)}>
                  <Text style={styles.miniBtnText}>{t("accept")}</Text>
                </SoftPressable>
                <SoftPressable
                  style={[styles.miniBtn, styles.miniBtnGhost]}
                  onPress={() => reject(f.id)}
                >
                  <Text style={styles.miniBtnGhostText}>{t("reject")}</Text>
                </SoftPressable>
              </View>
            ))}
          </View>
        ) : null}

        {outgoing.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("friendRequests")}</Text>
            {outgoing.map((f) => (
              <View key={f.id} style={styles.card}>
                <Text style={styles.name}>
                  {f.user.username || f.user.display_name || "—"}
                </Text>
                <SoftPressable onPress={() => remove(f.id)}>
                  <Ionicons name="close" size={18} color={colors.textDim} />
                </SoftPressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          {!accepted.length && !loading ? (
            <EmptyState title={t("noFriends")} subtitle={t("noFriendsBody")} />
          ) : (
            accepted.map((f) => (
              <SoftPressable
                key={f.id}
                style={styles.card}
                onPress={() =>
                  navigation.navigate("FriendCollection", {
                    friendId: f.user.id,
                    username: f.user.username || f.user.display_name || "",
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {f.user.username || f.user.display_name || "—"}
                  </Text>
                  <Text style={styles.meta}>{t("friendCollection")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </SoftPressable>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, marginBottom: space.md },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 4 },
  addRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  addBtn: {
    backgroundColor: colors.checkbox,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  addBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  section: { paddingHorizontal: space.lg, marginBottom: space.lg },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { ...type.caption, color: colors.textDim, marginTop: 2 },
  miniBtn: {
    backgroundColor: colors.checkbox,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  miniBtnText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 12 },
  miniBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  miniBtnGhostText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 12 },
  error: { color: colors.danger, paddingHorizontal: space.lg, marginBottom: 8 },
  disabled: { opacity: 0.55 },
});
