import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme/colors";
import type { Figure } from "../types/models";

type Props = {
  visible: boolean;
  figure: Figure | null;
  seriesName?: string;
  initialOwned?: number;
  initialWishlist?: boolean;
  initialTrade?: number;
  onClose: () => void;
  onSave: (next: { owned_qty: number; wishlist: boolean; trade_qty: number }) => void;
};

export function FigureEditSheet({
  visible,
  figure,
  seriesName,
  initialOwned = 0,
  initialWishlist = false,
  initialTrade = 0,
  onClose,
  onSave,
}: Props) {
  const [owned, setOwned] = useState(initialOwned);
  const [wishlist, setWishlist] = useState(initialWishlist);
  const [trade, setTrade] = useState(initialTrade);

  useEffect(() => {
    if (visible) {
      setOwned(initialOwned);
      setWishlist(initialWishlist);
      setTrade(initialTrade);
    }
  }, [visible, initialOwned, initialWishlist, initialTrade, figure?.id]);

  if (!figure) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Image source={{ uri: figure.image_url || undefined }} style={styles.thumb} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{figure.name_en}</Text>
            <Text style={styles.series}>{seriesName || figure.series_name}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Pressable
            style={[styles.chip, owned > 0 && styles.chipOn]}
            onPress={() => setOwned((q) => (q > 0 ? q : 1))}
          >
            <Text style={[styles.chipText, owned > 0 && styles.chipTextOn]}>Owned</Text>
            {owned > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{owned}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={[styles.chip, wishlist && styles.chipOn]}
            onPress={() => setWishlist((w) => !w)}
          >
            <Text style={[styles.chipText, wishlist && styles.chipTextOn]}>Wishlist</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, trade > 0 && styles.chipOn]}
            onPress={() => setTrade((q) => (q > 0 ? q : 1))}
          >
            <Text style={[styles.chipText, trade > 0 && styles.chipTextOn]}>Trade</Text>
            {trade > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{trade}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Text style={styles.label}>Owned quantity</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepBtn} onPress={() => setOwned((q) => Math.max(0, q - 1))}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{owned}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setOwned((q) => q + 1)}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.done}
          onPress={() => {
            onSave({ owned_qty: owned, wishlist, trade_qty: trade });
            onClose();
          }}
        >
          <Text style={styles.doneText}>✓  Done</Text>
        </Pressable>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 34,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.missing,
    marginBottom: 14,
  },
  header: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 18 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.figureTile,
  },
  name: { color: colors.text, fontSize: 20, fontWeight: "800" },
  series: { color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginBottom: 18 },
  chip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.checkbox, borderColor: colors.checkbox },
  chipText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#fff" },
  badge: {
    position: "absolute",
    top: -6,
    right: -4,
    backgroundColor: colors.mint,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  label: { color: colors.textMuted, marginBottom: 8, fontWeight: "600" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    marginBottom: 18,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: colors.text, fontSize: 22, fontWeight: "700" },
  stepValue: { color: colors.text, fontSize: 28, fontWeight: "800", minWidth: 36, textAlign: "center" },
  done: {
    backgroundColor: colors.checkbox,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
