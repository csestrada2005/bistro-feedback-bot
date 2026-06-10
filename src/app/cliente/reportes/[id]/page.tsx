import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ArrowLeft, FileDown, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Kpi = { label: string; value: string };
type Reco = { titulo: string; detalle: string; prioridad: string };
type Alerta = { titulo: string; detalle: string; severidad: string };
type Reporte = {
  id: string;
  titulo: string | null;
  resumen: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  publicado_at: string | null;
  kpis: Kpi[];
  recomendaciones: Reco[];
  alertas: Alerta[];
  comedores: { nombre: string } | null;
};

const sevColor: Record<string, string> = {
  alta: "destructive",
  media: "secondary",
  baja: "outline",
};

export default function ClienteReporteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rep, setRep] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!rep) return;
    setDownloading(true);
    try {
      const { downloadReportPdf } = await import("@/lib/pdf/generateReportPdf");
      await downloadReportPdf(rep.id);
    } catch (e) {
      console.error(e);
      toast.error("No pudimos generar el PDF");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const { data, error } = await supabase
        .from("reportes")
        .select(
          "id, titulo, resumen, fecha_desde, fecha_hasta, publicado_at, kpis, recomendaciones, alertas, comedores(nombre)",
        )
        .eq("id", id)
        .eq("estado", "publicado")
        .maybeSingle();
      if (error || !data) {
        toast.error("Reporte no disponible");
      } else {
        setRep(data as unknown as Reporte);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!rep) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to="/cliente/reportes"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <h2 className="text-2xl font-bold text-foreground">{rep.titulo ?? "Reporte"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rep.comedores?.nombre && <>{rep.comedores.nombre} · </>}
            {format(new Date(rep.fecha_desde), "dd MMM yyyy", { locale: es })} —{" "}
            {format(new Date(rep.fecha_hasta), "dd MMM yyyy", { locale: es })}
            {rep.publicado_at && (
              <> · Publicado {format(new Date(rep.publicado_at), "dd MMM yyyy", { locale: es })}</>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={handleDownload} disabled={downloading}>
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Descargar PDF
        </Button>
      </div>

      {rep.kpis?.length > 0 && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {rep.kpis.map((k, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
            </div>
          ))}
        </section>
      )}

      {rep.resumen && (
        <section className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-3 text-lg font-semibold text-foreground">Resumen</h3>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/80">
            {rep.resumen}
          </div>
        </section>
      )}

      {rep.alertas?.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Alertas
          </h3>
          <ul className="space-y-3">
            {rep.alertas.map((a, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{a.titulo}</p>
                  <Badge variant={(sevColor[a.severidad] ?? "secondary") as never}>
                    {a.severidad}
                  </Badge>
                </div>
                {a.detalle && (
                  <p className="mt-1 text-sm text-muted-foreground">{a.detalle}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rep.recomendaciones?.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Lightbulb className="h-5 w-5 text-brand" /> Recomendaciones
          </h3>
          <ul className="space-y-3">
            {rep.recomendaciones.map((r, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{r.titulo}</p>
                  <Badge variant={(sevColor[r.prioridad] ?? "secondary") as never}>
                    {r.prioridad}
                  </Badge>
                </div>
                {r.detalle && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.detalle}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}