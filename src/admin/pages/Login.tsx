import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/admin/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminLogin() {
  const { session, role, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session && role) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? "/admin/dashboard"} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(email.trim(), password);
      if (result.error) {
        setError("Correo o contraseña incorrectos.");
        return;
      }
      // Verify role
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setError("No pudimos verificar tu sesión.");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const hasRole = roles && roles.length > 0;
      if (!hasRole) {
        await supabase.auth.signOut();
        setError("Tu cuenta no tiene acceso al panel. Contacta al administrador.");
        return;
      }
      toast("Sesión iniciada");
      navigate("/admin/dashboard", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(210_40%_98%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Panel del comedor</h1>
            <p className="text-sm text-muted-foreground">Acceso restringido</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@empresa.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
