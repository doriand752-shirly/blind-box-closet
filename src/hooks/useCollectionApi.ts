import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  localCollectionBundle,
  localGetEntry,
  localGetMap,
  localUpsert,
} from "../services/localCollection";

export function useCollectionApi() {
  const { token, isGuest } = useAuth();
  const useServer = Boolean(token) && !isGuest;

  const loadCollection = useCallback(async () => {
    if (useServer && token) {
      return api.collection(token);
    }
    return localCollectionBundle();
  }, [token, useServer]);

  const upsert = useCallback(
    async (input: {
      figureId: string;
      owned_qty?: number;
      wishlist?: boolean;
      trade_qty?: number;
      notes?: string | null;
    }) => {
      // Always keep a local cache so guests and offline edits stay available.
      await localUpsert(input);
      if (useServer && token) {
        await api.upsertCollection(token, input);
      }
    },
    [token, useServer],
  );

  const getEntry = useCallback(
    async (figureId: string) => {
      if (useServer && token) {
        const col = await api.collection(token);
        const item = col.items.find((i) => i.figure_id === figureId);
        if (!item) return null;
        return {
          figure_id: item.figure_id,
          owned_qty: item.owned_qty,
          wishlist: item.wishlist,
          trade_qty: item.trade_qty || 0,
          notes: item.notes,
        };
      }
      return localGetEntry(figureId);
    },
    [token, useServer],
  );

  const getLocalMap = useCallback(async () => {
    if (useServer && token) {
      const col = await api.collection(token);
      const map: Record<
        string,
        {
          figure_id: string;
          owned_qty: number;
          wishlist: boolean;
          trade_qty: number;
          notes: string | null;
        }
      > = {};
      for (const item of col.items) {
        map[item.figure_id] = {
          figure_id: item.figure_id,
          owned_qty: item.owned_qty,
          wishlist: item.wishlist,
          trade_qty: item.trade_qty || 0,
          notes: item.notes,
        };
      }
      // Merge any fresher local edits that haven't synced yet.
      const local = await localGetMap();
      for (const [id, entry] of Object.entries(local)) {
        const remote = map[id];
        if (!remote) {
          map[id] = entry;
          continue;
        }
        map[id] = {
          figure_id: id,
          owned_qty: Math.max(remote.owned_qty, entry.owned_qty),
          wishlist: remote.wishlist || entry.wishlist,
          trade_qty: Math.max(remote.trade_qty, entry.trade_qty),
          notes: entry.notes ?? remote.notes,
        };
      }
      return map;
    }
    return localGetMap();
  }, [token, useServer]);

  return {
    loadCollection,
    upsert,
    getEntry,
    getLocalMap,
    isLocal: !useServer,
  };
}
