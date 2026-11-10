import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme/colors";
import type { Figure } from "../types/models";

type Props = {
  figure: Figure;
  ownedQty?: number;
  wishlist?: boolean;
  onPress?: () => void;
  onToggleOwned?: () => void;
};

export function FigureCard({
  figure,
  ownedQty = 0,
  wishlist,
  onPress,
  onToggleOwned,
}: Props) {
  const owned = ownedQty > 0;
  return (
    <Pressable onPress={onPress} style={[styles.card, owned && styles.owned]}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: figure.image_url || undefined }}
          style={styles.image}
          contentFit="contain"
        />
        {figure.is_secret ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Secret</Text>
          </View>
        ) : null}
        {figure.is_limited ? (
          <View style={[styles.badge, styles.limited]}>
            <Text style={styles.badgeText}>Limited</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {figure.name_en}
      </Text>
      <Text style={styles.meta}>
        {owned ? `×${ownedQty}` : wishlist ? "Wishlist" : "Manquant"}
      </Text>
      {onToggleOwned ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleOwned();
          }}
          style={[styles.toggle, owned && styles.toggleOn]}
          hitSlop={6}
        >
          <Text style={[styles.toggleText, owned && styles.toggleTextOn]}>
            {owned ? "Je l'ai ✓" : "Je l'ai"}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 200,
  },
  owned: {
    borderColor: colors.glow,
    backgroundColor: "#1F3A30",
  },
  imageWrap: {
    height: 100,
    borderRadius: 14,
    backgroundColor: colors.glowDim,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.secret,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  limited: { backgroundColor: colors.warning, left: "auto", right: 6 },
  badgeText: { color: "#1A1200", fontSize: 10, fontWeight: "700" },
  name: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    minHeight: 34,
  },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  toggle: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.mint,
    paddingVertical: 8,
    alignItems: "center",
  },
  toggleOn: {
    backgroundColor: colors.glowDim,
    borderColor: colors.glow,
  },
  toggleText: { color: colors.mint, fontWeight: "700", fontSize: 12 },
  toggleTextOn: { color: colors.glow },
});
