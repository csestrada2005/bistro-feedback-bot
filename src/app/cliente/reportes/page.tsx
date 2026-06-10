import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Inbox, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = {
  id: string;
  titulo: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  publicado_at: string | null;
  comedor_id: string;
  comedores: { nombre: string } | null;
};

export default function ClienteReportesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [comedorFilter, setComedorFilter] = useState<string>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const { downloadReportPdf } = await import("@/lib/pdf/generateReportPdf");
      await downloadReportPdf(id);
    } catch (e) {
      console.error(e);
      toast.error("No pudimos generar el PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("reportes")
        .select(
          "id, titulo, fecha_desde, fecha_hasta, publicado_at, comedor_id, comedores(nombre)",
        )
        .eq("estado", "publicado")
        .order("publicado_at", { ascending: false });
      if (error) {
        toast.error("No pudimos cargar tus reportes");
      } else {
        setRows((data ?? []) as unknown as Row[]);
      }
      setLoading(false);
    })();
  }, []);

  const comedoresList = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.comedor_id && !map.has(r.comedor_id))
        map.set(r.comedor_id, r.comedores?.nombre ?? "Comedor");
    });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(
    () => (comedorFilter === "all" ? rows : rows.filter((r) => r.comedor_id === comedorFilter)),
    [rows, comedorFilter],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tus reportes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Análisis revisados y validados por el equipo Main Catering — todos tus comedores.
          </p>
        </div>
        {comedoresList.length > 1 && (
          <Select value={comedorFilter} onValueChange={setComedorFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filtrar por comedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los comedores</SelectItem>
              {comedoresList.map(([id, nombre]) => (
                <SelectItem key={id} value={id}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="text-base font-medium">Aún no hay reportes publicados</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            En cuanto el equipo publique un reporte aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-brand/40">
                <Link
                  to={`/cliente/reportes/${r.id}`}
                  className="flex flex-1 items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {r.titulo ?? "Reporte"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.comedores?.nombre && <>{r.comedores.nombre} · </>}
                      {format(new Date(r.fecha_desde), "dd MMM yyyy", { locale: es })} —{" "}
                      {format(new Date(r.fecha_hasta), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {r.publicado_at
                      ? format(new Date(r.publicado_at), "dd MMM yyyy", { locale: es })
                      : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(r.id)}
                    disabled={downloadingId === r.id}
                  >
                    {downloadingId === r.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    PDF
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}