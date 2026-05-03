import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Survey from "./pages/Survey";
import { AuthProvider } from "@/admin/auth/AuthProvider";
import { RequireAuth } from "@/admin/auth/RequireAuth";
import { AdminLayout } from "@/admin/components/AdminLayout";
import AdminLogin from "@/admin/pages/Login";
import Forbidden from "@/admin/pages/Forbidden";
import NoAccess from "@/admin/pages/NoAccess";
import PlaceholderPage from "@/admin/pages/Stub";
import Dashboard from "@/admin/dashboard/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/survey" element={<Survey />} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/forbidden" element={<Forbidden />} />
            <Route path="/admin/no-access" element={<NoAccess />} />

            <Route
              element={
                <RequireAuth>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/reports" element={<PlaceholderPage title="Reportes PDF" />} />
            </Route>

            <Route
              element={
                <RequireAuth allow={["cafeteria_admin"]}>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route path="/admin/comments" element={<PlaceholderPage title="Comentarios" />} />
              <Route path="/admin/questions" element={<PlaceholderPage title="Preguntas" />} />
              <Route path="/admin/menus" element={<PlaceholderPage title="Menús del día" />} />
              <Route path="/admin/settings" element={<PlaceholderPage title="Ajustes" />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
