import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/admin/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const { session, profile, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  useEffect(() => {
    if (params.get("expired") === "1") {
      toast.info("Tu sesión expiró. Vuelve a iniciar sesión.");
      params.delete("expired");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  if (!loading && session && profile) {
    const from = (location.state as { from?: string } | null)?.from;
    const home = profile.rol === "cliente" ? "/cliente/reportes" : "/admin/dashboard";
    return <Navigate to={from ?? home} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(email.trim(), password);
      if (result.error) {
        setError("Correo o contraseña incorrectos.");
        toast.error("Correo o contraseña incorrectos.");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setError("No pudimos verificar tu sesión.");
        return;
      }
      const { data: row } = await supabase
        .from("usuarios")
        .select("id, rol")
        .eq("id", uid)
        .maybeSingle();
      if (!row) {
        await supabase.auth.signOut();
        setError("Tu cuenta no tiene acceso al panel. Contacta al administrador.");
        return;
      }
      toast.success("Sesión iniciada");
      const home = row.rol === "cliente" ? "/cliente/reportes" : "/admin/dashboard";
      navigate(home, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    const target = forgotEmail.trim();
    if (!target) return;
    setForgotSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        toast.error("No pudimos enviar el correo. Intenta de nuevo.");
        return;
      }
      toast.success("Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.");
      setForgotOpen(false);
      setForgotEmail("");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Main Catering</h1>
            <p className="text-sm text-muted-foreground">Panel administrador</p>
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
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting || !email.trim() || !password}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar sesión
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-sm text-brand hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Restablecer contraseña</DialogTitle>
                <DialogDescription>
                  Te enviaremos un enlace a tu correo para definir una nueva contraseña.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Correo electrónico</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="tucorreo@empresa.com"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={forgotSubmitting || !forgotEmail.trim()}>
                    {forgotSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar enlace
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </main>
  );
}
