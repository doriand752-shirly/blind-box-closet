import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getFavoriteBrands, setFavoriteBrands } from "./brandPrefs";
import { localGetMap, type LocalEntry } from "./localCollection";

const KEY = "bbc_local_collection";

export type CollectionExport = {
  version: 1;
  exported_at: string;
  favorite_brands: string[];
  entries: LocalEntry[];
};

export async function buildExportPayload(): Promise<CollectionExport> {
  const map = await localGetMap();
  const favorites = await getFavoriteBrands();
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    favorite_brands: favorites,
    entries: Object.values(map),
  };
}

export async function exportCollectionFile(): Promise<void> {
  const payload = await buildExportPayload();
  const name = `blind-box-closet-export-${Date.now()}.json`;
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error("No cache directory");
  const uri = `${base}${name}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error("Sharing unavailable");
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Blind Box Closet",
    UTI: "public.json",
  });
}

export async function importCollectionFile(): Promise<{ count: number }> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "public.json", "text/json"],
    copyToCacheDirectory: true,
  });
  if (pick.canceled || !pick.assets?.[0]) return { count: 0 };
  const raw = await FileSystem.readAsStringAsync(pick.assets[0].uri);
  const data = JSON.parse(raw) as CollectionExport;
  if (!data || !Array.isArray(data.entries)) {
    throw new Error("Invalid export file");
  }

  const map: Record<string, LocalEntry> = {};
  for (const e of data.entries) {
    if (!e?.figure_id) continue;
    map[e.figure_id] = {
      figure_id: e.figure_id,
      owned_qty: Math.max(0, Number(e.owned_qty) || 0),
      wishlist: !!e.wishlist,
      trade_qty: Math.max(0, Number(e.trade_qty) || 0),
      notes: e.notes ?? null,
    };
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
  if (Array.isArray(data.favorite_brands) && data.favorite_brands.length) {
    await setFavoriteBrands(data.favorite_brands);
  }
  return { count: Object.keys(map).length };
}
