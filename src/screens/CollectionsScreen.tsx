import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SoftPressable } from "../components/ui/SoftPressable";
import { ProgressBar } from "../components/ui/ProgressBar";
import { EmptyState } from "../components/ui/EmptyState";
import { Screen } from "../components/ui/Screen";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { api } from "../services/api";
import { colors, fonts, radius, space, type } from "../theme";

export function CollectionsScreen() {
  const navigation = useNavigation<any>();
  const { loadCollection } = useCollectionApi();
  const [owned, setOwned] = useState(0);
  const [total, setTotal] = useState(0);
  const [cover, setCover] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
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
      } catch (e: any) {
        setError(e?.message || "Impossible de charger la collection");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadCollection],
  );

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const pct = total ? Math.round((owned / total) * 100) : 0;

  return (
    <Screen>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.mintDeep}
          />
        }
      >
        <Text style={styles.kicker}>Blind Box Closet</Text>
        <Text style={styles.title}>Collections</Text>
        <Text style={styles.subtitle}>Suis tes Smiski, wishlist et doublons.</Text>

        {loading && !total ? (
          <ActivityIndicator color={colors.mintDeep} style={{ marginTop: 48 }} />
        ) : error && !total ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Chargement impossible"
            subtitle={error}
          />
        ) : (
          <SoftPressable
            style={styles.cardWrap}
            onPress={() => navigation.navigate("BrandCollection")}
            scaleTo={0.985}
          >
            <LinearGradient
              colors={["#D8F3E4", "#EAF8F0", "#F7FBF8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.cardLeft}>
                <View style={styles.badge}>
                  <Ionicons name="leaf" size={12} color={colors.mintDeep} />
                  <Text style={styles.badgeText}>Smiski</Text>
                </View>
                <Text style={styles.brand}>Smiskis</Text>
                <ProgressBar progress={pct} height={10} style={{ marginBottom: 10 }} />
                <Text style={styles.count}>
                  {owned} / {total}
                  <Text style={styles.pct}> · {pct}%</Text>
                </Text>
                <View style={styles.ctaRow}>
                  <Text style={styles.cta}>Ouvrir</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.mintDeep} />
                </View>
              </View>
              <Image
                source={{ uri: cover || undefined }}
                style={styles.hero}
                contentFit="contain"
                transition={200}
              />
            </LinearGradient>
          </SoftPressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: 48, paddingTop: space.sm },
  kicker: {
    ...type.caption,
    color: colors.mintDeep,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: { ...type.hero, color: colors.text },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: space.xxl,
  },
  cardWrap: {
    borderRadius: radius.xxl,
    overflow: "hidden",
    shadowColor: "#1F2A24",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  card: {
    minHeight: 148,
    padding: space.xl,
    flexDirection: "row",
    alignItems: "center",
  },
  cardLeft: { flex: 1, paddingRight: 8 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: { ...type.micro, color: colors.mintDeep },
  brand: { ...type.title, color: colors.text, marginBottom: 14 },
  count: { ...type.bodyStrong, color: colors.textMuted },
  pct: { fontFamily: fonts.semibold, color: colors.textDim },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  cta: { ...type.caption, color: colors.mintDeep },
  hero: {
    width: 112,
    height: 128,
    marginRight: -6,
    marginBottom: -8,
  },
});
