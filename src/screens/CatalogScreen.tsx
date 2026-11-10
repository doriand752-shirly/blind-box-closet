import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { api } from "../services/api";
import { colors } from "../theme/colors";
import type { Series } from "../types/models";

export function CatalogScreen() {
  const navigation = useNavigation<any>();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.series({ brandSlug: "smiski" });
      setSeries(data.series);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && !series.length) {
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
      data={series}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>Catalogue Smiski</Text>
          <Text style={styles.subtitle}>{series.length} séries · tap pour ouvrir</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() =>
            navigation.navigate("SeriesDetail", {
              seriesId: item.id,
              title: item.name_en,
            })
          }
        >
          <Image
            source={{ uri: item.cover_image_url || undefined }}
            style={styles.cover}
            contentFit="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name_en}</Text>
            {item.name_ja ? <Text style={styles.ja}>{item.name_ja}</Text> : null}
            <Text style={styles.meta}>
              {item.figure_count ?? "?"} figurines
              {item.secret_count ? ` · ${item.secret_count} secret` : ""}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  title: { color: colors.mintSoft, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.textMuted, marginTop: 4 },
  row: {
    flexDirection: "row",
    gap: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.glowDim,
  },
  name: { color: colors.text, fontWeight: "700", fontSize: 16 },
  ja: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
