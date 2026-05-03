import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/admin/auth/AuthProvider";

export default function NoAccess() {
  const { signOut, user } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(210_40%_98%)] px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-danger">
          <ShieldX className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Sin acceso al panel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La cuenta {user?.email} no tiene un rol asignado. Contacta al administrador del sistema.
        </p>
        <Button className="mt-6" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
