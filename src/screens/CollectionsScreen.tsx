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
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { api } from "../services/api";
import { colors } from "../theme/colors";

export function CollectionsScreen() {
  const navigation = useNavigation<any>();
  const { loadCollection } = useCollectionApi();
  const [owned, setOwned] = useState(0);
  const [total, setTotal] = useState(0);
  const [cover, setCover] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [brands, col, series] = await Promise.all([
        api.brands(),
        loadCollection(),
        api.series({ brandSlug: "smiski" }),
      ]);
      const smiski = brands.brands.find((b) => b.slug === "smiski");
      setTotal(smiski?.figure_count || col.stats.total_figures || 0);
      setOwned(col.stats.owned_figures || 0);
      setCover(series.series[0]?.cover_image_url || null);
    } finally {
      setLoading(false);
    }
  }, [loadCollection]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pct = total ? Math.round((owned / total) * 100) : 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.mintDeep} />}
    >
      <Text style={styles.title}>Collections</Text>

      {loading && !total ? (
        <ActivityIndicator color={colors.mintDeep} style={{ marginTop: 40 }} />
      ) : (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("BrandCollection")}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.brand}>Smiskis</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.count}>
              {owned} / {total}
            </Text>
          </View>
          <Image
            source={{ uri: cover || undefined }}
            style={styles.hero}
            contentFit="contain"
          />
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 18,
  },
  card: {
    backgroundColor: colors.smiskiCard,
    borderRadius: 28,
    minHeight: 120,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cardLeft: { flex: 1, paddingRight: 8 },
  brand: { color: colors.text, fontSize: 28, fontWeight: "800", marginBottom: 14 },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.smiskiBarTrack,
    overflow: "hidden",
    marginBottom: 10,
  },
  barFill: { height: "100%", backgroundColor: colors.smiskiBar },
  count: { color: colors.textMuted, fontWeight: "700", fontSize: 15 },
  hero: {
    width: 110,
    height: 120,
    marginRight: -8,
    marginBottom: -10,
  },
});
