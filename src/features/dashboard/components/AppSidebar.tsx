import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound, ChevronUp, Zap, Building2, Gauge, Receipt, ZapOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/UserAvatar";
import { signOut } from "@/features/auth/services/auth.service";
import { ROLE_LABELS } from "@/features/profile/services/profile.service";
import { useAuth } from "@/lib/auth-context";

/** Primary dashboard navigation. `to` values must be real, existing routes. */
type NavItem = { to: string; label: string; img?: string; icon?: LucideIcon };

const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", img: "/assets/images/dashboard/dashboard.webp" },
      {
        to: "/dashboard/service-requests",
        label: "Service Requests",
        img: "/assets/images/dashboard/service-requests.webp",
      },
      { to: "/dashboard/work-orders", label: "Work Orders", img: "/assets/images/dashboard/work-orders.webp" },
      { to: "/dashboard/assets", label: "Assets", img: "/assets/images/dashboard/assets.webp" },
      { to: "/dashboard/map", label: "Map", img: "/assets/images/dashboard/map.webp" },
    ],
  },
  {
    title: "Energy",
    items: [
      { to: "/dashboard/energy", label: "Overview", icon: Zap },
      { to: "/dashboard/buildings", label: "Buildings", icon: Building2 },
      { to: "/dashboard/meters", label: "Meters", icon: Gauge },
      { to: "/dashboard/bills", label: "Bills", icon: Receipt },
      { to: "/dashboard/outages", label: "Outages", icon: ZapOff },
    ],
  },
  {
    title: "Admin",
    items: [{ to: "/dashboard/users", label: "Users", img: "/assets/images/dashboard/users.webp" }],
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <nav
      aria-label="Main"
      className="hidden w-64 shrink-0 flex-col gap-1 overflow-hidden border-r border-outline md:flex"
    >
      <NavLinks />

      <div className="mt-auto p-4 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-4xl p-2 text-left outline-none transition-colors hover:bg-muted"
            aria-label="Account menu"
          >
            <UserAvatar seed={profile?.id ?? "anonymous"} avatarUrl={profile?.avatarUrl} size={36} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-base font-semibold text-foreground">{profile?.fullName || "User"}</span>
              <span className="truncate text-xs text-muted-foreground">
                {profile ? ROLE_LABELS[profile.role] : "—"}
              </span>
            </span>
            <ChevronUp className="size-4 shrink-0 ml-auto mr-4" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem onSelect={() => navigate({ to: "/dashboard/profile" })}>
              <UserRound />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}

/** The navigation sections; shared by the desktop sidebar and the mobile menu. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {NAV_SECTIONS.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-1">
          {section.title && (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                onClick={onNavigate}
                key={item.to}
                to={item.to}
                aria-current={pathname === item.to ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-4xl px-3 py-2 font-medium transition-colors",
                  pathname === item.to ? "bg-primary-soft text-on-soft" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.img ? (
                  <img src={item.img} alt="" className="size-6 shrink-0" />
                ) : Icon ? (
                  <Icon className="size-6 shrink-0 p-0.5 text-primary" />
                ) : null}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
