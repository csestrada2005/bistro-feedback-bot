import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/admin/auth/AuthProvider";
import { RequireAuth } from "@/admin/auth/RequireAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";

import LandingPage from "@/app/page";
import LoginPage from "@/app/login/page";
import PublicSurveyPage from "@/app/public-survey/[slug]/page";
import NotFoundPage from "@/app/not-found/page";
import DashboardPage from "@/app/admin/dashboard/page";
import QuestionsPage from "@/app/admin/questions/page";
import ResponsesPage from "@/app/admin/responses/page";
import ReportsPage from "@/app/admin/reports/page";
import ComedoresPage from "@/app/admin/comedores/page";
import Forbidden from "@/admin/pages/Forbidden";
import NoAccess from "@/admin/pages/NoAccess";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
