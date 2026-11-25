import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/features/profile/services/profile.service";

/**
 * Load data that depends on the signed-in user's role and jurisdiction.
 *
 * Waits until the profile has loaded (so the first query is already scoped),
 * reloads when the user changes, ignores out-of-date responses, and exposes
 * `reload` for refreshing after a create/edit/delete.
 */
export function useScopedData<T>(
  fetcher: (role: UserRole | null, jurisdictionId: number | null) => Promise<T>,
  initial: T,
  errorMessage: string,
) {
  const { role, jurisdictionId, loading: authLoading } = useAuth();
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(role, jurisdictionId);
      if (id === requestId.current) setData(result);
    } catch (e) {
      console.error(errorMessage, e);
      if (id === requestId.current) setError(errorMessage);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [role, jurisdictionId, errorMessage]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  return { data, loading: loading || authLoading, error, reload: load };
}
