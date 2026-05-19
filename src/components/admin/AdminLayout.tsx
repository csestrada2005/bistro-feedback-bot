import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";

const TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/questions": "Preguntas",
  "/admin/responses": "Respuestas",
  "/admin/reports": "Reportes",
  "/admin/comedores": "Comedores",
};

export function AdminLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "Admin";
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-card px-6 pl-16 md:pl-6">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </header>
        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
