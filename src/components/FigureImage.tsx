import React, { useState } from "react";
import { StyleSheet, View, type StyleProp, type ImageStyle, type ViewStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { colors, getBrandTheme } from "../theme";

const SMISKI_FALLBACK = require("../../assets/smiski-unknown.jpg");

type Props = {
  uri?: string | null;
  brandSlug?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
};

export function FigureImage({
  uri,
  brandSlug,
  style,
  contentFit = "contain",
  transition = 160,
}: Props) {
  const [failed, setFailed] = useState(false);
  // Smiski "?" only when this figure is explicitly a Smiski and truly has no image.
  const isSmiski = brandSlug === "smiski";
  const useRemote = !!uri && !failed;

  if (!useRemote && !isSmiski) {
    const theme = getBrandTheme(brandSlug || "unknown");
    return (
      <View style={[styles.neutral, { backgroundColor: theme.card }, style as StyleProp<ViewStyle>]} />
    );
  }

  return (
    <Image
      source={useRemote ? { uri } : SMISKI_FALLBACK}
      style={[styles.image, style]}
      contentFit={contentFit}
      transition={transition}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
  neutral: { width: "100%", height: "100%", backgroundColor: colors.figureTile },
});
