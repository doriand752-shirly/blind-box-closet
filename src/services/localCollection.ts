import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CollectionItem, CollectionStats, SeriesProgress } from "../types/models";
import { api } from "./api";

const KEY = "bbc_local_collection";

export type LocalEntry = {
  figure_id: string;
  owned_qty: number;
  wishlist: boolean;
  trade_qty: number;
  notes: string | null;
};

async function readMap(): Promise<Record<string, LocalEntry>> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, any>;
    const out: Record<string, LocalEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = {
        figure_id: v.figure_id || k,
        owned_qty: v.owned_qty || 0,
        wishlist: !!v.wishlist,
        trade_qty: v.trade_qty || 0,
        notes: v.notes ?? null,
      };
    }
    return out;
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, LocalEntry>) {
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

export async function localUpsert(entry: {
  figureId: string;
  owned_qty?: number;
  wishlist?: boolean;
  trade_qty?: number;
  notes?: string | null;
}) {
  const map = await readMap();
  const prev = map[entry.figureId];
  const owned = entry.owned_qty ?? prev?.owned_qty ?? 0;
  const wishlist = entry.wishlist ?? prev?.wishlist ?? false;
  const trade_qty = entry.trade_qty ?? prev?.trade_qty ?? 0;
  const notes = entry.notes ?? prev?.notes ?? null;
  if (owned <= 0 && !wishlist && trade_qty <= 0 && !notes) {
    delete map[entry.figureId];
  } else {
    map[entry.figureId] = {
      figure_id: entry.figureId,
      owned_qty: Math.max(0, owned),
      wishlist,
      trade_qty: Math.max(0, trade_qty),
      notes,
    };
  }
  await writeMap(map);
  return map[entry.figureId] || null;
}

export async function localCollectionBundle(): Promise<{
  items: CollectionItem[];
  stats: CollectionStats;
  seriesProgress: SeriesProgress[];
}> {
  const map = await readMap();
  const figures = await api.figures();
  const byId = new Map(figures.figures.map((f) => [f.id, f]));
  const seriesRes = await api.series({ brandSlug: "smiski" });

  const items: CollectionItem[] = [];
  for (const entry of Object.values(map)) {
    if (entry.owned_qty <= 0 && !entry.wishlist && entry.trade_qty <= 0) continue;
    const f = byId.get(entry.figure_id);
    if (!f) continue;
    items.push({
      user_id: "guest",
      figure_id: entry.figure_id,
      owned_qty: entry.owned_qty,
      wishlist: entry.wishlist,
      notes: entry.notes,
      name_en: f.name_en,
      name_ja: f.name_ja,
      image_url: f.image_url,
      is_secret: f.is_secret,
      is_limited: f.is_limited,
      is_bonus: f.is_bonus,
      is_duo: f.is_duo,
      series_id: f.series_id,
      series_name: f.series_name || "",
      series_slug: f.series_slug || "",
      brand_name: f.brand_name || "Smiski",
    });
  }

  const owned_figures = items.filter((i) => i.owned_qty > 0).length;
  const owned_qty_total = items.reduce((s, i) => s + i.owned_qty, 0);
  const wishlist_count = items.filter((i) => i.wishlist).length;

  const seriesProgress: SeriesProgress[] = seriesRes.series.map((s) => {
    const inSeries = figures.figures.filter((f) => f.series_id === s.id);
    const owned = inSeries.filter((f) => (map[f.id]?.owned_qty || 0) > 0).length;
    return {
      id: s.id,
      name_en: s.name_en,
      slug: s.slug,
      cover_image_url: s.cover_image_url,
      total: inSeries.length || s.figure_count || 0,
      owned,
    };
  });

  return {
    items,
    stats: {
      owned_figures,
      owned_qty_total,
      wishlist_count,
      total_figures: figures.figures.length,
    },
    seriesProgress,
  };
}

export async function localGetEntry(figureId: string) {
  const map = await readMap();
  return map[figureId] || null;
}

export async function localGetMap() {
  return readMap();
}
