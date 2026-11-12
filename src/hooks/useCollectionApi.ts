import { useCallback } from "react";
import {
  localCollectionBundle,
  localGetEntry,
  localGetMap,
  localUpsert,
} from "../services/localCollection";

export function useCollectionApi() {
  const loadCollection = useCallback(async () => localCollectionBundle(), []);

  const upsert = useCallback(
    async (input: {
      figureId: string;
      owned_qty?: number;
      wishlist?: boolean;
      trade_qty?: number;
      notes?: string | null;
    }) => {
      await localUpsert(input);
    },
    [],
  );

  const getEntry = useCallback(async (figureId: string) => localGetEntry(figureId), []);

  const getLocalMap = useCallback(async () => localGetMap(), []);

  return { loadCollection, upsert, getEntry, getLocalMap, isLocal: true };
}
