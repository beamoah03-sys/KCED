import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CloudOff, Filter, Search, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers } from "@/features/user/hooks/useUsers";
import { USER_ROLES, USER_STATUSES, type User, type UserRole, type UserStatus } from "@/features/user/schema";
import { UsersTable } from "@/features/user/components/UsersTable";
import { InviteUserDialog } from "@/features/user/components/InviteUserDialog";
import { EditUserDialog } from "@/features/user/components/EditUserDialog";
import { useAuth } from "@/lib/auth-context";
import { canEditUser } from "@/features/user/permissions";
import { ExportButton } from "@/components/ExportButton";
import type { CsvColumn } from "@/lib/csv";

const EXPORT_COLUMNS: CsvColumn<User>[] = [
  { header: "Name", value: (u) => u.fullName },
  { header: "Email", value: (u) => u.email },
  { header: "Phone", value: (u) => u.phone },
  { header: "Role", value: (u) => u.role },
  { header: "Status", value: (u) => u.status },
  { header: "Jurisdiction", value: (u) => u.jurisdictionName },
  { header: "Joined", value: (u) => u.createdAt },
];

export const Route = createFileRoute("/dashboard/users")({
  component: Users,
});

type RoleFilter = UserRole | "all";
type StatusFilter = UserStatus | "all";

function Users() {
  const { profile, role, jurisdictionId } = useAuth();
  const actor = { role, jurisdictionId, userId: profile?.id ?? null };
  const { users, loading, error, reload } = useUsers();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const openEdit = (user: User) => {
    setEditing(user);
    setEditOpen(true);
  };

  const filtered = useMemo(() => {
    let result = users;

    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((u) => u.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [users, roleFilter, statusFilter, searchQuery]);

  const activeFilterCount = (roleFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading users…" : `Manage user accounts and their roles across the system`}
          </p>
        </div>
        {profile && (profile.role === "admin" || profile.role === "manager") && (
          <InviteUserDialog userRole={profile.role} onInvited={reload} />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <ExportButton name="users" rows={filtered} columns={EXPORT_COLUMNS} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="size-4" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuLabel>Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Role</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => setRoleFilter("all")}>All roles</DropdownMenuItem>
                  {USER_ROLES.map((r) => (
                    <DropdownMenuItem key={r.dbValue} onSelect={() => setRoleFilter(r.dbValue)}>
                      {r.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => setStatusFilter("all")}>All statuses</DropdownMenuItem>
                  {USER_STATUSES.map((s) => (
                    <DropdownMenuItem key={s.dbValue} onSelect={() => setStatusFilter(s.dbValue)}>
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      setRoleFilter("all");
                      setStatusFilter("all");
                    }}
                  >
                    Clear all filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <CloudOff className="size-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">Something went wrong</h3>
          <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
          <Button onClick={reload} className="mt-2">
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <UsersIcon className="size-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">{users.length === 0 ? "No users yet." : "No matching users."}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {users.length === 0
              ? "User accounts will appear here."
              : "No users match these filters. Try different ones."}
          </p>
        </div>
      ) : (
        <UsersTable
          users={filtered}
          currentUserId={profile?.id ?? null}
          onEdit={openEdit}
          canEdit={(u) => canEditUser(actor, u)}
        />
      )}

      <EditUserDialog user={editing} open={editOpen} onOpenChange={setEditOpen} onSaved={reload} />
    </div>
  );
}
