import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, FileText, Loader2 } from "lucide-react";
import { pdf } from "@react-pdf/renderer";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/admin/auth/AuthProvider";
import { ReportPdf } from "@/admin/reports/pdfDocument";
import { buildReportData } from "@/admin/reports/buildReportData";

type ReportRow = {
  id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  pdf_url: string;
};

function defaultTitle(d: Date) {
  return `Reporte Comedor — ${d.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}`;
}

export default function Reports() {
  const { user, role } = useAuth();
  const isHR = role === "hr_viewer";

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [start, setStart] = useState<Date>(monthStart);
  const [end, setEnd] = useState<Date>(today);
  const [title, setTitle] = useState(defaultTitle(today));
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [reports, setReports] = useState<ReportRow[]>([]);

  async function loadReports() {
    const { data, error } = await supabase
      .from("pdf_reports")
      .select("id, period_start, period_end, generated_at, pdf_url")
      .order("generated_at", { ascending: false });
    if (error) {
      toast.error("No se pudieron cargar los reportes");
      return;
    }
    setReports(data ?? []);
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function downloadReport(row: ReportRow) {
    const { data, error } = await supabase.storage
      .from("pdf-reports")
      .createSignedUrl(row.pdf_url, 60);
    if (error || !data) {
      toast.error("No se pudo generar el enlace de descarga");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function generate() {
    if (isHR) return;
    if (!user) return;
    if (start > end) {
      toast.error("El rango de fechas es inválido");
      return;
    }
    setGenerating(true);
    try {
      const data = await buildReportData({
        title,
        periodStart: format(start, "yyyy-MM-dd"),
        periodEnd: format(end, "yyyy-MM-dd"),
        generatedBy: user.email ?? "—",
        approvedOnly,
      });
      const blob = await pdf(<ReportPdf data={data} />).toBlob();
      const path = `${user.id}/${Date.now()}-${data.periodStart}_${data.periodEnd}.pdf`;
      const upload = await supabase.storage
        .from("pdf-reports")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upload.error) throw upload.error;

      const insert = await supabase.from("pdf_reports").insert({
        pdf_url: path,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        generated_by: user.id,
      });
      if (insert.error) throw insert.error;

      toast.success("Reporte generado");
      await loadReports();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error al generar el reporte");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-1">Generar nuevo reporte</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Selecciona el período y genera un PDF con el análisis completo.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Inicio del período</Label>
            <DateField date={start} onChange={(d) => d && setStart(d)} />
          </div>
          <div className="space-y-2">
            <Label>Fin del período</Label>
            <DateField date={end} onChange={(d) => d && setEnd(d)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <Checkbox
              id="approved-only"
              checked={approvedOnly}
              disabled={isHR}
              onCheckedChange={(v) => setApprovedOnly(Boolean(v))}
            />
            <Label htmlFor="approved-only" className="text-sm font-normal">
              Incluir solo comentarios aprobados
            </Label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={generate} disabled={generating || isHR}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando…
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" /> Generar PDF
              </>
            )}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-lg font-semibold">Reportes generados</h2>
          <span className="text-sm text-muted-foreground">{reports.length} totales</span>
        </div>
        <div className="border-t">
          {reports.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Aún no hay reportes generados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Período</th>
                  <th className="px-6 py-3 text-left font-medium">Generado</th>
                  <th className="px-6 py-3 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-6 py-3">
                      {r.period_start} — {r.period_end}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {new Date(r.generated_at).toLocaleString("es-MX")}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => downloadReport(r)}>
                        <Download className="mr-2 h-4 w-4" /> Descargar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function DateField({ date, onChange }: { date: Date; onChange: (d?: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(date, "PPP")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}