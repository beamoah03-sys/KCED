import { useEffect, useState } from "react";
import type { Jurisdiction } from "@/features/service_request/schema";
import { fetchJurisdictions } from "@/features/service_request/services/service_request.service";

let cache: Promise<Jurisdiction[]> | null = null;

/** The jurisdiction list, fetched once per page load and shared. */
export function useJurisdictions(): Jurisdiction[] {
  const [list, setList] = useState<Jurisdiction[]>([]);
  useEffect(() => {
    cache ??= fetchJurisdictions().catch((e) => {
      cache = null;
      throw e;
    });
    let alive = true;
    cache.then((j) => alive && setList(j)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return list;
}
