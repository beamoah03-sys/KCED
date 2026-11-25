import { fetchUsers } from "@/features/user/services/user.service";
import type { User } from "@/features/user/schema";
import { useScopedData } from "@/hooks/use-scoped-data";

const EMPTY: User[] = [];

export function useUsers() {
  const { data, ...rest } = useScopedData(
    fetchUsers,
    EMPTY,
    "Could not load users. Check your connection and try again.",
  );
  return { users: data, ...rest };
}
