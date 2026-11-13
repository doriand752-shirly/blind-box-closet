import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BrandSelectCard } from "../components/BrandSelectCard";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useLocale } from "../i18n/LocaleContext";
import { api } from "../services/api";
import {
  getFavoriteBrands,
  setFavoriteBrands,
} from "../services/brandPrefs";
import { colors, fonts, space, type } from "../theme";
import type { Brand } from "../types/models";

export function ManageCollectionsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [res, favs] = await Promise.all([api.brands(), getFavoriteBrands()]);
        const live = res.brands
          .filter((b) => (b.status || "live") === "live")
          .sort((a, b) => a.name.localeCompare(b.name));
        setBrands(live);
        const liveSlugs = new Set(live.map((b) => b.slug));
        const kept = favs.filter((s) => liveSlugs.has(s));
        setSelected(kept.length ? kept : live[0] ? [live[0].slug] : ["smiski"]);
      } catch {
        setBrands([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = useCallback((slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  const save = async () => {
    if (!selected.length) {
      Alert.alert(t("ok"), t("pickAtLeastOne"));
      return;
    }
    setSaving(true);
    try {
      await setFavoriteBrands(selected);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.top}>
        <SoftPressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </SoftPressable>
        <Text style={styles.title}>{t("manageCollections")}</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.subtitle}>{t("manageCollectionsBody")}</Text>

      {loading ? (
        <ActivityIndicator color={colors.progressActive} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {brands.map((b) => (
            <BrandSelectCard
              key={b.slug}
              slug={b.slug}
              coverUrl={b.hero_image_url}
              selected={selected.includes(b.slug)}
              onPress={() => toggle(b.slug)}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Text style={styles.count}>{t("collectionsSelected", { count: selected.length })}</Text>
        <SoftPressable
          style={[styles.save, (!selected.length || saving) && styles.saveOff]}
          disabled={!selected.length || saving}
          onPress={save}
        >
          <Text style={styles.saveText}>{t("save")}</Text>
        </SoftPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.subtitle, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted, marginBottom: space.lg },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom: 24,
  },
  footer: { paddingTop: space.md },
  count: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: space.sm,
  },
  save: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  saveOff: { backgroundColor: colors.continueDisabled },
  saveText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
