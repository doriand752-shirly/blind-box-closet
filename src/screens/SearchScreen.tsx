import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { FigureCard } from "../components/FigureCard";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { api } from "../services/api";
import { colors } from "../theme/colors";
import type { CollectionItem, Figure } from "../types/models";

export function SearchScreen() {
  const navigation = useNavigation<any>();
  const { loadCollection } = useCollectionApi();
  const [q, setQ] = useState("");
  const [secretsOnly, setSecretsOnly] = useState(false);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [collectionMap, setCollectionMap] = useState<Record<string, CollectionItem>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.figures({
          q: q.trim() || undefined,
          secretsOnly,
        });
        setFigures(data.figures);
        const col = await loadCollection();
        const map: Record<string, CollectionItem> = {};
        for (const item of col.items) map[item.figure_id] = item;
        setCollectionMap(map);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, secretsOnly, loadCollection]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Recherche</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Nom, série…"
        placeholderTextColor={colors.textDim}
        style={styles.input}
        autoCorrect={false}
      />
      <View style={styles.row}>
        <Text style={styles.label}>Secrets seulement</Text>
        <Switch
          value={secretsOnly}
          onValueChange={setSecretsOnly}
          trackColor={{ true: colors.glow, false: colors.missing }}
        />
      </View>
      {loading ? <ActivityIndicator color={colors.mint} style={{ marginTop: 20 }} /> : null}
      <FlatList
        data={figures}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={{ flex: 1, marginBottom: 10 }}>
            <FigureCard
              figure={item}
              ownedQty={collectionMap[item.id]?.owned_qty || 0}
              wishlist={collectionMap[item.id]?.wishlist}
              onPress={() =>
                navigation.navigate("FigureDetail", {
                  figure: item,
                  seriesName: item.series_name,
                })
              }
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  title: { color: colors.mintSoft, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  label: { color: colors.textMuted },
});
