import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth, type AdminRol } from "./AuthProvider";

type Props = {
  children: ReactNode;
  allow?: AdminRol[];
};

export function RequireAuth({ children, allow }: Props) {
  const { loading, session, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!profile) {
    return <Navigate to="/admin/no-access" replace />;
  }

  if (allow && !allow.includes(profile.rol)) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return <>{children}</>;
}
