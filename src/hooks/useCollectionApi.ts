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

  const loadCollection = useCallback(async () => {
    if (token && !isGuest) return api.collection(token);
    return localCollectionBundle();
  }, [token, isGuest]);

  const upsert = useCallback(
    async (body: {
      figureId: string;
      owned_qty?: number;
      wishlist?: boolean;
      trade_qty?: number;
      notes?: string | null;
    }) => {
      if (token && !isGuest) {
        // Server schema currently stores owned/wishlist/notes; trade kept local for now
        await api.upsertCollection(token, {
          figureId: body.figureId,
          owned_qty: body.owned_qty,
          wishlist: body.wishlist,
          notes: body.notes,
        });
        // Mirror trade locally for UX parity
        const map = await localGetMap();
        const prev = map[body.figureId];
        await localUpsert({
          figureId: body.figureId,
          owned_qty: body.owned_qty ?? prev?.owned_qty ?? 0,
          wishlist: body.wishlist ?? prev?.wishlist ?? false,
          trade_qty: body.trade_qty ?? prev?.trade_qty ?? 0,
          notes: body.notes ?? prev?.notes ?? null,
        });
        return { ok: true };
      }
      await localUpsert(body);
      return { ok: true };
    },
    [token, isGuest],
  );

  const getEntry = useCallback(
    async (figureId: string) => {
      const local = await localGetEntry(figureId);
      if (token && !isGuest) {
        const col = await api.collection(token);
        const remote = col.items.find((i) => i.figure_id === figureId);
        return {
          owned_qty: remote?.owned_qty || 0,
          wishlist: !!remote?.wishlist,
          trade_qty: local?.trade_qty || 0,
          notes: remote?.notes ?? null,
        };
      }
      return local;
    },
    [token, isGuest],
  );

  const getLocalMap = useCallback(async () => localGetMap(), []);

  return { loadCollection, upsert, getEntry, getLocalMap, isLocal: isGuest || !token };
}
