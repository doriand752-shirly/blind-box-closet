import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../../theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
  padded?: boolean;
};

export function Screen({
  children,
  style,
  edges = ["top", "left", "right"],
  padded = false,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: edges.includes("top") ? insets.top : 0,
          paddingBottom: edges.includes("bottom") ? Math.max(insets.bottom, space.sm) : 0,
          paddingLeft: edges.includes("left") ? Math.max(insets.left, 0) : 0,
          paddingRight: edges.includes("right") ? Math.max(insets.right, 0) : 0,
        },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  padded: {
    paddingHorizontal: space.xl,
  },
});
