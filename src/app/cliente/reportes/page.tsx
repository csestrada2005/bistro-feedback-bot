import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type Row = {
  id: string;
  titulo: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  publicado_at: string | null;
};

export default function ClienteReportesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("reportes")
        .select("id, titulo, fecha_desde, fecha_hasta, publicado_at")
        .eq("estado", "publicado")
        .order("publicado_at", { ascending: false });
      if (error) {
        toast.error("No pudimos cargar tus reportes");
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tus reportes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Análisis revisados y validados por el equipo Main Catering.
        </p>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="text-base font-medium">Aún no hay reportes publicados</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            En cuanto el equipo publique un reporte aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/cliente/reportes/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-brand/40 hover:bg-foreground/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {r.titulo ?? "Reporte"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.fecha_desde), "dd MMM yyyy", { locale: es })} —{" "}
                      {format(new Date(r.fecha_hasta), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.publicado_at
                    ? format(new Date(r.publicado_at), "dd MMM yyyy", { locale: es })
                    : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}