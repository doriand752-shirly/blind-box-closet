import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SoftPressable } from "./ui/SoftPressable";
import { FigureImage } from "./FigureImage";
import { colors, fonts, radius, space, type } from "../theme";
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

type InnerProps = {
  figure: Figure;
  seriesName?: string;
  initialOwned: number;
  initialWishlist: boolean;
  initialTrade: number;
  onClose: () => void;
  onSave: (next: { owned_qty: number; wishlist: boolean; trade_qty: number }) => void;
};

function FigureEditSheetInner({
  figure,
  seriesName,
  initialOwned,
  initialWishlist,
  initialTrade,
  onClose,
  onSave,
}: InnerProps) {
  const insets = useSafeAreaInsets();
  const [owned, setOwned] = useState(initialOwned);
  const [wishlist, setWishlist] = useState(initialWishlist);
  const [trade, setTrade] = useState(initialTrade);

  const bump = (kind: "owned" | "trade", delta: number) => {
    Haptics.selectionAsync().catch(() => undefined);
    if (kind === "owned") setOwned((q) => Math.max(0, q + delta));
    else setTrade((q) => Math.max(0, q + delta));
  };

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <FigureImage
          uri={figure.image_url}
          brandSlug={figure.brand_slug}
          style={styles.thumb}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{figure.name_en}</Text>
          <Text style={styles.series}>{seriesName || figure.series_name}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <SoftPressable
          style={[styles.chip, owned > 0 && styles.chipOwned]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            setOwned((q) => (q > 0 ? 0 : 1));
          }}
        >
          <Text style={[styles.chipText, owned > 0 && styles.chipTextOn]}>Possédé</Text>
          {owned > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{owned}</Text>
            </View>
          ) : null}
        </SoftPressable>
        <SoftPressable
          style={[styles.chip, wishlist && styles.chipWish]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            setWishlist((w) => !w);
          }}
        >
          <Text style={[styles.chipText, wishlist && styles.chipTextOn]}>Wishlist</Text>
        </SoftPressable>
        <SoftPressable
          style={[styles.chip, trade > 0 && styles.chipTrade]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            setTrade((q) => (q > 0 ? 0 : 1));
          }}
        >
          <Text style={[styles.chipText, trade > 0 && styles.chipTextOn]}>Échange</Text>
          {trade > 0 ? (
            <View style={[styles.badge, styles.badgeTrade]}>
              <Text style={styles.badgeText}>{trade}</Text>
            </View>
          ) : null}
        </SoftPressable>
      </View>

      <Text style={styles.label}>Quantité possédée</Text>
      <View style={styles.stepper}>
        <SoftPressable style={styles.stepBtn} onPress={() => bump("owned", -1)}>
          <Text style={styles.stepText}>−</Text>
        </SoftPressable>
        <Text style={styles.stepValue}>{owned}</Text>
        <SoftPressable style={styles.stepBtn} onPress={() => bump("owned", 1)}>
          <Text style={styles.stepText}>+</Text>
        </SoftPressable>
      </View>

      <Text style={styles.label}>Quantité à échanger</Text>
      <View style={styles.stepper}>
        <SoftPressable style={styles.stepBtn} onPress={() => bump("trade", -1)}>
          <Text style={styles.stepText}>−</Text>
        </SoftPressable>
        <Text style={styles.stepValue}>{trade}</Text>
        <SoftPressable style={styles.stepBtn} onPress={() => bump("trade", 1)}>
          <Text style={styles.stepText}>+</Text>
        </SoftPressable>
      </View>

      <SoftPressable
        style={styles.done}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined,
          );
          onSave({ owned_qty: owned, wishlist, trade_qty: trade });
          onClose();
        }}
      >
        <Text style={styles.doneText}>Enregistrer</Text>
      </SoftPressable>
    </View>
  );
}

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
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        {figure ? (
          <FigureEditSheetInner
            key={`${figure.id}-${visible ? "open" : "closed"}-${initialOwned}-${initialWishlist}-${initialTrade}`}
            figure={figure}
            seriesName={seriesName}
            initialOwned={initialOwned}
            initialWishlist={initialWishlist}
            initialTrade={initialTrade}
            onClose={onClose}
            onSave={onSave}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.missing,
    marginBottom: space.lg,
  },
  header: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: space.xl },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.figureTile,
  },
  name: { ...type.subtitle, color: colors.text },
  series: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginBottom: space.xl },
  chip: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOwned: { backgroundColor: colors.mintDeep, borderColor: colors.mintDeep },
  chipWish: { backgroundColor: colors.wishlist, borderColor: colors.wishlist },
  chipTrade: { backgroundColor: colors.trade, borderColor: colors.trade },
  chipText: { ...type.caption, color: colors.text },
  chipTextOn: { color: colors.white },
  badge: {
    position: "absolute",
    top: -6,
    right: -4,
    backgroundColor: colors.mint,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeTrade: { backgroundColor: colors.checkbox },
  badgeText: { color: colors.white, fontSize: 10, fontFamily: fonts.extrabold },
  label: { ...type.caption, color: colors.textMuted, marginBottom: space.sm },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    marginBottom: space.xl,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: colors.text, fontSize: 24, fontFamily: fonts.bold },
  stepValue: {
    color: colors.text,
    fontSize: 30,
    fontFamily: fonts.extrabold,
    minWidth: 40,
    textAlign: "center",
  },
  done: {
    backgroundColor: colors.checkbox,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 16 },
});
