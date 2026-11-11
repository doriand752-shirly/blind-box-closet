import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space, type } from "../../theme";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon = "leaf-outline", title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBubble}>
        <Ionicons name={icon} size={26} color={colors.mintDeep} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxxl,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.mintWash,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  title: {
    ...type.bodyStrong,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.sm,
  },
});
