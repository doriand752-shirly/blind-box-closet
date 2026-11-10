import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { colors } from "../theme/colors";
import type { CollectionStats, SeriesProgress } from "../types/models";

export function HomeScreen() {
  const { user, isGuest } = useAuth();
  const { loadCollection } = useCollectionApi();
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [progress, setProgress] = useState<SeriesProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadCollection();
      setStats(data.stats);
      setProgress(data.seriesProgress.filter((s) => s.owned > 0).slice(0, 8));
    } finally {
      setLoading(false);
    }
  }, [loadCollection]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pct = stats?.total_figures
    ? Math.round((stats.owned_figures / stats.total_figures) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.mint} />}
    >
      <Text style={styles.hello}>
        Salut{user?.display_name && !isGuest ? `, ${user.display_name}` : ""}
        {isGuest ? " (mode local)" : ""}
      </Text>
      <Text style={styles.brand}>Blind Box Closet</Text>

      {loading && !stats ? (
        <ActivityIndicator color={colors.mint} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Progression</Text>
            <Text style={styles.heroValue}>{pct}%</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.heroMeta}>
              {stats?.owned_figures ?? 0} / {stats?.total_figures ?? 0} figurines ·{" "}
              {stats?.owned_qty_total ?? 0} pièces · {stats?.wishlist_count ?? 0} wishlist
            </Text>
          </View>

          <Text style={styles.section}>Séries en cours</Text>
          {progress.length === 0 ? (
            <Pressable
              style={styles.empty}
              onPress={() => navigation.navigate("CatalogTab")}
            >
              <Text style={styles.emptyText}>Commence par explorer le catalogue Smiski</Text>
            </Pressable>
          ) : (
            progress.map((s) => (
              <Pressable
                key={s.id}
                style={styles.row}
                onPress={() =>
                  navigation.navigate("CatalogTab", {
                    screen: "SeriesDetail",
                    params: { seriesId: s.id, title: s.name_en },
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{s.name_en}</Text>
                  <Text style={styles.rowMeta}>
                    {s.owned}/{s.total}
                  </Text>
                </View>
                <View style={styles.miniTrack}>
                  <View
                    style={[
                      styles.miniFill,
                      { width: `${Math.round((s.owned / Math.max(s.total, 1)) * 100)}%` },
                    ]}
                  />
                </View>
              </Pressable>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  hello: { color: colors.textMuted, fontSize: 14 },
  brand: {
    color: colors.mintSoft,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginBottom: 20,
  },
  hero: {
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 28,
  },
  heroLabel: { color: colors.textMuted, fontSize: 13 },
  heroValue: { color: colors.glow, fontSize: 48, fontWeight: "800", marginVertical: 4 },
  barTrack: {
    height: 10,
    backgroundColor: colors.missing,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 8,
  },
  barFill: { height: "100%", backgroundColor: colors.glow },
  heroMeta: { color: colors.textMuted, marginTop: 12, fontSize: 13 },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  empty: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { color: colors.mint },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.text, fontWeight: "600" },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  miniTrack: {
    width: 72,
    height: 8,
    backgroundColor: colors.missing,
    borderRadius: 999,
    overflow: "hidden",
  },
  miniFill: { height: "100%", backgroundColor: colors.mint },
});
