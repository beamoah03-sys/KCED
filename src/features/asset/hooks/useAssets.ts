import { fetchAssets } from "@/features/asset/services/asset.service";
import type { Asset } from "@/features/asset/schema";
import { useScopedData } from "@/hooks/use-scoped-data";

const EMPTY: Asset[] = [];

/** Loads the assets list; `reload` refetches after external changes. */
export function useAssets({ includeRetired = false }: { includeRetired?: boolean } = {}) {
  const { data, ...rest } = useScopedData(
    (role, jurisdictionId) => fetchAssets(role, jurisdictionId, { includeRetired }),
    EMPTY,
    "Could not load assets. Check your connection and try again.",
  );
  return { assets: data, ...rest };
}
