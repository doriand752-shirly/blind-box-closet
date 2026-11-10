import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { FigureCard } from "../components/FigureCard";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { colors } from "../theme/colors";
import type { CollectionItem, Figure } from "../types/models";

type Tab = "owned" | "wishlist" | "duplicates";

export function CollectionScreen() {
  const { loadCollection } = useCollectionApi();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [tab, setTab] = useState<Tab>("owned");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadCollection();
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [loadCollection]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    if (tab === "owned") return items.filter((i) => i.owned_qty > 0);
    if (tab === "wishlist") return items.filter((i) => i.wishlist);
    return items.filter((i) => i.owned_qty > 1);
  }, [items, tab]);

  const toFigure = (item: CollectionItem): Figure => ({
    id: item.figure_id,
    series_id: item.series_id,
    name_en: item.name_en,
    name_ja: item.name_ja,
    is_secret: item.is_secret,
    is_limited: item.is_limited,
    is_bonus: item.is_bonus,
    is_duo: item.is_duo,
    image_url: item.image_url,
    sort_order: 0,
    series_name: item.series_name,
  });

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Ma collection</Text>
      <View style={styles.tabs}>
        {(["owned", "wishlist", "duplicates"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabOn]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {t === "owned" ? "Possédés" : t === "wishlist" ? "Wishlist" : "Doublons"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.mint} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.figure_id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ paddingBottom: 40, gap: 0 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Rien ici pour le moment.</Text>
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1, marginBottom: 10 }}>
              <FigureCard
                figure={toFigure(item)}
                ownedQty={item.owned_qty}
                wishlist={item.wishlist}
                onPress={() =>
                  navigation.navigate("FigureDetail", {
                    figure: toFigure(item),
                    seriesName: item.series_name,
                  })
                }
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  title: { color: colors.mintSoft, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
  },
  tabOn: { backgroundColor: colors.glowDim, borderWidth: 1, borderColor: colors.glow },
  tabText: { color: colors.textMuted, fontWeight: "600", fontSize: 12 },
  tabTextOn: { color: colors.mintSoft },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
});
