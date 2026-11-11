import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  UIManager,
  View,
  type SectionListData,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ChecklistFigureCard } from "../components/ChecklistFigureCard";
import { FigureEditSheet } from "../components/FigureEditSheet";
import { FigureImage } from "../components/FigureImage";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Screen } from "../components/ui/Screen";
import { SearchField } from "../components/ui/SearchField";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { useLocale } from "../i18n/LocaleContext";
import { api } from "../services/api";
import { colors, fonts, getBrandTheme, radius, space, type } from "../theme";
import { seriesCategoryLabel } from "../utils/productForm";
import type { Figure, Series } from "../types/models";
import type { LocalEntry } from "../services/localCollection";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Filter = "all" | "owned" | "trade" | "wishlist";
type Bucket = "main" | "extras";

type SeriesBlock = {
  series: Series;
  figures: Figure[];
};

type FigureRow = {
  key: string;
  figures: Figure[];
};

type SeriesSection = {
  series: Series;
  fullOwned: number;
  fullTotal: number;
  collapsed: boolean;
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

export function BrandCollectionScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLocale();
  const route = useRoute<RouteProp<Record<string, { brandSlug?: string }>, string>>();
  const brandSlug = route.params?.brandSlug || "smiski";
  const theme = getBrandTheme(brandSlug);

  const { loadCollection, upsert, getLocalMap } = useCollectionApi();
  const [blocks, setBlocks] = useState<SeriesBlock[]>([]);
  const [entryMap, setEntryMap] = useState<Record<string, LocalEntry>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [bucket, setBucket] = useState<Bucket>("main");
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Figure | null>(null);
  const hydrated = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (hydrated.current !== brandSlug + bucket) setLoading(true);
    try {
      const data = await api.brandChecklist(brandSlug, bucket);
      const bySeries = new Map<string, SeriesBlock>();
      for (const s of data.series) {
        bySeries.set(s.id, { series: s, figures: [] });
      }
      for (const f of data.figures) {
        const block = bySeries.get(f.series_id);
        if (block) block.figures.push(f);
      }
      const details = [...bySeries.values()];
      setBlocks(details);

      if (hydrated.current !== brandSlug + bucket) {
        const initial: Record<string, boolean> = {};
        details.forEach((b, i) => {
          initial[b.series.id] = i > 0;
        });
        setCollapsed(initial);
        hydrated.current = brandSlug + bucket;
      }

      const col = await loadCollection();
      const local = await getLocalMap();
      const map: Record<string, LocalEntry> = { ...local };
      for (const item of col.items) {
        map[item.figure_id] = {
          figure_id: item.figure_id,
          owned_qty: item.owned_qty,
          wishlist: item.wishlist,
          trade_qty: local[item.figure_id]?.trade_qty || 0,
          notes: item.notes,
        };
      }
      setEntryMap(map);
    } finally {
      setLoading(false);
    }
  }, [brandSlug, bucket, loadCollection, getLocalMap]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totals = useMemo(() => {
    let owned = 0;
    let total = 0;
    for (const b of blocks) {
      total += b.figures.length;
      owned += b.figures.filter((f) => (entryMap[f.id]?.owned_qty || 0) > 0).length;
    }
    return { owned, total };
  }, [blocks, entryMap]);

  const sections = useMemo(() => {
    const query = q.trim().toLowerCase();
    const result: SeriesSection[] = [];

    for (const b of blocks) {
      let figs = b.figures;
      if (filter === "owned") figs = figs.filter((f) => (entryMap[f.id]?.owned_qty || 0) > 0);
      if (filter === "wishlist") figs = figs.filter((f) => entryMap[f.id]?.wishlist);
      if (filter === "trade") figs = figs.filter((f) => (entryMap[f.id]?.trade_qty || 0) > 0);
      if (query) {
        figs = figs.filter(
          (f) =>
            f.name_en.toLowerCase().includes(query) ||
            (f.name_ja || "").toLowerCase().includes(query) ||
            b.series.name_en.toLowerCase().includes(query),
        );
      }
      if (filter !== "all" && figs.length === 0) continue;

      const fullOwned = b.figures.filter((f) => (entryMap[f.id]?.owned_qty || 0) > 0).length;
      const isCollapsed = !!collapsed[b.series.id];
      result.push({
        series: b.series,
        fullOwned,
        fullTotal: b.figures.length,
        collapsed: isCollapsed,
        data: isCollapsed ? [] : chunkFigures(figs),
      });
    }
    return result;
  }, [blocks, entryMap, filter, q, collapsed]);

  const toggleOwnedQuick = async (figure: Figure) => {
    const prev = entryMap[figure.id];
    const owned = (prev?.owned_qty || 0) > 0 ? 0 : Math.max(1, prev?.owned_qty || 1);
    const next: LocalEntry = {
      figure_id: figure.id,
      owned_qty: owned,
      wishlist: !!prev?.wishlist,
      trade_qty: prev?.trade_qty || 0,
      notes: prev?.notes ?? null,
    };
    setEntryMap((m) => ({ ...m, [figure.id]: next }));
    await upsert({
      figureId: figure.id,
      owned_qty: next.owned_qty,
      wishlist: next.wishlist,
      trade_qty: next.trade_qty,
    });
  };

  const saveSheet = async (next: {
    owned_qty: number;
    wishlist: boolean;
    trade_qty: number;
  }) => {
    if (!selected) return;
    setEntryMap((m) => ({
      ...m,
      [selected.id]: {
        figure_id: selected.id,
        owned_qty: next.owned_qty,
        wishlist: next.wishlist,
        trade_qty: next.trade_qty,
        notes: m[selected.id]?.notes ?? null,
      },
    }));
    await upsert({
      figureId: selected.id,
      owned_qty: next.owned_qty,
      wishlist: next.wishlist,
      trade_qty: next.trade_qty,
    });
  };

  if (loading && !blocks.length) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.progressActive} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <SoftPressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
          scaleTo={0.92}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </SoftPressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{theme.label}</Text>
          <Text style={styles.progressTop}>
            {totals.owned} / {totals.total} ·{" "}
            {totals.total ? Math.round((totals.owned / totals.total) * 100) : 0}%
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <SegmentedControl
          value={bucket}
          onChange={setBucket}
          options={[
            { key: "main", label: t("main") },
            { key: "extras", label: t("extras") },
          ]}
        />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: t("all") },
            { key: "owned", label: t("owned") },
            { key: "trade", label: t("trade") },
            { key: "wishlist", label: t("wishlist") },
          ]}
        />
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder={t("searchCollection")}
        />
      </View>

      <SectionList
        sections={sections as SectionListData<FigureRow, SeriesSection>[]}
        keyExtractor={(item) => item.key}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title={bucket === "extras" ? t("emptyExtras") : t("emptyTitle")}
            subtitle={
              bucket === "extras" ? t("emptyExtrasSubtitle") : t("emptySubtitle")
            }
          />
        }
        renderSectionHeader={({ section }) => {
          const pct = section.fullTotal
            ? Math.round((section.fullOwned / section.fullTotal) * 100)
            : 0;
          return (
            <SoftPressable
              style={styles.seriesCard}
              scaleTo={0.99}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                Haptics.selectionAsync().catch(() => undefined);
                setCollapsed((c) => ({
                  ...c,
                  [section.series.id]: !c[section.series.id],
                }));
              }}
            >
              <View style={[styles.accent, { backgroundColor: theme.bar }]} />
              {section.series.cover_image_url ? (
                <FigureImage
                  uri={section.series.cover_image_url}
                  brandSlug={brandSlug}
                  style={styles.seriesIcon}
                  contentFit="contain"
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.seriesName}>{section.series.name_en}</Text>
                <Text style={styles.seriesLabel}>
                  {seriesCategoryLabel(section.series.product_form)}
                </Text>
                <ProgressBar
                  progress={pct}
                  height={7}
                  fillColor={theme.bar}
                  style={{ marginTop: 2 }}
                />
              </View>
              <Text style={styles.seriesCount}>
                {section.fullOwned}/{section.fullTotal}
              </Text>
              <Ionicons
                name={section.collapsed ? "chevron-down" : "chevron-up"}
                size={18}
                color={colors.textMuted}
              />
            </SoftPressable>
          );
        }}
        renderItem={({ item }) => (
          <View style={styles.gridRow}>
            {item.figures.map((fig) => (
              <ChecklistFigureCard
                key={fig.id}
                figure={fig}
                brandSlug={brandSlug}
                ownedQty={entryMap[fig.id]?.owned_qty || 0}
                wishlist={!!entryMap[fig.id]?.wishlist}
                tradeQty={entryMap[fig.id]?.trade_qty || 0}
                selected={selected?.id === fig.id}
                onToggleOwned={() => toggleOwnedQuick(fig)}
                onPress={() => setSelected(fig)}
              />
            ))}
            {item.figures.length === 2 ? <View style={{ width: "31.5%" }} /> : null}
            {item.figures.length === 1 ? (
              <>
                <View style={{ width: "31.5%" }} />
                <View style={{ width: "31.5%" }} />
              </>
            ) : null}
          </View>
        )}
      />

      <FigureEditSheet
        visible={!!selected}
        figure={selected}
        seriesName={
          selected
            ? blocks.find((b) => b.figures.some((f) => f.id === selected.id))?.series.name_en
            : undefined
        }
        initialOwned={selected ? entryMap[selected.id]?.owned_qty || 0 : 0}
        initialWishlist={selected ? !!entryMap[selected.id]?.wishlist : false}
        initialTrade={selected ? entryMap[selected.id]?.trade_qty || 0 : 0}
        onClose={() => setSelected(null)}
        onSave={saveSheet}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.title, color: colors.text, fontSize: 26, lineHeight: 30 },
  progressTop: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  controls: {
    paddingHorizontal: space.lg,
    gap: space.md,
    marginBottom: space.md,
  },
  listContent: {
    paddingHorizontal: space.lg,
    paddingBottom: 110,
  },
  seriesCard: {
    marginTop: space.sm,
    marginBottom: space.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: space.lg,
    paddingLeft: space.lg + 6,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  seriesIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.figureTile,
  },
  seriesName: { ...type.subtitle, fontSize: 18, color: colors.text },
  seriesLabel: { ...type.micro, color: colors.textDim, marginTop: 2, marginBottom: 8 },
  seriesCount: { fontFamily: fonts.extrabold, color: colors.text, fontSize: 16 },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
});
