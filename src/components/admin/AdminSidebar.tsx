import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  HelpCircle,
  Inbox,
  FileText,
  Store,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/admin/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/admin/questions", label: "Preguntas", icon: HelpCircle },
  { to: "/admin/responses", label: "Respuestas", icon: Inbox },
  { to: "/admin/reports", label: "Reportes", icon: FileText },
  { to: "/admin/comedores", label: "Comedores", icon: Store },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck },
];

function SidebarBody({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { user, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center py-5",
          collapsed ? "justify-center px-2" : "justify-between gap-2 px-5",
        )}
      >
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-border">
            <BrandLogo className="h-8 w-8" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">Main Catering</p>
              <p className="text-xs text-muted-foreground">Panel administrador</p>
            </div>
          )}
        </div>
        {!collapsed && onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Colapsar menú"
            onClick={onToggleCollapse}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>
      {collapsed && onToggleCollapse && (
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Expandir menú"
            onClick={onToggleCollapse}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      )}
      <nav className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
        {ITEMS.map((item) => {
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {!collapsed && item.label}
            </NavLink>
          );
          if (collapsed) {
            return (
              <Tooltip key={item.to} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </nav>
      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
        {!collapsed && user?.email && (
          <p className="mb-2 truncate px-2 text-xs text-muted-foreground" title={user.email}>
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full text-sm",
            collapsed ? "justify-center px-0" : "justify-start gap-2",
          )}
          aria-label="Cerrar sesión"
          title={collapsed ? "Cerrar sesión" : undefined}
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {!collapsed && "Cerrar sesión"}
        </Button>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin-sidebar-collapsed") === "1";
  });
  useEffect(() => {
    window.localStorage.setItem("admin-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
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
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <SidebarBody
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
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
