import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { SoftPressable } from "./ui/SoftPressable";
import { colors, fonts, radius, space, type } from "../theme";
import type { Figure } from "../types/models";

type Props = {
  figure: Figure;
  ownedQty?: number;
  wishlist?: boolean;
  tradeQty?: number;
  selected?: boolean;
  onPress?: () => void;
  onToggleOwned?: () => void;
};

export function ChecklistFigureCard({
  figure,
  ownedQty = 0,
  wishlist = false,
  tradeQty = 0,
  selected,
  onPress,
  onToggleOwned,
}: Props) {
  const owned = ownedQty > 0;

  return (
    <SoftPressable onPress={onPress} style={styles.wrap} scaleTo={0.96}>
      <View style={[styles.tile, selected && styles.tileSelected, owned && styles.tileOwned]}>
        {ownedQty > 1 ? (
          <View style={styles.qtyPill}>
            <Text style={styles.qtyText}>×{ownedQty}</Text>
          </View>
        ) : null}

        <View style={styles.markers}>
          {wishlist ? <View style={[styles.dot, styles.dotWish]} /> : null}
          {tradeQty > 0 ? <View style={[styles.dot, styles.dotTrade]} /> : null}
          {figure.is_secret ? (
            <View style={styles.secretPill}>
              <Text style={styles.secretText}>S</Text>
            </View>
          ) : null}
        </View>

        <SoftPressable
          style={[styles.check, owned && styles.checkOn]}
          scaleTo={0.9}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            onToggleOwned?.();
          }}
          hitSlop={10}
        >
          {owned ? <Text style={styles.checkMark}>✓</Text> : null}
        </SoftPressable>

        <Image
          source={{ uri: figure.image_url || undefined }}
          style={styles.image}
          contentFit="contain"
          transition={160}
        />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {figure.name_en}
      </Text>
    </SoftPressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "31.5%", marginBottom: space.lg },
  tile: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.figureTile,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  tileOwned: {
    borderColor: "rgba(36,107,74,0.18)",
    backgroundColor: colors.mintWash,
  },
  tileSelected: { borderColor: colors.checkbox },
  image: { width: "100%", height: "100%" },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.checkbox,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.checkbox, borderColor: colors.checkbox },
  checkMark: { color: colors.white, fontSize: 13, fontFamily: fonts.extrabold, marginTop: -1 },
  qtyPill: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  qtyText: { color: colors.text, fontSize: 11, fontFamily: fonts.extrabold },
  markers: {
    position: "absolute",
    left: 8,
    bottom: 8,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotWish: { backgroundColor: colors.wishlist },
  dotTrade: { backgroundColor: colors.trade },
  secretPill: {
    backgroundColor: colors.secret,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  secretText: { color: colors.white, fontSize: 9, fontFamily: fonts.extrabold },
  name: {
    ...type.micro,
    color: colors.text,
    textAlign: "center",
    marginTop: 6,
    minHeight: 28,
  },
});
