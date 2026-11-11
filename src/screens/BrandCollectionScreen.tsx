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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ChecklistFigureCard } from "../components/ChecklistFigureCard";
import { FigureEditSheet } from "../components/FigureEditSheet";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Screen } from "../components/ui/Screen";
import { SearchField } from "../components/ui/SearchField";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { SoftPressable } from "../components/ui/SoftPressable";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { api } from "../services/api";
import { colors, fonts, radius, space, type } from "../theme";
import type { Figure, Series } from "../types/models";
import type { LocalEntry } from "../services/localCollection";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Filter = "all" | "owned" | "trade" | "wishlist";

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
    const slice = figures.slice(i, i + size);
    rows.push({ key: slice.map((f) => f.id).join("-"), figures: slice });
  }
  return rows;
}

export function BrandCollectionScreen() {
  const navigation = useNavigation<any>();
  const { loadCollection, upsert, getLocalMap } = useCollectionApi();
  const [blocks, setBlocks] = useState<SeriesBlock[]>([]);
  const [entryMap, setEntryMap] = useState<Record<string, LocalEntry>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Figure | null>(null);
  const hydrated = useRef(false);

  const load = useCallback(async () => {
    if (!hydrated.current) setLoading(true);
    try {
      const seriesList = await api.series({ brandSlug: "smiski" });
      const details = await Promise.all(
        seriesList.series.map(async (s) => {
          try {
            const d = await api.seriesDetail(s.id);
            return { series: d.series, figures: d.figures };
          } catch {
            const figs = await api.figures({ seriesId: s.id });
            return { series: s, figures: figs.figures };
          }
        }),
      );
      setBlocks(details);

      if (!hydrated.current) {
        const initial: Record<string, boolean> = {};
        details.forEach((b, i) => {
          initial[b.series.id] = i > 0;
        });
        setCollapsed(initial);
        hydrated.current = true;
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
  }, [loadCollection, getLocalMap]);

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
          <ActivityIndicator color={colors.mintDeep} />
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
          <Text style={styles.title}>Smiskis</Text>
          <Text style={styles.progressTop}>
            {totals.owned} / {totals.total} ·{" "}
            {totals.total ? Math.round((totals.owned / totals.total) * 100) : 0}%
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "Tous" },
            { key: "owned", label: "Possédés" },
            { key: "trade", label: "Échange" },
            { key: "wishlist", label: "Wishlist" },
          ]}
        />
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher une figurine…"
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
            title="Rien ici"
            subtitle="Essaie un autre filtre ou une autre recherche."
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
              <View style={{ flex: 1 }}>
                <Text style={styles.seriesName}>{section.series.name_en}</Text>
                <Text style={styles.seriesLabel}>Série</Text>
                <ProgressBar progress={pct} height={7} style={{ marginTop: 2 }} />
              </View>
              <Text style={styles.seriesCount}>
                {section.fullOwned}/{section.fullTotal}
              </Text>
              <Ionicons
                name={section.collapsed ? "chevron-forward" : "chevron-up"}
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
    paddingBottom: 48,
  },
  seriesCard: {
    marginTop: space.sm,
    marginBottom: space.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
