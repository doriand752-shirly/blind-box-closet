import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SoftPressable } from "./ui/SoftPressable";
import { ProgressBar } from "./ui/ProgressBar";
import { FigureImage } from "./FigureImage";
import { colors, fonts, getBrandTheme, radius, space, type } from "../theme";

type Props = {
  slug: string;
  name: string;
  owned: number;
  total: number;
  coverUrl?: string | null;
  comingSoon?: boolean;
  onPress?: () => void;
};

export function BrandHeroCard({
  slug,
  name,
  owned,
  total,
  coverUrl,
  comingSoon,
  onPress,
}: Props) {
  const theme = getBrandTheme(slug);
  const pct = total ? Math.round((owned / total) * 100) : 0;
  const label = theme.label || name;

  return (
    <SoftPressable
      style={[styles.wrap, comingSoon && styles.wrapSoon]}
      onPress={comingSoon ? undefined : onPress}
      disabled={comingSoon}
      scaleTo={0.985}
    >
      <LinearGradient
        colors={[theme.card, theme.cardEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.left}>
          <Text style={styles.brand}>{label}</Text>
          {comingSoon ? (
            <Text style={styles.soon}>Bientôt</Text>
          ) : (
            <>
              <ProgressBar
                progress={pct}
                height={8}
                fillColor={theme.bar}
                trackColor="rgba(255,255,255,0.55)"
                style={{ marginTop: 18, marginBottom: 8 }}
              />
              <Text style={styles.count}>
                {owned} / {total}
              </Text>
            </>
          )}
        </View>
        <FigureImage uri={coverUrl} style={styles.hero} contentFit="contain" />
      </LinearGradient>
    </SoftPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xxl,
    overflow: "hidden",
    marginBottom: space.lg,
    shadowColor: "#3A2A1F",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  wrapSoon: { opacity: 0.72 },
  card: {
    minHeight: 132,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  left: { flex: 1, paddingRight: 8, zIndex: 1 },
  brand: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    lineHeight: 30,
    color: colors.text,
    letterSpacing: -0.3,
  },
  soon: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 10,
  },
  count: {
    ...type.bodyStrong,
    color: colors.textMuted,
  },
  hero: {
    width: 118,
    height: 128,
    marginRight: -10,
    marginBottom: -10,
  },
});
