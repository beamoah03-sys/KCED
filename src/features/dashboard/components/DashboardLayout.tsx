import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { AppSidebar, NavLinks } from "@/features/dashboard/components/AppSidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { UserMenu } from "@/features/dashboard/components/UserMenu";
import { Link } from "@tanstack/react-router";

/** Dashboard shell: a full-width header, with the nav sidebar and content below it. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative h-svh overflow-hidden">
      <header className="fixed inset-x-0 top-0 flex h-24 items-center justify-between border-b border-outline bg-background/5 backdrop-blur-md">
        <div className="flex items-center">
          <button
            type="button"
            className="ml-3 rounded-full p-2 hover:bg-muted md:hidden"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-0.5 px-4 md:px-6">
            <img src="/assets/images/knust-logo.png" alt="KNUST Crest" className="size-14 shrink-0 object-contain" />
            <div className="flex flex-col leading-2 pt-2">
              <span className="font-garamond font-semibold text-lg tracking-tight">KNUST</span>
              <span className="text-[0.65rem] font-medium text-muted-foreground">Central Energy Database</span>
            </div>
          </Link>
        </div>

        <div className="px-4 md:px-6">
          <UserMenu />
        </div>
      </header>

      <div className="flex h-full pt-24">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="pt-10">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
