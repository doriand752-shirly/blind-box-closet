import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SoftPressable } from "./ui/SoftPressable";
import { FigureImage } from "./FigureImage";
import { colors, fonts, getBrandTheme, radius, space } from "../theme";

type Props = {
  slug: string;
  selected: boolean;
  disabled?: boolean;
  coverUrl?: string | null;
  onPress: () => void;
};

export function BrandSelectCard({
  slug,
  selected,
  disabled,
  coverUrl,
  onPress,
}: Props) {
  const theme = getBrandTheme(slug);

  return (
    <SoftPressable
      style={[styles.wrap, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.97}
    >
      <View style={[styles.top, { backgroundColor: theme.card }]}>
        <FigureImage uri={coverUrl} style={styles.hero} contentFit="contain" />
      </View>
      <View style={styles.bottom}>
        <Text style={styles.name} numberOfLines={1}>
          {theme.label}
        </Text>
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected ? (
            <Ionicons name="checkmark" size={14} color={colors.white} />
          ) : null}
        </View>
      </View>
      {disabled ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Bientôt</Text>
        </View>
      ) : null}
    </SoftPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "47.5%",
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.white,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: { opacity: 0.55 },
  top: {
    height: 110,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingRight: 4,
  },
  hero: { width: 96, height: 104 },
  bottom: {
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: {
    backgroundColor: colors.progressActive,
    borderColor: colors.progressActive,
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.textMuted,
  },
});
