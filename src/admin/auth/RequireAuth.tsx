import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, type AdminRole } from "./AuthProvider";
import { Loader2 } from "lucide-react";

type Props = {
  children: ReactNode;
  allow?: AdminRole[]; // undefined → any authenticated role
};

export function RequireAuth({ children, allow }: Props) {
  const { loading, session, role } = useAuth();
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

  if (!role) {
    return <Navigate to="/admin/no-access" replace />;
  }

  if (allow && !allow.includes(role)) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return <>{children}</>;
}
