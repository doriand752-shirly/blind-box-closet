import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ChecklistFigureCard } from "../components/ChecklistFigureCard";
import { FigureEditSheet } from "../components/FigureEditSheet";
import { useCollectionApi } from "../hooks/useCollectionApi";
import { api } from "../services/api";
import { colors } from "../theme/colors";
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

  const load = useCallback(async () => {
    setLoading(true);
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

  const filteredBlocks = useMemo(() => {
    const query = q.trim().toLowerCase();
    return blocks
      .map((b) => {
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
        return { ...b, figures: figs };
      })
      .filter((b) => filter === "all" || b.figures.length > 0);
  }, [blocks, entryMap, filter, q]);

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
      <View style={styles.center}>
        <ActivityIndicator color={colors.mintDeep} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Smiskis</Text>
        <Text style={styles.progressTop}>
          {totals.owned} / {totals.total}
        </Text>
      </View>

      <View style={styles.tabs}>
        {([
          ["all", "All"],
          ["owned", "Owned"],
          ["trade", "Trade"],
          ["wishlist", "Wishlist"],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tab, filter === key && styles.tabOn]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.tabText, filter === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search collection..."
        placeholderTextColor={colors.textDim}
        style={styles.search}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {filteredBlocks.map((block) => {
          // For progress use all figures of series from original blocks
          const full = blocks.find((b) => b.series.id === block.series.id);
          const fullOwned = (full?.figures || []).filter(
            (f) => (entryMap[f.id]?.owned_qty || 0) > 0,
          ).length;
          const fullTotal = full?.figures.length || block.figures.length;
          const isCollapsed = !!collapsed[block.series.id];
          const pct = fullTotal ? Math.round((fullOwned / fullTotal) * 100) : 0;

          return (
            <View key={block.series.id} style={styles.seriesCard}>
              <Pressable
                style={styles.seriesHeader}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setCollapsed((c) => ({ ...c, [block.series.id]: !c[block.series.id] }));
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.seriesName}>{block.series.name_en}</Text>
                  <Text style={styles.seriesLabel}>Series</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
                <Text style={styles.seriesCount}>
                  {fullOwned}/{fullTotal}
                </Text>
                <Text style={styles.chevron}>{isCollapsed ? "›" : "˄"}</Text>
              </Pressable>

              {!isCollapsed ? (
                <View style={styles.grid}>
                  {block.figures.map((fig) => (
                    <ChecklistFigureCard
                      key={fig.id}
                      figure={fig}
                      ownedQty={entryMap[fig.id]?.owned_qty || 0}
                      selected={selected?.id === fig.id}
                      onToggleOwned={() => toggleOwnedQuick(fig)}
                      onPress={() => setSelected(fig)}
                    />
                  ))}
                  {/* spacer for incomplete rows */}
                  {block.figures.length % 3 === 2 ? <View style={{ width: "31%" }} /> : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  back: { color: colors.text, fontSize: 34, fontWeight: "300", marginTop: -4 },
  title: { flex: 1, color: colors.text, fontSize: 28, fontWeight: "800" },
  progressTop: { color: colors.textMuted, fontWeight: "700" },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "rgba(58,42,31,0.06)",
    borderRadius: 16,
    padding: 4,
    marginBottom: 10,
  },
  tab: { flex: 1, paddingVertical: 10, borderItems: "center", borderRadius: 12 },
  tabOn: { backgroundColor: colors.tabActive },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  tabTextOn: { color: colors.text },
  search: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  seriesCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seriesHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  seriesName: { color: colors.text, fontSize: 18, fontWeight: "800" },
  seriesLabel: { color: colors.textDim, fontSize: 12, marginTop: 2, marginBottom: 8 },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.smiskiBarTrack,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: colors.smiskiBar },
  seriesCount: { color: colors.text, fontWeight: "800", fontSize: 16 },
  chevron: { color: colors.textMuted, fontSize: 18, width: 18, textAlign: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: 4,
  },
});
