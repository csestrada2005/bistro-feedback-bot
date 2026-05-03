import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/admin/auth/AuthProvider";

export default function Forbidden() {
  const { role } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(210_40%_98%)] px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu rol actual ({role === "hr_viewer" ? "HR — solo lectura" : role ?? "sin rol"}) no
          tiene permiso para esta sección.
        </p>
        <Button asChild className="mt-6">
          <Link to="/admin/dashboard">Volver al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
