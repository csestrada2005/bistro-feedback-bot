import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileDown, Loader2, Inbox, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: string;
  comedor_id: string;
  comedor_nombre: string;
  comedor_empresa: string;
  fecha_desde: string;
  fecha_hasta: string;
  created_at: string;
  generado_por: string | null;
  generado_por_nombre: string | null;
  estado: string;
  titulo: string | null;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: reportes, error } = await supabase
        .from("reportes")
        .select("id, comedor_id, fecha_desde, fecha_hasta, created_at, generado_por, estado, titulo")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("No pudimos cargar los reportes");
        setLoading(false);
        return;
      }
      const comedorIds = Array.from(new Set((reportes ?? []).map((r) => r.comedor_id)));
      const userIds = Array.from(
        new Set((reportes ?? []).map((r) => r.generado_por).filter(Boolean) as string[])
      );
      const [{ data: comedores }, { data: usuarios }] = await Promise.all([
        comedorIds.length
          ? supabase.from("comedores_admin").select("id, nombre, empresa_cliente").in("id", comedorIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? supabase.from("usuarios").select("id, nombre").in("id", userIds)
          : Promise.resolve({ data: [] }),
      ]);
      const cById = new Map((comedores ?? []).map((c) => [c.id, c]));
      const uById = new Map((usuarios ?? []).map((u) => [u.id, u]));
      setRows(
        (reportes ?? []).map((r) => ({
          id: r.id,
          comedor_id: r.comedor_id,
          comedor_nombre: cById.get(r.comedor_id)?.nombre ?? "—",
          comedor_empresa: cById.get(r.comedor_id)?.empresa_cliente ?? "",
          fecha_desde: r.fecha_desde,
          fecha_hasta: r.fecha_hasta,
          created_at: r.created_at,
          generado_por: r.generado_por,
          generado_por_nombre: r.generado_por ? uById.get(r.generado_por)?.nombre ?? "—" : "—",
          estado: r.estado ?? "borrador",
          titulo: r.titulo ?? null,
        }))
      );
      setLoading(false);
    })();
  }, []);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const { downloadReportPdf } = await import("@/lib/pdf/generateReportPdf");
      await downloadReportPdf(id);
      toast.success("Reporte descargado");
    } catch (e) {
      console.error(e);
      toast.error("No pudimos generar el PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("reportes").delete().eq("id", confirmDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("No pudimos eliminar el reporte");
      return;
    }
    toast.success("Reporte eliminado");
    setRows((prev) => prev.filter((r) => r.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Histórico de reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reportes ejecutivos generados con IA. Descarga cualquiera en PDF.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <p className="text-base font-medium">Aún no hay reportes generados</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Genera un análisis con IA desde el dashboard para crear el primer reporte.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha generación</TableHead>
                <TableHead>Comedor</TableHead>
                <TableHead>Rango analizado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Generado por</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {format(new Date(r.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-foreground">{r.comedor_nombre}</div>
                    {r.comedor_empresa && (
                      <div className="text-xs text-muted-foreground">{r.comedor_empresa}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(r.fecha_desde), "dd/MM/yyyy")} —{" "}
                    {format(new Date(r.fecha_hasta), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.estado === "publicado" ? "default" : "outline"}>
                      {r.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.generado_por_nombre}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/admin/reports/${r.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </Link>
                    </Button>
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
                      Descargar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(r)}
                      className="text-destructive hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este reporte?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El reporte se borrará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
