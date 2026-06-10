import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/admin/auth/AuthProvider";
import { Button } from "@/components/ui/button";

type Comedor = { id: string; slug: string; nombre: string };

export default function ClienteEncuestaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [comedores, setComedores] = useState<Comedor[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error } = await supabase
        .from("usuario_comedores")
        .select("comedor_id, comedores(id, slug, nombre, activo)")
        .eq("usuario_id", user.id);
      if (error) {
        toast.error("No pudimos cargar tus comedores");
        setLoading(false);
        return;
      }
      const list = (data ?? [])
        .map((r: { comedores: { id: string; slug: string; nombre: string; activo: boolean } | null }) => r.comedores)
        .filter((c): c is Comedor & { activo: boolean } => !!c && c.activo)
        .map((c) => ({ id: c.id, slug: c.slug, nombre: c.nombre }));
      setComedores(list);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (comedores.length === 1) {
    return <Navigate to={`/survey/${comedores[0].slug}`} replace />;
  }

  if (comedores.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-10 text-center">
        <p className="text-base font-medium">No tienes comedores asignados</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Contacta al administrador para que te asigne uno.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Selecciona un comedor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Abre la encuesta del comedor correspondiente.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {comedores.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => navigate(`/survey/${c.slug}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-brand/40 hover:bg-foreground/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">/{c.slug}</p>
              </div>
              <Button size="sm" variant="ghost">Abrir</Button>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}