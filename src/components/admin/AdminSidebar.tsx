import { NavLink } from "react-router-dom";
import { BarChart3, HelpCircle, Inbox, FileText, Store, LogOut, UtensilsCrossed } from "lucide-react";
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

export function AdminSidebar() {
  const { user, signOut } = useAuth();
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">Main Catering</p>
          <p className="text-xs text-muted-foreground">Panel admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        {user?.email && (
          <p className="mb-2 truncate px-2 text-xs text-muted-foreground">{user.email}</p>
        )}
        <Button variant="ghost" className="w-full justify-start gap-2 text-sm" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </Button>
      </div>
    </aside>
  );
}
