import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";

import { AuthProvider } from "@/admin/auth/AuthProvider";
import { RequireAuth } from "@/admin/auth/RequireAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import LandingPage from "@/app/page";
import LoginPage from "@/app/login/page";
import NotFoundPage from "@/app/not-found/page";
import Forbidden from "@/admin/pages/Forbidden";
import NoAccess from "@/admin/pages/NoAccess";

const PublicSurveyPage = lazy(() => import("@/app/public-survey/[slug]/page"));
const DashboardPage = lazy(() => import("@/app/admin/dashboard/page"));
const QuestionsPage = lazy(() => import("@/app/admin/questions/page"));
const ResponsesPage = lazy(() => import("@/app/admin/responses/page"));
const ReportsPage = lazy(() => import("@/app/admin/reports/page"));
const ComedoresPage = lazy(() => import("@/app/admin/comedores/page"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/survey/:slug" element={<PublicSurveyPage />} />

            <Route path="/admin/forbidden" element={<Forbidden />} />
            <Route path="/admin/no-access" element={<NoAccess />} />

            <Route
              element={
                <RequireAuth>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/questions" element={<QuestionsPage />} />
              <Route path="/admin/responses" element={<ResponsesPage />} />
              <Route path="/admin/reports" element={<ReportsPage />} />
              <Route path="/admin/comedores" element={<ComedoresPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
