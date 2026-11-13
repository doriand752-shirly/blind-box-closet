import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ChecklistFigureCard } from "../components/ChecklistFigureCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Screen } from "../components/ui/Screen";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { api } from "../services/api";
import { colors, fonts, getBrandTheme, radius, space, type } from "../theme";
import type { CollectionItem, Figure, Series } from "../types/models";

type Bucket = "main" | "extras";
type RouteParams = {
  FriendCollection: { friendId: string; username?: string };
};

type FigureRow = { key: string; figures: Figure[] };
type SeriesSection = {
  series: Series;
  data: FigureRow[];
};

function chunkFigures(figures: Figure[], size = 3): FigureRow[] {
  const rows: FigureRow[] = [];
  for (let i = 0; i < figures.length; i += size) {
    const slice = figures.slice(i, size + i);
    rows.push({ key: slice.map((f) => f.id).join("-"), figures: slice });
  }
  return rows;
}

export function FriendCollectionScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { token } = useAuth();
  const route = useRoute<RouteProp<RouteParams, "FriendCollection">>();
  const friendId = route.params?.friendId;
  const titleName = route.params?.username || t("friendCollection");

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>("main");
  const [series, setSeries] = useState<Series[]>([]);
  const [figures, setFigures] = useState<Figure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const entryMap = useMemo(() => {
    const map: Record<
      string,
      { owned_qty: number; wishlist: boolean; trade_qty: number }
    > = {};
    for (const item of items) {
      map[item.figure_id] = {
        owned_qty: item.owned_qty || 0,
        wishlist: !!item.wishlist,
        trade_qty: item.trade_qty || 0,
      };
    }
    return map;
  }, [items]);

  const brands = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      const slug = item.brand_slug || "smiski";
      if (!seen.has(slug)) seen.set(slug, item.brand_name || slug);
    }
    return Array.from(seen.entries()).map(([slug, name]) => ({ slug, name }));
  }, [items]);

  const loadFriend = useCallback(async () => {
    if (!token || !friendId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.friendCollection(token, friendId);
      setItems(res.items);
      const firstBrand =
        res.items.find((i) => i.brand_slug)?.brand_slug ||
        res.items[0]?.brand_slug ||
        "smiski";
      setBrandSlug((prev) => prev || firstBrand);
    } catch (e: any) {
      setError(e?.message || t("connectionError"));
    } finally {
      setLoading(false);
    }
  }, [token, friendId, t]);

  useFocusEffect(
    useCallback(() => {
      void loadFriend();
    }, [loadFriend]),
  );

  const loadChecklist = useCallback(async () => {
    if (!brandSlug) return;
    try {
      const checklist = await api.brandChecklist(brandSlug, bucket === "main" ? "main" : "extras");
      setSeries(checklist.series);
      setFigures(checklist.figures);
    } catch (e: any) {
      setError(e?.message || t("connectionError"));
    }
  }, [brandSlug, bucket, t]);

  useFocusEffect(
    useCallback(() => {
      void loadChecklist();
    }, [loadChecklist]),
  );

  const sections: SeriesSection[] = useMemo(() => {
    return series.map((s) => {
      const figs = figures.filter((f) => f.series_id === s.id);
      return { series: s, data: chunkFigures(figs) };
    }).filter((s) => s.data.length > 0);
  }, [series, figures]);

  const theme = getBrandTheme(brandSlug || "smiski");
  const ownedCount = figures.filter((f) => (entryMap[f.id]?.owned_qty || 0) > 0).length;

  return (
    <Screen>
      <View style={styles.top}>
        <SoftPressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </SoftPressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {titleName}
          </Text>
          <Text style={styles.subtitle}>
            {ownedCount}/{figures.length} · {t("friendCollection")}
          </Text>
        </View>
      </View>

      {brands.length > 1 ? (
        <View style={styles.brandRow}>
          {brands.map((b) => (
            <SoftPressable
              key={b.slug}
              style={[styles.brandChip, brandSlug === b.slug && styles.brandChipOn]}
              onPress={() => setBrandSlug(b.slug)}
            >
              <Text
                style={[
                  styles.brandChipText,
                  brandSlug === b.slug && styles.brandChipTextOn,
                ]}
              >
                {b.name}
              </Text>
            </SoftPressable>
          ))}
        </View>
      ) : null}

      <View style={styles.segWrap}>
        <SegmentedControl
          value={bucket}
          onChange={(v) => setBucket(v)}
          options={[
            { key: "main", label: t("main") },
            { key: "extras", label: t("extras") },
          ]}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent || colors.mintDeep} style={{ marginTop: 40 }} />
      ) : error ? (
        <EmptyState title={t("connectionError")} subtitle={error} />
      ) : !sections.length ? (
        <EmptyState title={t("friendCollection")} subtitle={t("noFriendsBody")} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: space.md }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.seriesTitle}>{section.series.name_en}</Text>
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.figures.map((fig) => (
                <View key={fig.id} style={styles.cell}>
                  <ChecklistFigureCard
                    figure={fig}
                    brandSlug={brandSlug || undefined}
                    ownedQty={entryMap[fig.id]?.owned_qty || 0}
                    wishlist={entryMap[fig.id]?.wishlist || false}
                    tradeQty={entryMap[fig.id]?.trade_qty || 0}
                  />
                </View>
              ))}
              {Array.from({ length: Math.max(0, 3 - item.figures.length) }).map((_, i) => (
                <View key={`pad-${i}`} style={styles.cell} />
              ))}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    marginBottom: space.sm,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  subtitle: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  brandRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  brandChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandChipOn: { backgroundColor: colors.checkbox, borderColor: colors.checkbox },
  brandChipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  brandChipTextOn: { color: colors.white },
  segWrap: { paddingHorizontal: space.md, marginBottom: space.md },
  seriesTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  cell: { flex: 1 },
});
