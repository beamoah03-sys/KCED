import { fetchDashboardCounts, type DashboardCounts } from "@/features/dashboard/services/dashboard.service";
import { useScopedData } from "@/hooks/use-scoped-data";

export interface DashboardData {
  counts: DashboardCounts;
}

/**
 * Loads the dashboard counts in one parallel fetch. The web counterpart of
 * the kced_mobile `HomeController.load()`.
 */
export function useDashboardData() {
  return useScopedData<DashboardData | null>(
    async (role, jurisdictionId) => ({ counts: await fetchDashboardCounts(role, jurisdictionId) }),
    null,
    "Could not load insights.",
  );
}
