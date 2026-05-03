import { NavLink } from "react-router-dom";
import {
  BarChart3,
  MessageSquare,
  HelpCircle,
  UtensilsCrossed,
  FileText,
  Settings,
  LogOut,
  ChefHat,
} from "lucide-react";
import { useAuth, type AdminRole } from "@/admin/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Item = {
  to: string;
  label: string;
  icon: typeof BarChart3;
  allow?: AdminRole[];
};

const ITEMS: Item[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/admin/comments", label: "Comentarios", icon: MessageSquare, allow: ["cafeteria_admin"] },
  { to: "/admin/questions", label: "Preguntas", icon: HelpCircle, allow: ["cafeteria_admin"] },
  { to: "/admin/menus", label: "Menús del día", icon: UtensilsCrossed, allow: ["cafeteria_admin"] },
  { to: "/admin/reports", label: "Reportes PDF", icon: FileText },
  { to: "/admin/settings", label: "Ajustes", icon: Settings, allow: ["cafeteria_admin"] },
];

export function AdminSidebar() {
  const { role, user, signOut } = useAuth();
  const visible = ITEMS.filter((i) => !i.allow || (role && i.allow.includes(role)));

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-[hsl(210_40%_98%)]">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <ChefHat className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">Comedor</p>
          <p className="text-xs text-muted-foreground">Panel admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visible.map((item) => (
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
        <div className="mb-2 px-2">
          <p className="truncate text-xs font-semibold text-foreground">
            {user?.email}
          </p>
          <p className="text-xs text-muted-foreground">
            {role === "cafeteria_admin" ? "Operador" : "HR"}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
