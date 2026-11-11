import React, { useState } from "react";
import { StyleSheet, type StyleProp, type ImageStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";

const FALLBACK = require("../../assets/smiski-unknown.jpg");

type Props = {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
};

export function FigureImage({
  uri,
  style,
  contentFit = "contain",
  transition = 160,
}: Props) {
  const [failed, setFailed] = useState(false);
  const useRemote = !!uri && !failed;

  return (
    <Image
      source={useRemote ? { uri } : FALLBACK}
      style={[styles.image, style]}
      contentFit={contentFit}
      transition={transition}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%" },
});
