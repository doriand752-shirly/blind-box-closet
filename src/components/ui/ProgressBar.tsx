import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../../theme";

type Props = {
  progress: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  trackColor?: string;
  fillColor?: string;
};

export function ProgressBar({
  progress,
  height = 8,
  style,
  trackColor = colors.smiskiBarTrack,
  fillColor = colors.smiskiBar,
}: Props) {
  const width = useSharedValue(0);
  const clamped = Math.max(0, Math.min(100, progress));

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 420 });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: fillColor }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.full,
  },
});
