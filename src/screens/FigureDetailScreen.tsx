import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRoute } from "@react-navigation/native";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { colors } from "../theme/colors";
import type { Figure } from "../types/models";

export function FigureDetailScreen() {
  const route = useRoute<any>();
  const figure = route.params?.figure as Figure;
  const seriesName = route.params?.seriesName as string | undefined;
  const { getEntry, upsert } = useCollectionApi();
  const [ownedQty, setOwnedQty] = useState(0);
  const [wishlist, setWishlist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const item = await getEntry(figure.id);
        setOwnedQty((item as any)?.owned_qty || 0);
        setWishlist(!!(item as any)?.wishlist);
      } finally {
        setLoaded(true);
      }
    })();
  }, [figure.id, getEntry]);

  const save = async (nextQty: number, nextWish: boolean) => {
    setSaving(true);
    setOwnedQty(nextQty);
    setWishlist(nextWish);
    try {
      await upsert({
        figureId: figure.id,
        owned_qty: nextQty,
        wishlist: nextWish,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: figure.image_url || undefined }}
          style={styles.image}
          contentFit="contain"
        />
      </View>
      <Text style={styles.name}>{figure.name_en}</Text>
      {figure.name_ja ? <Text style={styles.ja}>{figure.name_ja}</Text> : null}
      <Text style={styles.series}>{seriesName || figure.series_name}</Text>
      <View style={styles.flags}>
        {figure.is_secret ? <Text style={styles.flag}>Secret</Text> : null}
        {figure.is_limited ? <Text style={styles.flag}>Limited</Text> : null}
        {figure.is_bonus ? <Text style={styles.flag}>Bonus</Text> : null}
        {figure.is_duo ? <Text style={styles.flag}>Duo</Text> : null}
      </View>

      {!loaded ? (
        <ActivityIndicator color={colors.mint} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.qtyRow}>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => save(Math.max(0, ownedQty - 1), wishlist)}
              disabled={saving}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qty}>{ownedQty}</Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => save(ownedQty + 1, wishlist)}
              disabled={saving}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.qtyLabel}>Quantité possédée</Text>

          <Pressable
            style={[styles.wishBtn, wishlist && styles.wishOn]}
            onPress={() => save(ownedQty, !wishlist)}
            disabled={saving}
          >
            <Text style={styles.wishText}>
              {wishlist ? "Dans la wishlist" : "Ajouter à la wishlist"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  imageWrap: {
    height: 260,
    borderRadius: 28,
    backgroundColor: colors.glowDim,
    marginBottom: 20,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  name: { color: colors.text, fontSize: 28, fontWeight: "800" },
  ja: { color: colors.textDim, marginTop: 4 },
  series: { color: colors.mint, marginTop: 8, fontWeight: "600" },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  flag: {
    backgroundColor: colors.secret,
    color: "#1A1200",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
    fontSize: 12,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginTop: 28,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { color: colors.mint, fontSize: 24, fontWeight: "700" },
  qty: { color: colors.glow, fontSize: 36, fontWeight: "800", minWidth: 48, textAlign: "center" },
  qtyLabel: { color: colors.textMuted, textAlign: "center", marginTop: 8 },
  wishBtn: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.wishlist,
    paddingVertical: 14,
    alignItems: "center",
  },
  wishOn: { backgroundColor: "rgba(142,197,255,0.18)" },
  wishText: { color: colors.wishlist, fontWeight: "700" },
});
