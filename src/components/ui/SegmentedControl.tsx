import React from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { SoftPressable } from "./SoftPressable";
import { colors, radius, type } from "../../theme";

type Option<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const on = value === opt.key;
        return (
          <SoftPressable
            key={opt.key}
            scaleTo={0.96}
            style={[styles.item, on && styles.itemOn]}
            onPress={() => {
              if (opt.key !== value) {
                Haptics.selectionAsync().catch(() => undefined);
                onChange(opt.key);
              }
            }}
          >
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {opt.label}
            </Text>
          </SoftPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: "rgba(31,42,36,0.06)",
    borderRadius: radius.lg,
    padding: 4,
    gap: 2,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  itemOn: {
    backgroundColor: colors.bgCard,
    shadowColor: "#1F2A24",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  label: {
    ...type.caption,
    color: colors.textMuted,
  },
  labelOn: {
    color: colors.text,
    fontFamily: type.bodyStrong.fontFamily,
  },
});
