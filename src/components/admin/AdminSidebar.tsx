import { useState } from "react";
import { NavLink } from "react-router-dom";
import { BarChart3, HelpCircle, Inbox, FileText, Store, LogOut, UtensilsCrossed, Menu, X } from "lucide-react";
import { useAuth } from "@/admin/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/admin/questions", label: "Preguntas", icon: HelpCircle },
  { to: "/admin/responses", label: "Respuestas", icon: Inbox },
  { to: "/admin/reports", label: "Reportes", icon: FileText },
  { to: "/admin/comedores", label: "Comedores", icon: Store },
];

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">Main Catering</p>
          <p className="text-xs text-muted-foreground">Panel administrador</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        {user?.email && (
          <p className="mb-2 truncate px-2 text-xs text-muted-foreground" title={user.email}>
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      {/* Trigger mobile */}
      <Button
        variant="outline"
        size="icon"
        aria-label="Abrir menú"
        className="fixed left-3 top-3 z-50 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Sidebar desktop */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <SidebarBody />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-card shadow-xl">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar menú"
              className="absolute right-2 top-2"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
