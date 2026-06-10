import { Outlet, useLocation, NavLink } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { FileText, LogOut, Home, ClipboardList } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/admin/auth/AuthProvider";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/cliente": "Inicio",
  "/cliente/encuesta": "Encuesta",
  "/cliente/reportes": "Reportes",
};

export function ClienteLayout() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const title =
    TITLES[pathname] ?? (pathname.startsWith("/cliente/reportes/") ? "Reporte" : "Cliente");
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Helmet>
        <title>{title} · Main Catering</title>
        <meta name="description" content={`${title} · Vista cliente Main Catering.`} />
      </Helmet>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-border">
            <BrandLogo className="h-8 w-8" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">Main Catering</p>
            <p className="text-xs text-muted-foreground">Vista cliente</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <NavLink
            to="/cliente"
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
              )
            }
          >
            <Home className="h-4 w-4" /> Inicio
          </NavLink>
          <NavLink
            to="/cliente/encuesta"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
              )
            }
          >
            <ClipboardList className="h-4 w-4" /> Encuesta
          </NavLink>
          <NavLink
            to="/cliente/reportes"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
              )
            }
          >
            <FileText className="h-4 w-4" /> Reportes
          </NavLink>
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
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-card px-6">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </header>
        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}