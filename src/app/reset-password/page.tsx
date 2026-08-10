import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/admin/auth/AuthProvider";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        toast.error("No se pudo actualizar la contraseña.");
        return;
      }
      toast.success("Contraseña actualizada");
      const current = profile ?? (await refreshProfile());
      if (!current) {
        navigate("/admin/no-access", { replace: true });
        return;
      }
      navigate(current.rol === "cliente" ? "/cliente" : "/admin/dashboard", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <BrandLogo className="h-12 w-12 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Nueva contraseña</h1>
            <p className="text-sm text-muted-foreground">Define tu nueva contraseña de acceso</p>
          </div>
        </div>

        {hasSession === false ? (
          <div className="space-y-4">
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              El enlace de recuperación no es válido o expiró. Solicita uno nuevo desde la pantalla de inicio de sesión.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              Ir a iniciar sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !password || !confirm}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar contraseña
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}