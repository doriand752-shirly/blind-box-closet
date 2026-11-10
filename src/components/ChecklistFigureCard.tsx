import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme/colors";
import type { Figure } from "../types/models";

type Props = {
  figure: Figure;
  ownedQty?: number;
  selected?: boolean;
  onPress?: () => void;
  onToggleOwned?: () => void;
};

export function ChecklistFigureCard({
  figure,
  ownedQty = 0,
  selected,
  onPress,
  onToggleOwned,
}: Props) {
  const owned = ownedQty > 0;
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={[styles.tile, selected && styles.tileSelected, owned && styles.tileOwned]}>
        {ownedQty > 1 ? (
          <View style={styles.qtyPill}>
            <Text style={styles.qtyText}>x{ownedQty}</Text>
          </View>
        ) : null}
        <Pressable
          style={[styles.check, owned && styles.checkOn]}
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleOwned?.();
          }}
          hitSlop={8}
        >
          {owned ? <Text style={styles.checkMark}>✓</Text> : null}
        </Pressable>
        <Image
          source={{ uri: figure.image_url || undefined }}
          style={styles.image}
          contentFit="contain"
        />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {figure.name_en}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "31%", marginBottom: 14 },
  tile: {
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: colors.figureTile,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  tileOwned: { borderColor: "rgba(47,107,79,0.15)" },
  tileSelected: { borderColor: colors.checkbox },
  image: { width: "100%", height: "100%" },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.checkbox,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.checkbox, borderColor: colors.checkbox },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: -1 },
  qtyPill: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  qtyText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  name: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    minHeight: 32,
  },
});
