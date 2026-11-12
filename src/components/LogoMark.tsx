import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { brand } from "../theme";

const LOGO = require("../../assets/brand/logo.png");

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** The app logo as a rounded tile. */
export function LogoMark({ size = 72, style }: Props) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.225 },
        style,
      ]}
    >
      <Image source={LOGO} style={styles.image} contentFit="cover" accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: "hidden",
    backgroundColor: brand.wall,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(58, 42, 31, 0.10)",
  },
  image: { width: "100%", height: "100%" },
});
