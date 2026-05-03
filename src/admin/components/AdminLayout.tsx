import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";

const TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/comments": "Comentarios",
  "/admin/questions": "Preguntas",
  "/admin/menus": "Menús del día",
  "/admin/reports": "Reportes PDF",
  "/admin/settings": "Ajustes",
};

export function AdminLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "Admin";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <AdminTopBar title={title} />
        <main className="flex-1 overflow-auto px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
