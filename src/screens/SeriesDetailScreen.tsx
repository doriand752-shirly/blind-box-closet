import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { FigureCard } from "../components/FigureCard";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { api } from "../services/api";
import { colors } from "../theme/colors";
import type { CollectionItem, Figure, Series } from "../types/models";

export function SeriesDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { loadCollection, upsert } = useCollectionApi();
  const seriesId = route.params?.seriesId as string;
  const [series, setSeries] = useState<Series | null>(null);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [collectionMap, setCollectionMap] = useState<Record<string, CollectionItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let nextSeries: Series | null = null;
      let nextFigures: Figure[] = [];
      try {
        const detail = await api.seriesDetail(seriesId);
        nextSeries = detail.series;
        nextFigures = detail.figures || [];
      } catch {
        // Fallback if detail route fails
        const [seriesList, figs] = await Promise.all([
          api.series({ brandSlug: "smiski" }),
          api.figures({ seriesId }),
        ]);
        nextSeries =
          seriesList.series.find((s) => s.id === seriesId || s.slug === seriesId) ||
          null;
        nextFigures = figs.figures || [];
      }
      setSeries(nextSeries);
      setFigures(nextFigures);

      const col = await loadCollection();
      const map: Record<string, CollectionItem> = {};
      for (const item of col.items) map[item.figure_id] = item;
      setCollectionMap(map);
    } catch (e: any) {
      setError(e?.message || "Impossible de charger la série");
    } finally {
      setLoading(false);
    }
  }, [seriesId, loadCollection]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const ownedCount = useMemo(
    () => figures.filter((f) => (collectionMap[f.id]?.owned_qty || 0) > 0).length,
    [figures, collectionMap],
  );

  const toggleOwned = async (figure: Figure) => {
    const current = collectionMap[figure.id];
    const owned = (current?.owned_qty || 0) > 0;
    const nextQty = owned ? 0 : 1;
    const wishlist = !!current?.wishlist;
    setCollectionMap((prev) => {
      const copy = { ...prev };
      if (nextQty <= 0 && !wishlist) {
        delete copy[figure.id];
      } else {
        copy[figure.id] = {
          ...(copy[figure.id] || {
            user_id: "local",
            figure_id: figure.id,
            notes: null,
            name_en: figure.name_en,
            name_ja: figure.name_ja,
            image_url: figure.image_url,
            is_secret: figure.is_secret,
            is_limited: figure.is_limited,
            is_bonus: figure.is_bonus,
            is_duo: figure.is_duo,
            series_id: figure.series_id,
            series_name: series?.name_en || "",
            series_slug: series?.slug || "",
            brand_name: "Smiski",
          }),
          owned_qty: nextQty,
          wishlist,
        };
      }
      return copy;
    });
    await upsert({
      figureId: figure.id,
      owned_qty: nextQty,
      wishlist,
    });
  };

  if (loading && !series && !figures.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={figures}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={figures.length ? { gap: 10 } : undefined}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>{series?.name_en || route.params?.title || "Série"}</Text>
          {series?.name_ja ? <Text style={styles.ja}>{series.name_ja}</Text> : null}
          <Text style={styles.meta}>
            {ownedCount}/{figures.length} obtenus
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !figures.length && !error ? (
            <Text style={styles.error}>Aucune figurine dans cette série.</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? <ActivityIndicator color={colors.mint} style={{ marginTop: 24 }} /> : undefined
      }
      renderItem={({ item }) => (
        <View style={{ flex: 1, marginBottom: 10 }}>
          <FigureCard
            figure={item}
            ownedQty={collectionMap[item.id]?.owned_qty || 0}
            wishlist={collectionMap[item.id]?.wishlist}
            onToggleOwned={() => toggleOwned(item)}
            onPress={() =>
              navigation.navigate("FigureDetail", {
                figure: item,
                seriesName: series?.name_en,
              })
            }
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  title: { color: colors.mintSoft, fontSize: 26, fontWeight: "800" },
  ja: { color: colors.textDim, marginTop: 2 },
  meta: { color: colors.textMuted, marginTop: 8 },
  error: { color: colors.danger, marginTop: 10 },
});
