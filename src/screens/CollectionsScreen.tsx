import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BrandHeroCard } from "../components/BrandHeroCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Screen } from "../components/ui/Screen";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { useLocale } from "../i18n/LocaleContext";
import { api } from "../services/api";
import {
  getFavoriteBrands,
  sortBrandsByFavorites,
} from "../services/brandPrefs";
import { getBrandTheme, colors, space, type } from "../theme";
import type { Brand } from "../types/models";

type BrandProgress = {
  brand: Brand;
  owned: number;
  total: number;
  cover: string | null;
};

export function CollectionsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLocale();
  const { loadCollection, getLocalMap } = useCollectionApi();
  const [rows, setRows] = useState<BrandProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [brandsRes, col, favorites, local] = await Promise.all([
          api.brands(),
          loadCollection(),
          getFavoriteBrands(),
          getLocalMap(),
        ]);
        // Same merge as BrandCollectionScreen so home progress matches the checklist.
        const ownedByFigure: Record<string, number> = {};
        for (const [id, entry] of Object.entries(local)) {
          if ((entry.owned_qty || 0) > 0) ownedByFigure[id] = entry.owned_qty;
        }
        for (const item of col.items) {
          ownedByFigure[item.figure_id] = Math.max(
            ownedByFigure[item.figure_id] || 0,
            item.owned_qty || 0,
          );
        }
        const ownedIds = new Set(
          Object.entries(ownedByFigure)
            .filter(([, qty]) => qty > 0)
            .map(([id]) => id),
        );

        const live = brandsRes.brands.filter(
          (b) => (b.status || "live") === "live",
        );
        const soon = brandsRes.brands.filter((b) => b.status === "coming_soon");
        const orderedLive = sortBrandsByFavorites(live, favorites);

        const progress: BrandProgress[] = [];
        for (const brand of orderedLive) {
          const checklist = await api.brandChecklist(brand.slug, "main");
          const total =
            brand.main_figure_count ||
            checklist.figures.length ||
            brand.figure_count ||
            0;
          const owned = checklist.figures.filter((f) => ownedIds.has(f.id)).length;
          const seriesCover =
            checklist.series.find(
              (s) =>
                s.cover_image_url &&
                !s.cover_image_url.includes("smiski-unknown") &&
                !s.cover_image_url.includes("placeholder") &&
                /\/media\/series\//.test(s.cover_image_url),
            )?.cover_image_url ||
            checklist.series.find(
              (s) =>
                s.cover_image_url &&
                !s.cover_image_url.includes("smiski-unknown") &&
                !s.cover_image_url.includes("placeholder"),
            )?.cover_image_url ||
            null;
          const cover =
            (brand.hero_image_url &&
            !brand.hero_image_url.includes("smiski-unknown")
              ? brand.hero_image_url
              : null) || seriesCover;
          progress.push({ brand, owned, total, cover });
        }

        for (const brand of soon) {
          progress.push({
            brand,
            owned: 0,
            total: 0,
            cover: brand.hero_image_url || null,
          });
        }

        setRows(progress);
      } catch (e: any) {
        setError(e?.message || t("loadErrorSubtitle"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadCollection, getLocalMap, t],
  );

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  return (
    <Screen>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.progressActive}
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("collections")}</Text>
          <SoftPressable
            onPress={() => navigation.getParent()?.navigate("SettingsTab")}
            hitSlop={10}
            style={styles.iconBtn}
            scaleTo={0.92}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </SoftPressable>
        </View>
        <Text style={styles.subtitle}>{t("collectionsSubtitle")}</Text>

        {loading && !rows.length ? (
          <ActivityIndicator color={colors.progressActive} style={{ marginTop: 48 }} />
        ) : error && !rows.length ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t("loadError")}
            subtitle={error}
          />
        ) : (
          rows.map(({ brand, owned, total, cover }) => {
            const soon = brand.status === "coming_soon";
            return (
              <BrandHeroCard
                key={brand.id}
                slug={brand.slug}
                name={getBrandTheme(brand.slug).label || brand.name}
                owned={owned}
                total={total}
                coverUrl={cover}
                comingSoon={soon}
                comingSoonLabel={t("comingSoon")}
                onPress={() =>
                  navigation.navigate("BrandCollection", { brandSlug: brand.slug })
                }
              />
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: 110, paddingTop: space.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: { ...type.hero, color: colors.text, fontSize: 34 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    marginBottom: space.xxl,
  },
});
